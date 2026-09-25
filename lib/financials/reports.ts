import { prisma } from "@/lib/prisma";

export async function generateProfitAndLossReport(startDate?: Date, endDate?: Date) {
  const dateFilter = {
    ...(startDate ? { gte: startDate } : {}),
    ...(endDate ? { lte: endDate } : {}),
  };

  const hasDateFilter = startDate || endDate;

  const [payments, incomes, expenses, borrowedLoans] = await Promise.all([
    prisma.loanPayment.findMany({
      where: hasDateFilter ? { date: dateFilter } : undefined,
      select: { interestPortion: true, lateFeePortion: true },
    }),
    prisma.income.findMany({
      where: hasDateFilter ? { date: dateFilter } : undefined,
      select: { amount: true, type: true },
    }),
    prisma.expense.findMany({
      where: hasDateFilter ? { date: dateFilter } : undefined,
      select: { amount: true, category: true },
    }),
    prisma.borrowedLoan.findMany({
      select: { interestPaid: true },
    }),
  ]);

  const interestIncome = payments.reduce((sum, p) => sum + p.interestPortion, 0);
  const otherIncome = incomes.reduce((sum, i) => sum + i.amount, 0);
  const totalRevenue = interestIncome + otherIncome;

  const operatingExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const interestExpense = borrowedLoans.reduce((sum, b) => sum + b.interestPaid, 0);
  const totalExpenses = operatingExpenses + interestExpense;

  const netProfit = totalRevenue - totalExpenses;

  // Breakdown by category
  const expenseByCategory: Record<string, number> = {};
  for (const exp of expenses) {
    expenseByCategory[exp.category] = (expenseByCategory[exp.category] || 0) + exp.amount;
  }

  const incomeByType: Record<string, number> = {
    "LOAN_INTEREST": interestIncome,
  };
  for (const inc of incomes) {
    incomeByType[inc.type] = (incomeByType[inc.type] || 0) + inc.amount;
  }

  return {
    period: {
      startDate: startDate ? startDate.toISOString() : "Beginning",
      endDate: endDate ? endDate.toISOString() : "Present",
    },
    revenue: {
      interestIncome,
      otherIncome,
      totalRevenue,
      incomeByType,
    },
    expenses: {
      operatingExpenses,
      interestExpense,
      totalExpenses,
      expenseByCategory,
    },
    grossProfit: totalRevenue,
    netProfit,
  };
}

export async function generateBalanceSheetReport() {
  const [
    cashAccount,
    ledgerCashAccount,
    bankAccounts,
    activeLoans,
    assets,
    borrowedLoans,
    liabilities,
    partners,
  ] = await Promise.all([
    prisma.cashAccount.findUnique({ where: { id: "main-cash" } }),
    prisma.ledgerAccount.findUnique({ where: { code: "1010" } }),
    prisma.bankAccount.findMany(),
    prisma.loan.findMany({ where: { status: { in: ["ACTIVE", "OVERDUE"] } } }),
    prisma.asset.findMany({ where: { status: "ACTIVE" } }),
    prisma.borrowedLoan.findMany({ where: { status: "ACTIVE" } }),
    prisma.liability.findMany({ where: { status: "ACTIVE" } }),
    prisma.partner.findMany({ where: { status: "ACTIVE" } }),
  ]);

  // Authoritative Cash-in-Hand from General Ledger (code 1010), falling back to cashAccount
  const cashInHand = ledgerCashAccount ? ledgerCashAccount.balance : (cashAccount?.currentBalance || 0);
  const bankTotal = bankAccounts.reduce((sum, b) => sum + b.currentBalance, 0);
  const loansReceivable = activeLoans.reduce((sum, l) => sum + l.principalOutstanding, 0);
  const interestReceivable = activeLoans.reduce((sum, l) => sum + l.interestOutstanding, 0);
  const fixedAssetsTotal = assets.reduce((sum, a) => sum + a.currentValue, 0);

  const totalAssets = cashInHand + bankTotal + loansReceivable + fixedAssetsTotal;

  const loansPayable = borrowedLoans.reduce((sum, b) => sum + b.balanceAmount, 0);
  const otherLiabilities = liabilities.reduce((sum, l) => sum + l.amount, 0);
  const totalLiabilities = loansPayable + otherLiabilities;

  const partnerCapitalTotal = partners.reduce((sum, p) => sum + p.currentCapital, 0);
  const plReport = await generateProfitAndLossReport();
  const retainedProfit = plReport.netProfit;

  const totalCapital = partnerCapitalTotal + retainedProfit;

  return {
    asOfDate: new Date().toISOString(),
    assets: {
      cashInHand,
      bankTotal,
      loansReceivable,
      interestReceivable,
      fixedAssetsTotal,
      totalAssets,
    },
    liabilities: {
      loansPayable,
      otherLiabilities,
      totalLiabilities,
    },
    capital: {
      partnerCapitalTotal,
      retainedProfit,
      totalCapital,
    },
    isBalanced: Math.abs(totalAssets - (totalLiabilities + totalCapital)) < 1,
    difference: totalAssets - (totalLiabilities + totalCapital),
  };
}

