import { prisma } from "@/lib/prisma";
import { getISTDayRange } from "@/lib/date";

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
        date: true,
        createdAt: true,
        loanCalculationType: true,
        advanceInterest: true,
        disbursedAmount: true,
        processingFee: true,
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

  // Authoritative Accounting Calculations
  const totalPartnerCapital = partners.reduce((sum, p) => sum + p.currentCapital, 0);
  const totalPartnerInvestment = investments.reduce((sum, i) => sum + i.amount, 0);
  const totalPartnerWithdrawal = withdrawals.reduce((sum, w) => sum + w.amount, 0);

  const totalMoneyGiven = loans.reduce((sum, l) => sum + l.principalAmount, 0);

  // Active / Overdue Loans
  const activeOrOverdueLoans = loans.filter((l) => l.status === "ACTIVE" || l.status === "OVERDUE");
  const totalPrincipalOutstanding = activeOrOverdueLoans.reduce((sum, l) => sum + l.principalOutstanding, 0);

  // Interest Outstanding:
  // For Advance Interest loans, upfront interest was deducted so remaining interest is ₹0.
  // For Standard / Reducing / Simple / Interest+Principal loans, legitimate interest is preserved.
  const totalInterestReceivable = activeOrOverdueLoans.reduce((sum, l) => {
    const isAdv = (l as any).loanCalculationType === "ADVANCE_INTEREST" || Boolean((l as any).advanceInterest && (l as any).advanceInterest > 0);
    return sum + (isAdv ? 0 : (l.interestOutstanding || 0));
  }, 0);
  const totalAmountReceivable = totalPrincipalOutstanding + totalInterestReceivable;

  const totalMoneyReceived = payments.reduce((sum, p) => sum + p.amount, 0);

  // Authoritative Interest Allocation:
  // Advance Interest is recognized upfront upon loan disbursement.
  // Standard/Reducing/Simple loans recognize legitimate interest collected via installments.
  // Advance Interest loans collect pure principal on installments (p.interestPortion = 0), preventing double-counting.
  const totalAdvanceInterest = loans.reduce((sum, l) => sum + (Number((l as any).advanceInterest) || 0), 0);
  const totalCollectionInterest = payments.reduce((sum, p) => sum + (p.interestPortion || 0), 0);
  const totalInterestReceived = totalAdvanceInterest + totalCollectionInterest;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalOtherIncome = incomes.reduce((sum, i) => sum + i.amount, 0);

  // Business Net Profit = (Interest Received + Other Income) - Expenses
  const totalRevenue = totalInterestReceived + totalOtherIncome;
  const totalBusinessProfit = totalRevenue - totalExpenses;
  const totalPartnerProfit = Math.max(0, Math.round(totalBusinessProfit * 0.5 * 100) / 100);

  // Authoritative Cash-in-Hand calculation:
  // Actual cash out on loan disbursement is customer-received (principal - advance interest - processing fee).
  // Cash remaining after disbursement: ₹1,50,000 - ₹1,32,000 = ₹18,000.
  // Actual Cash-in-Hand = ₹18,000 + Collections (₹1,500) - Expenses (₹85) = ₹19,415.
  const totalActualCashDisbursed = loans.reduce((sum, l) => {
    const lObj = l as any;
    const adv = Number(lObj.advanceInterest) || 0;
    const pFee = Number(lObj.processingFee) || 0;
    const disbursed = lObj.disbursedAmount && lObj.disbursedAmount > 0
      ? lObj.disbursedAmount
      : Math.max(0, l.principalAmount - adv - pFee);
    return sum + disbursed;
  }, 0);

  const cashInflows = (totalPartnerInvestment || totalPartnerCapital) + totalMoneyReceived + totalOtherIncome;
  const cashOutflows = totalActualCashDisbursed + totalExpenses + totalPartnerWithdrawal;
  const derivedAvailableCash = Math.max(0, Math.round((cashInflows - cashOutflows) * 100) / 100);

  // Self-heal cash account if needed
  if (cashAccount && cashAccount.currentBalance !== derivedAvailableCash) {
    try {
      await prisma.cashAccount.update({
        where: { id: "main-cash" },
        data: { currentBalance: derivedAvailableCash },
      });
    } catch {
      // Non-blocking
    }
  }

  const availableCash = derivedAvailableCash;
  const bankBalance = bankAccounts.reduce((sum, b) => sum + b.currentBalance, 0);

  const totalBusinessAssets =
    assets.reduce((sum, a) => sum + a.currentValue, 0) +
    availableCash +
    bankBalance +
    totalPrincipalOutstanding;

  const totalLiabilities = liabilities
    .filter((l) => l.status === "ACTIVE")
    .reduce((sum, l) => sum + l.amount, 0);

  // Today's Stats in Authoritative IST
  const todayRange = getISTDayRange();

  const [todayInstallments, todayPaymentsList] = await Promise.all([
    prisma.loanInstallment.findMany({
      where: {
        loan: { status: { in: ["ACTIVE", "OVERDUE"] } },
        dueDate: { gte: todayRange.start, lte: todayRange.end },
      },
      select: { installmentAmount: true, paidAmount: true, customerId: true },
    }),
    prisma.loanPayment.findMany({
      where: { date: { gte: todayRange.start, lte: todayRange.end } },
      select: { amount: true, principalPortion: true, interestPortion: true },
    }),
  ]);

  const todayDueAmount = todayInstallments.reduce((sum, i) => sum + i.installmentAmount, 0);
  const todayDueCount = todayInstallments.length;
  const todayCollectedOnDue = todayInstallments.reduce((sum, i) => sum + i.paidAmount, 0);

  const todayPendingInstallments = todayInstallments.filter((i) => i.paidAmount < i.installmentAmount);
  const todayPendingAmount = todayPendingInstallments.reduce(
    (sum, i) => sum + Math.max(0, i.installmentAmount - i.paidAmount),
    0
  );
  const todayPendingCustomers = new Set(todayPendingInstallments.map((i) => i.customerId)).size;

  const todayCollection = todayPaymentsList.reduce((sum, p) => sum + p.amount, 0);
  const todayExpenses = expenses.filter((e) => new Date(e.date) >= todayRange.start && new Date(e.date) <= todayRange.end).reduce((sum, e) => sum + e.amount, 0);
  const todayInvestment = investments.filter((i) => new Date(i.createdAt) >= todayRange.start && new Date(i.createdAt) <= todayRange.end).reduce((sum, i) => sum + i.amount, 0);
  const todayWithdrawal = withdrawals.filter((w) => new Date(w.createdAt) >= todayRange.start && new Date(w.createdAt) <= todayRange.end).reduce((sum, w) => sum + w.amount, 0);
  const todayProfit = todayCollection - todayExpenses;

  // Overdue Installments / Loans (Due strictly before today)
  const overdueInstallments = await prisma.loanInstallment.findMany({
    where: {
      loan: { status: { in: ["ACTIVE", "OVERDUE"] } },
      dueDate: { lt: todayRange.start },
      paidAmount: { lt: prisma.loanInstallment.fields.installmentAmount },
      status: { not: "COLLECTED" },
    },
    select: { installmentAmount: true, paidAmount: true, loanId: true },
  });

  const overdueAmounts = overdueInstallments.reduce(
    (sum, i) => sum + Math.max(0, i.installmentAmount - i.paidAmount),
    0
  );
  const overdueLoansCount = new Set(overdueInstallments.map((i) => i.loanId)).size;

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
    const mLoans = loans.filter((l) => {
      const lDate = new Date(l.date || l.createdAt);
      return lDate.getMonth() === m && lDate.getFullYear() === y;
    });

    const advIntAmount = mLoans.reduce((s, l) => s + (Number((l as any).advanceInterest) || 0), 0);
    const colAmount = mPayments.reduce((s, p) => s + p.amount, 0);
    const intAmount = advIntAmount + mPayments.reduce((s, p) => s + (p.interestPortion || 0), 0);
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
      todayDueAmount,
      todayDueCount,
      collection: todayCollection,
      todayCollection,
      todayCollectedAmount: todayCollection,
      todayCollectedOnDue,
      pendingCollections: todayPendingAmount,
      todayPendingAmount,
      todayPendingCustomers,
      todayPendingCount: todayPendingInstallments.length,
      expense: todayExpenses,
      investment: todayInvestment,
      withdrawal: todayWithdrawal,
      profit: todayProfit,
      overdueAmounts,
      overdueCount: overdueLoansCount,
    },
    charts: {
      monthly: monthlyChartData,
    },
    reminders,
  };
}
