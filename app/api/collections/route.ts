import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const method = searchParams.get("method");
    const q = searchParams.get("q");

    const where: Prisma.LoanPaymentWhereInput = {};
    if (method && method !== "ALL") {
      where.paymentMethod = method;
    }
    if (q) {
      where.OR = [
        { paymentNo: { contains: q } },
        { customer: { name: { contains: q } } },
        { loan: { loanNo: { contains: q } } },
      ];
    }

    const payments = await prisma.loanPayment.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, mobile: true, address: true, city: true } },
        loan: { select: { id: true, loanNo: true, principalAmount: true, totalPayable: true, loanCalculationType: true, advanceInterest: true, interestOutstanding: true, interestPaid: true } },
      },
      orderBy: { date: "desc" },
    });

    const distinctLoanIds = Array.from(new Set(payments.map((p) => p.loanId)));
    const allLoanPayments = distinctLoanIds.length > 0
      ? await prisma.loanPayment.findMany({
          where: { loanId: { in: distinctLoanIds } },
          orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        })
      : [];

    const paymentsByLoan = new Map<string, typeof allLoanPayments>();
    for (const lp of allLoanPayments) {
      if (!paymentsByLoan.has(lp.loanId)) paymentsByLoan.set(lp.loanId, []);
      paymentsByLoan.get(lp.loanId)!.push(lp);
    }

    const enrichedPayments = payments.map((p) => {
      const loanPayments = paymentsByLoan.get(p.loanId) || [];
      let paidBefore = 0;
      for (const prior of loanPayments) {
        if (prior.id === p.id) break;
        paidBefore += prior.amount;
      }

      const isAdvInt = p.loan?.loanCalculationType === "ADVANCE_INTEREST" || Boolean((p.loan as any)?.advanceInterest && (p.loan as any)?.advanceInterest > 0);
      const totPayable = p.loan?.totalPayable && p.loan.totalPayable > 0
        ? p.loan.totalPayable
        : (p.loan?.principalAmount ? (p.loan.principalAmount + (isAdvInt ? 0 : ((p.loan.interestOutstanding || 0) + (p.loan.interestPaid || 0)))) : 0);

      const prevOutstanding = totPayable > 0 ? Math.max(0, Math.round((totPayable - paidBefore) * 100) / 100) : 0;
      const currOutstanding = Math.max(0, Math.round((prevOutstanding - p.amount) * 100) / 100);

      const custAddr = (() => {
        const a = (p.customer?.address || "").trim();
        const c = (p.customer?.city || "").trim();
        if (a && c) {
          if (a.toLowerCase().includes(c.toLowerCase())) return a;
          return `${a}, ${c}`;
        }
        return a || c || "";
      })();

      return {
        ...p,
        address: custAddr,
        previousOutstanding: prevOutstanding,
        currentOutstanding: currOutstanding,
        remainingOutstanding: currOutstanding,
        customer: p.customer ? {
          ...p.customer,
          address: custAddr || p.customer.address,
        } : undefined,
      };
    });

    const totalCollected = payments.reduce((s, p) => s + p.amount, 0);
    const totalPrincipal = payments.reduce((s, p) => s + p.principalPortion, 0);
    const totalInterest = payments.reduce((s, p) => s + p.interestPortion, 0);

    return NextResponse.json({
      payments: enrichedPayments,
      totalCollected,
      totalPrincipal,
      totalInterest,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch collections";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
