import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface CashEntry {
  id: string;
  date: Date;
  type: "IN" | "OUT";
  category: string;
  title: string;
  amount: number;
  ref: string;
}

export async function GET() {
  try {
    const cashAccount = await prisma.cashAccount.findUnique({
      where: { id: "main-cash" },
    });

    // Fetch all cash transactions
    const [cashPayments, cashIncomes, cashInvestments, cashExpenses, cashWithdrawals, cashLoans] =
      await Promise.all([
        prisma.loanPayment.findMany({
          where: { paymentMethod: "CASH" },
          include: { customer: { select: { name: true } }, loan: { select: { loanNo: true } } },
          orderBy: { date: "desc" },
          take: 50,
        }),
        prisma.income.findMany({
          where: { paymentMethod: "CASH" },
          orderBy: { date: "desc" },
          take: 50,
        }),
        prisma.partnerInvestment.findMany({
          where: { paymentMethod: "CASH" },
          include: { partner: { select: { name: true } } },
          orderBy: { date: "desc" },
          take: 50,
        }),
        prisma.expense.findMany({
          where: { paymentMethod: "CASH" },
          orderBy: { date: "desc" },
          take: 50,
        }),
        prisma.partnerWithdrawal.findMany({
          where: { paymentMethod: "CASH" },
          include: { partner: { select: { name: true } } },
          orderBy: { date: "desc" },
          take: 50,
        }),
        prisma.loan.findMany({
          include: { customer: { select: { name: true } } },
          orderBy: { date: "desc" },
          take: 50,
        }),
      ]);

    const cashEntries: CashEntry[] = [];

    cashPayments.forEach((p) => {
      cashEntries.push({
        id: `p-${p.id}`,
        date: p.date,
        type: "IN",
        category: "COLLECTION",
        title: `Loan Collection: ${p.customer.name} (${p.loan.loanNo})`,
        amount: p.amount,
        ref: p.paymentNo,
      });
    });

    cashIncomes.forEach((i) => {
      cashEntries.push({
        id: `i-${i.id}`,
        date: i.date,
        type: "IN",
        category: "INCOME",
        title: `Income (${i.type}): ${i.description}`,
        amount: i.amount,
        ref: i.incomeNo,
      });
    });

    cashInvestments.forEach((inv) => {
      cashEntries.push({
        id: `inv-${inv.id}`,
        date: inv.date,
        type: "IN",
        category: "INVESTMENT",
        title: `Partner Capital: ${inv.partner.name}`,
        amount: inv.amount,
        ref: inv.investmentCode,
      });
    });

    cashLoans.forEach((l) => {
      cashEntries.push({
        id: `loan-${l.id}`,
        date: l.date,
        type: "OUT",
        category: "DISBURSEMENT",
        title: `Loan Disbursed: ${l.customer.name} (${l.loanNo})`,
        amount: l.principalAmount,
        ref: l.loanNo,
      });
    });

    cashExpenses.forEach((e) => {
      cashEntries.push({
        id: `e-${e.id}`,
        date: e.date,
        type: "OUT",
        category: "EXPENSE",
        title: `Expense (${e.category}): ${e.description}`,
        amount: e.amount,
        ref: e.expenseNo,
      });
    });

    cashWithdrawals.forEach((w) => {
      cashEntries.push({
        id: `w-${w.id}`,
        date: w.date,
        type: "OUT",
        category: "WITHDRAWAL",
        title: `Partner Drawing: ${w.partner.name}`,
        amount: w.amount,
        ref: w.withdrawalCode,
      });
    });

    cashEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalCashIn = cashEntries.filter((e) => e.type === "IN").reduce((s, e) => s + e.amount, 0);
    const totalCashOut = cashEntries.filter((e) => e.type === "OUT").reduce((s, e) => s + e.amount, 0);
    const openingCash = cashAccount?.openingBalance || 0;
    const currentCashInHand = openingCash + totalCashIn - totalCashOut;

    if (cashAccount && cashAccount.currentBalance !== currentCashInHand) {
      await prisma.cashAccount.update({
        where: { id: "main-cash" },
        data: { currentBalance: currentCashInHand },
      });
      cashAccount.currentBalance = currentCashInHand;
    }

    return NextResponse.json({
      cashAccount,
      totalCashIn,
      totalCashOut,
      netCash: totalCashIn - totalCashOut,
      currentCashInHand,
      entries: cashEntries,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch cash book";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
