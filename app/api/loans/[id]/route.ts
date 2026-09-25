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

    return NextResponse.json({ loan, schedule: calc.schedule });
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
