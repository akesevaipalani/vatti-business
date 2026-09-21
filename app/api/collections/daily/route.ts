import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const activeLoans = await prisma.loan.findMany({
      where: {
        status: { in: ["ACTIVE", "OVERDUE"] },
      },
      include: {
        customer: {
          select: {
            id: true,
            customerCode: true,
            name: true,
            mobile: true,
            city: true,
            address: true,
          },
        },
        payments: {
          orderBy: { date: "desc" },
          take: 1,
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const now = new Date();

    const collectionList = activeLoans.map((loan) => {
      const isOverdue = loan.dueDate ? new Date(loan.dueDate) < now : false;
      const lastPayment = loan.payments[0] || null;

      return {
        loanId: loan.id,
        loanNo: loan.loanNo,
        customer: loan.customer,
        principalAmount: loan.principalAmount,
        installmentAmount: loan.installmentAmount,
        principalOutstanding: loan.principalOutstanding,
        interestOutstanding: loan.interestOutstanding,
        totalOutstanding: loan.principalOutstanding + loan.interestOutstanding,
        dueDate: loan.dueDate,
        isOverdue,
        lastPaymentDate: lastPayment?.date || null,
        lastPaymentAmount: lastPayment?.amount || null,
        interestRate: loan.interestRate,
        interestType: loan.interestType,
      };
    });

    return NextResponse.json({ collections: collectionList });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch daily collections";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
