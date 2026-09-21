import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateLoan } from "@/lib/loans/calculator";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const loan = await prisma.loan.findUnique({
      where: { id },
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

    // Generate schedule
    const calc = calculateLoan({
      principal: loan.principalAmount,
      interestRate: loan.interestRate,
      interestType: loan.interestType as "FLAT" | "REDUCING" | "SIMPLE",
      interestFrequency: loan.interestFrequency as "MONTHLY" | "WEEKLY" | "DAILY" | "YEARLY",
      paymentFrequency: loan.paymentFrequency as "MONTHLY" | "WEEKLY" | "DAILY",
      totalInstallments: loan.totalInstallments,
      startDate: loan.date,
    });

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
