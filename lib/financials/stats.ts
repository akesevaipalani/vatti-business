import { prisma } from "@/lib/prisma";

export async function getDashboardFinancialStats() {
  const [
    partners,
    investments,
    withdrawals,
    loans,
    payments,
    expenses,
    incomes,
    cashAccount,
    bankAccounts,
    assets,
    liabilities,
    reminders,
  ] = await Promise.all([
    prisma.partner.findMany({ select: { currentCapital: true, initialCapital: true } }),
    prisma.partnerInvestment.findMany({ select: { amount: true, createdAt: true } }),
    prisma.partnerWithdrawal.findMany({ select: { amount: true, createdAt: true } }),
    prisma.loan.findMany({
      select: {
        principalAmount: true,
        principalOutstanding: true,
        interestOutstanding: true,
        totalPayable: true,
        principalPaid: true,
        interestPaid: true,
        status: true,
        dueDate: true,
        createdAt: true,
      },
    }),
    prisma.loanPayment.findMany({
      select: {
        amount: true,
        principalPortion: true,
        interestPortion: true,
        date: true,
        paymentMethod: true,
      },
    }),
    prisma.expense.findMany({ select: { amount: true, date: true, category: true } }),
    prisma.income.findMany({ select: { amount: true, date: true, type: true } }),
    prisma.cashAccount.findUnique({ where: { id: "main-cash" } }),
    prisma.bankAccount.findMany({ select: { currentBalance: true } }),
    prisma.asset.findMany({ select: { currentValue: true } }),
    prisma.liability.findMany({ select: { amount: true, status: true } }),
    prisma.reminder.findMany({ where: { isCompleted: false }, orderBy: { dueDate: "asc" }, take: 5 }),
  ]);

  // Calculations
  const totalPartnerCapital = partners.reduce((sum, p) => sum + p.currentCapital, 0);
  const totalPartnerInvestment = investments.reduce((sum, i) => sum + i.amount, 0);
  const totalPartnerWithdrawal = withdrawals.reduce((sum, w) => sum + w.amount, 0);

  const totalMoneyGiven = loans.reduce((sum, l) => sum + l.principalAmount, 0);
  const totalPrincipalOutstanding = loans
    .filter((l) => l.status === "ACTIVE" || l.status === "OVERDUE")
    .reduce((sum, l) => sum + l.principalOutstanding, 0);
  const totalInterestReceivable = loans
    .filter((l) => l.status === "ACTIVE" || l.status === "OVERDUE")
    .reduce((sum, l) => sum + l.interestOutstanding, 0);
  const totalAmountReceivable = totalPrincipalOutstanding + totalInterestReceivable;

  const totalMoneyReceived = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalInterestReceived = payments.reduce((sum, p) => sum + p.interestPortion, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalOtherIncome = incomes.reduce((sum, i) => sum + i.amount, 0);

  // Business Net Profit = (Interest Received + Other Income) - Expenses
  const totalRevenue = totalInterestReceived + totalOtherIncome;
  const totalBusinessProfit = totalRevenue - totalExpenses;
  const totalPartnerProfit = Math.max(0, totalBusinessProfit * 0.5); // Allocated share

  const totalBusinessAssets =
    assets.reduce((sum, a) => sum + a.currentValue, 0) +
    (cashAccount?.currentBalance || 0) +
    bankAccounts.reduce((sum, b) => sum + b.currentBalance, 0) +
    totalPrincipalOutstanding;

  const totalLiabilities = liabilities
    .filter((l) => l.status === "ACTIVE")
    .reduce((sum, l) => sum + l.amount, 0);

  const availableCash = cashAccount?.currentBalance || 0;
  const bankBalance = bankAccounts.reduce((sum, b) => sum + b.currentBalance, 0);

  // Today's Stats
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayPayments = payments.filter((p) => new Date(p.date) >= todayStart);
  const todayCollection = todayPayments.reduce((sum, p) => sum + p.amount, 0);
  const todayExpenses = expenses.filter((e) => new Date(e.date) >= todayStart).reduce((sum, e) => sum + e.amount, 0);
  const todayInvestment = investments.filter((i) => new Date(i.createdAt) >= todayStart).reduce((sum, i) => sum + i.amount, 0);
  const todayWithdrawal = withdrawals.filter((w) => new Date(w.createdAt) >= todayStart).reduce((sum, w) => sum + w.amount, 0);
  const todayProfit = todayCollection - todayExpenses;

  // Overdue Loans
  const now = new Date();
  const overdueLoans = loans.filter(
    (l) => l.status === "ACTIVE" && l.dueDate && new Date(l.dueDate) < now
  );
  const overdueAmounts = overdueLoans.reduce(
    (sum, l) => sum + l.principalOutstanding + l.interestOutstanding,
    0
  );

  // Monthly breakdown for charts (Last 6 Months)
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyChartData = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const m = d.getMonth();
    const y = d.getFullYear();

    const mPayments = payments.filter((p) => {
      const pDate = new Date(p.date);
      return pDate.getMonth() === m && pDate.getFullYear() === y;
    });
    const mExpenses = expenses.filter((e) => {
      const eDate = new Date(e.date);
      return eDate.getMonth() === m && eDate.getFullYear() === y;
    });

    const colAmount = mPayments.reduce((s, p) => s + p.amount, 0);
    const intAmount = mPayments.reduce((s, p) => s + p.interestPortion, 0);
    const expAmount = mExpenses.reduce((s, e) => s + e.amount, 0);
    const profitAmount = intAmount - expAmount;

    monthlyChartData.push({
      name: `${monthNames[m]} ${y.toString().slice(-2)}`,
      collections: colAmount,
      interest: intAmount,
      expenses: expAmount,
      profit: profitAmount,
    });
  }

  return {
    kpis: {
      totalCapital: totalPartnerCapital + totalBusinessProfit,
      totalPartnerInvestment,
      totalPartnerCapital,
      totalPartnerWithdrawal,
      totalMoneyGiven,
      totalPrincipalOutstanding,
      totalInterestReceivable,
      totalAmountReceivable,
      totalMoneyReceived,
      totalInterestReceived,
      totalExpenses,
      totalBusinessProfit,
      totalPartnerProfit,
      totalBusinessAssets,
      totalLiabilities,
      availableCash,
      bankBalance,
    },
    today: {
      collection: todayCollection,
      expense: todayExpenses,
      investment: todayInvestment,
      withdrawal: todayWithdrawal,
      profit: todayProfit,
      pendingCollections: totalAmountReceivable,
      overdueAmounts,
      overdueCount: overdueLoans.length,
    },
    charts: {
      monthly: monthlyChartData,
    },
    reminders,
  };
}