export async function generateCashFlowReport(startDate?: Date, endDate?: Date) {
  const dateFilter = {
    ...(startDate ? { gte: startDate } : {}),
    ...(endDate ? { lte: endDate } : {}),
  };
  const hasDateFilter = startDate || endDate;

  const [cashPayments, cashIncomes, cashInvestments, cashLoans, cashExpenses, cashWithdrawals, cashAccount, ledgerCashAccount] =
    await Promise.all([
      prisma.loanPayment.findMany({
        where: {
          paymentMethod: "CASH",
          ...(hasDateFilter ? { date: dateFilter } : {}),
        },
      }),
      prisma.income.findMany({
        where: {
          paymentMethod: "CASH",
          ...(hasDateFilter ? { date: dateFilter } : {}),
        },
      }),
      prisma.partnerInvestment.findMany({
        where: {
          paymentMethod: "CASH",
          ...(hasDateFilter ? { date: dateFilter } : {}),
        },
      }),
      prisma.loan.findMany({
        where: hasDateFilter ? { date: dateFilter } : undefined,
      }),
      prisma.expense.findMany({
        where: {
          paymentMethod: "CASH",
          ...(hasDateFilter ? { date: dateFilter } : {}),
        },
      }),
      prisma.partnerWithdrawal.findMany({
        where: {
          paymentMethod: "CASH",
          ...(hasDateFilter ? { date: dateFilter } : {}),
        },
      }),
      prisma.cashAccount.findUnique({ where: { id: "main-cash" } }),
      prisma.ledgerAccount.findUnique({ where: { code: "1010" } }),
    ]);

  const collectionsIn = cashPayments.reduce((s, p) => s + p.amount, 0);
  const incomeIn = cashIncomes.reduce((s, i) => s + i.amount, 0);
  const investmentIn = cashInvestments.reduce((s, i) => s + i.amount, 0);
  const totalInflows = collectionsIn + incomeIn + investmentIn;

  const loansDisbursedOut = cashLoans.reduce((s, l) => s + l.principalAmount, 0);
  const expensesOut = cashExpenses.reduce((s, e) => s + e.amount, 0);
  const withdrawalsOut = cashWithdrawals.reduce((s, w) => s + w.amount, 0);
  const totalOutflows = expensesOut + withdrawalsOut + loansDisbursedOut;

  const netCashFlow = totalInflows - totalOutflows;
  const currentCashBalance = ledgerCashAccount ? ledgerCashAccount.balance : (cashAccount?.currentBalance || 0);

  return {
    inflows: {
      collections: collectionsIn,
      income: incomeIn,
      investments: investmentIn,
      totalInflows,
    },
    outflows: {
      loansDisbursed: loansDisbursedOut,
      expenses: expensesOut,
      withdrawals: withdrawalsOut,
      totalOutflows,
    },
    netCashFlow,
    currentCashBalance,
  };
}
