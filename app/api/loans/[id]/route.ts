import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateLoan } from "@/lib/loans/calculator";
import { generateInstallmentsForLoan } from "@/lib/loans/installments";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let loan = await prisma.loan.findFirst({
      where: {
        OR: [{ id }, { loanNo: id }],
      },
      include: {
        customer: {
          include: {
            guarantors: true,
            collaterals: true,
          },
        },
        payments: { orderBy: { date: "desc" } },
        collaterals: true,
        interestTransactions: { orderBy: { date: "desc" } },
        installments: { orderBy: { installmentNumber: "asc" } },
      },
    });

    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }

    // Auto-bootstrap installments in DB if empty
    if (!loan.installments || loan.installments.length === 0) {
      try {
        await generateInstallmentsForLoan(loan.id);
        const reloadedInstallments = await prisma.loanInstallment.findMany({
          where: { loanId: loan.id },
          orderBy: { installmentNumber: "asc" },
        });
        if (reloadedInstallments.length > 0) {
          loan = { ...loan, installments: reloadedInstallments };
        }
      } catch (genErr) {
        console.warn("Failed to auto-generate installments in DB:", genErr);
      }
    }

    // Generate schedule
    const calc = calculateLoan({
      principal: loan.principalAmount,
      loanCalculationType: ((loan as any).loanCalculationType as "STANDARD" | "ADVANCE_INTEREST" | "INTEREST_PRINCIPAL") || "STANDARD",
      interestRate: loan.interestRate,
      interestType: loan.interestType as "FLAT" | "REDUCING" | "SIMPLE",
      advanceInterestAmount: (loan as any).advanceInterest,
      customInterestAmount: loan.totalPayable > loan.principalAmount ? (loan.totalPayable - loan.principalAmount) : undefined,
      customInstallmentAmount: loan.installmentAmount,
      processingFee: loan.processingFee,
      interestFrequency: loan.interestFrequency as "MONTHLY" | "WEEKLY" | "DAILY" | "YEARLY",
      paymentFrequency: loan.paymentFrequency as "MONTHLY" | "WEEKLY" | "DAILY",
      totalInstallments: loan.totalInstallments,
      startDate: loan.date,
    });

    // If installments is still empty, synthesize from calc.schedule
    let installments = loan.installments || [];
    if (installments.length === 0 && calc.schedule.length > 0) {
      installments = calc.schedule.map((item) => ({
        id: `synth-${loan!.id}-${item.installmentNumber}`,
        loanId: loan!.id,
        customerId: loan!.customerId,
        installmentNumber: item.installmentNumber,
        dueDate: new Date(item.dueDate),
        installmentAmount: item.installmentAmount,
        principalPortion: item.principalPortion,
        interestPortion: item.interestPortion,
        paidAmount: 0,
        principalPaid: 0,
        interestPaid: 0,
        status: "PENDING",
        actualPaymentDate: null,
        paymentMethod: "CASH",
        notes: null,
        createdAt: loan!.createdAt,
        updatedAt: loan!.updatedAt,
      })) as any;
      loan = { ...loan, installments };
    }

    // Enrich loan.payments with exact loan-level previous & remaining outstanding balances
    if (loan.payments && loan.payments.length > 0) {
      const isAdvInt = loan.loanCalculationType === "ADVANCE_INTEREST" || Boolean((loan as any).advanceInterest && (loan as any).advanceInterest > 0);
      const totPayable = loan.totalPayable && loan.totalPayable > 0
        ? loan.totalPayable
        : (loan.principalAmount + (isAdvInt ? 0 : ((loan.interestOutstanding || 0) + (loan.interestPaid || 0))));

      const custAddr = (() => {
        const a = (loan.customer?.address || "").trim();
        const c = (loan.customer?.city || "").trim();
        if (a && c) {
          if (a.toLowerCase().includes(c.toLowerCase())) return a;
          return `${a}, ${c}`;
        }
        return a || c || "";
      })();

      const chronoPayments = [...loan.payments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      let cumulativePaid = 0;
      const paymentBalances = new Map<string, { previousOutstanding: number; currentOutstanding: number }>();
      for (const p of chronoPayments) {
        const prev = totPayable > 0 ? Math.max(0, Math.round((totPayable - cumulativePaid) * 100) / 100) : 0;
        const curr = Math.max(0, Math.round((prev - p.amount) * 100) / 100);
        cumulativePaid += p.amount;
        paymentBalances.set(p.id, { previousOutstanding: prev, currentOutstanding: curr });
      }

      const currentLoan = loan;
      loan = {
        ...currentLoan,
        payments: currentLoan.payments.map((p) => {
          const bal = paymentBalances.get(p.id);
          return {
            ...p,
            address: custAddr,
            previousOutstanding: bal?.previousOutstanding,
            currentOutstanding: bal?.currentOutstanding,
            remainingOutstanding: bal?.currentOutstanding,
            customer: currentLoan.customer ? {
              name: currentLoan.customer.name,
              mobile: currentLoan.customer.mobile,
              address: custAddr,
              city: currentLoan.customer.city,
            } : undefined,
          };
        }),
      } as any;
    }
    if (!loan) {
      return NextResponse.json({ error: "Loan not found" }, { status: 404 });
    }
    const safeLoan = loan;
    // Authoritative per-installment cumulative scheduled loan principal projection
    // Projected Principal Outstanding After This Installment is Paid:
    // MAX(0, loanPrincipal - cumulativeScheduledPrincipalThroughThisInstallment)
    const isAdvInt = safeLoan.loanCalculationType === "ADVANCE_INTEREST" || Boolean((safeLoan as any).advanceInterest && (safeLoan as any).advanceInterest > 0);
    const loanPrincipal = Number(safeLoan.principalAmount || 0);

    const sortedInstallments = [...(safeLoan.installments || [])].sort((a, b) => a.installmentNumber - b.installmentNumber);
    let cumulativeScheduledPrincipal = 0;
    const installmentBalanceMap = new Map<number, {
      paidAmount: number;
      installmentBalance: number;
      projectedBalance: number;
      status: string;
    }>();

    for (const inst of sortedInstallments) {
      const paid = Number(inst.paidAmount || 0);
      const expectedAmt = Number(inst.installmentAmount || 0);
      const prinPortion = Number(inst.principalPortion || (isAdvInt ? expectedAmt : (loanPrincipal / (safeLoan.totalInstallments || 1))));
      cumulativeScheduledPrincipal += prinPortion;

      const instBal = Math.max(0, Math.round((expectedAmt - paid) * 100) / 100);
      const projectedBal = Math.max(0, Math.round((loanPrincipal - cumulativeScheduledPrincipal) * 100) / 100);
      const status = inst.status || (instBal === 0 ? "COLLECTED" : (paid > 0 ? "PARTIALLY_PAID" : "PENDING"));

      installmentBalanceMap.set(inst.installmentNumber, {
        paidAmount: paid,
        installmentBalance: instBal,
        projectedBalance: projectedBal,
        status,
      });
    }

    const enrichedInstallments = sortedInstallments.map((inst) => {
      const balInfo = installmentBalanceMap.get(inst.installmentNumber);
      const isAdv = isAdvInt;
      const defaultPrin = Number(inst.principalPortion || (isAdv ? inst.installmentAmount : (loanPrincipal / (safeLoan.totalInstallments || 1))));
      const projectedBal = balInfo ? balInfo.projectedBalance : Math.max(0, Math.round((loanPrincipal - inst.installmentNumber * defaultPrin) * 100) / 100);
      return {
        ...inst,
        paidAmount: balInfo ? balInfo.paidAmount : Number(inst.paidAmount || 0),
        installmentBalance: balInfo ? balInfo.installmentBalance : Math.max(0, Number(inst.installmentAmount) - Number(inst.paidAmount || 0)),
        balanceAmount: projectedBal,
        projectedBalance: projectedBal,
        loanOutstanding: projectedBal,
        loanOutstandingAfterInstallment: projectedBal,
        cumulativePrincipalOutstanding: projectedBal,
        remainingPrincipal: projectedBal,
        status: balInfo ? balInfo.status : inst.status,
      };
    });

    const enrichedSchedule = calc.schedule.map((item) => {
      const balInfo = installmentBalanceMap.get(item.installmentNumber);
      const projectedBal = balInfo ? balInfo.projectedBalance : item.remainingPrincipal;
      return {
        ...item,
        paidAmount: balInfo ? balInfo.paidAmount : 0,
        installmentBalance: balInfo ? balInfo.installmentBalance : item.installmentAmount,
        balanceAmount: projectedBal,
        projectedBalance: projectedBal,
        loanOutstanding: projectedBal,
        loanOutstandingAfterInstallment: projectedBal,
        cumulativePrincipalOutstanding: projectedBal,
        remainingPrincipal: projectedBal,
        status: balInfo ? balInfo.status : "PENDING",
      };
    });

    const finalLoan = {
      ...safeLoan,
      installments: enrichedInstallments,
    };

    return NextResponse.json({ loan: finalLoan, schedule: enrichedSchedule });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch loan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, notes } = body;

    const updated = await prisma.loan.update({
      where: { id },
      data: {
        status: status || undefined,
        notes: notes || undefined,
        closedAt: status === "CLOSED" ? new Date() : undefined,
      },
    });

    return NextResponse.json({ success: true, loan: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update loan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
