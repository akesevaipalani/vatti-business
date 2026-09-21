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
        customer: { select: { id: true, name: true, mobile: true } },
        loan: { select: { id: true, loanNo: true, principalAmount: true } },
      },
      orderBy: { date: "desc" },
    });

    const totalCollected = payments.reduce((s, p) => s + p.amount, 0);
    const totalPrincipal = payments.reduce((s, p) => s + p.principalPortion, 0);
    const totalInterest = payments.reduce((s, p) => s + p.interestPortion, 0);

    return NextResponse.json({
      payments,
      totalCollected,
      totalPrincipal,
      totalInterest,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch collections";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
