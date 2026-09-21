import { prisma } from "@/lib/prisma";

export async function getDayClosingInfo(dateStr?: string) {
  const targetDateStr = dateStr || new Date().toISOString().split("T")[0];

  const existingClosing = await prisma.dailyClosing.findUnique({
    where: { date: targetDateStr },
  });

  const startOfDay = new Date(`${targetDateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${targetDateStr}T23:59:59.999Z`);

  // Aggregate today's cash flows
  const [cashAccount, cashPayments, cashIncomes, cashExpenses, cashWithdrawals, cashInvestments] =
    await Promise.all([
      prisma.cashAccount.findUnique({ where: { id: "main-cash" } }),
      prisma.loanPayment.findMany({
        where: {
          paymentMethod: "CASH",
          date: { gte: startOfDay, lte: endOfDay },
        },
      }),
      prisma.income.findMany({
        where: {
          paymentMethod: "CASH",
          date: { gte: startOfDay, lte: endOfDay },
        },
      }),
      prisma.expense.findMany({
        where: {
          paymentMethod: "CASH",
          date: { gte: startOfDay, lte: endOfDay },
        },
      }),
      prisma.partnerWithdrawal.findMany({
        where: {
          paymentMethod: "CASH",
          date: { gte: startOfDay, lte: endOfDay },
        },
      }),
      prisma.partnerInvestment.findMany({
        where: {
          paymentMethod: "CASH",
          date: { gte: startOfDay, lte: endOfDay },
        },
      }),
    ]);

  const totalCollections = cashPayments.reduce((s, p) => s + p.amount, 0);
  const totalIncome = cashIncomes.reduce((s, i) => s + i.amount, 0);
  const totalExpenses = cashExpenses.reduce((s, e) => s + e.amount, 0);
  const totalWithdrawals = cashWithdrawals.reduce((s, w) => s + w.amount, 0);
  const totalInvestments = cashInvestments.reduce((s, i) => s + i.amount, 0);

  const currentCash = cashAccount?.currentBalance || 0;
  const openingCash = existingClosing ? existingClosing.openingCash : currentCash - (totalCollections + totalIncome + totalInvestments) + (totalExpenses + totalWithdrawals);
  const expectedClosingCash = openingCash + totalCollections + totalIncome + totalInvestments - totalExpenses - totalWithdrawals;

  return {
    date: targetDateStr,
    isClosed: existingClosing?.status === "CLOSED",
    existingRecord: existingClosing,
    openingCash,
    totalCollections,
    totalIncome,
    totalInvestments,
    totalExpenses,
    totalWithdrawals,
    expectedClosingCash,
    currentCashInHand: currentCash,
  };
}

export async function executeCloseDay(params: {
  date: string;
  actualCashCount: number;
  notes?: string;
  closedBy?: string;
}) {
  const info = await getDayClosingInfo(params.date);
  const difference = params.actualCashCount - info.expectedClosingCash;

  const record = await prisma.dailyClosing.upsert({
    where: { date: params.date },
    update: {
      openingCash: info.openingCash,
      totalCollections: info.totalCollections,
      totalIncome: info.totalIncome,
      totalExpenses: info.totalExpenses,
      totalWithdrawals: info.totalWithdrawals,
      closingCash: info.expectedClosingCash,
      actualCashCount: params.actualCashCount,
      difference,
      status: "CLOSED",
      closedAt: new Date(),
      closedBy: params.closedBy || "Admin",
      notes: params.notes,
    },
    create: {
      date: params.date,
      openingCash: info.openingCash,
      totalCollections: info.totalCollections,
      totalIncome: info.totalIncome,
      totalExpenses: info.totalExpenses,
      totalWithdrawals: info.totalWithdrawals,
      closingCash: info.expectedClosingCash,
      actualCashCount: params.actualCashCount,
      difference,
      status: "CLOSED",
      closedAt: new Date(),
      closedBy: params.closedBy || "Admin",
      notes: params.notes,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "DAY_CLOSE",
      entity: "DAILY_CLOSING",
      entityId: record.id,
      performedBy: params.closedBy || "Admin",
      details: `Day ${params.date} closed. Expected: ₹${info.expectedClosingCash}, Actual: ₹${params.actualCashCount}, Diff: ₹${difference}`,
    },
  });

  return record;
}
