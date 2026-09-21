import { prisma } from "@/lib/prisma";

export const CHART_OF_ACCOUNTS = [
  // Assets
  { code: "1010", name: "Cash-in-Hand", type: "ASSET" },
  { code: "1020", name: "Bank Accounts", type: "ASSET" },
  { code: "1030", name: "Loans Receivable", type: "ASSET" },
  { code: "1040", name: "Product Inventory", type: "ASSET" },
  { code: "1050", name: "Fixed Business Assets", type: "ASSET" },

  // Liabilities
  { code: "2010", name: "Borrowed Loans (Loans Taken)", type: "LIABILITY" },
  { code: "2020", name: "Supplier Payables", type: "LIABILITY" },
  { code: "2030", name: "Partner Payables", type: "LIABILITY" },

  // Equity
  { code: "3010", name: "Owner Capital", type: "EQUITY" },
  { code: "3020", name: "Partner Capital", type: "EQUITY" },
  { code: "3030", name: "Retained Earnings / Profit", type: "EQUITY" },

  // Revenue
  { code: "4010", name: "Interest Income", type: "REVENUE" },
  { code: "4020", name: "Business Sales Income", type: "REVENUE" },
  { code: "4030", name: "Processing Fees & Other Income", type: "REVENUE" },

  // Expenses
  { code: "5010", name: "Operating Expenses", type: "EXPENSE" },
  { code: "5020", name: "Interest Paid Expense", type: "EXPENSE" },
  { code: "5030", name: "Cost of Goods Sold / Purchases", type: "EXPENSE" },
];

export async function ensureDefaultAccounts() {
  for (const acct of CHART_OF_ACCOUNTS) {
    const existing = await prisma.ledgerAccount.findUnique({
      where: { code: acct.code },
    });
    if (!existing) {
      await prisma.ledgerAccount.create({
        data: {
          code: acct.code,
          name: acct.name,
          type: acct.type,
          balance: 0,
        },
      });
    }
  }

  // Ensure cash account exists
  const cash = await prisma.cashAccount.findUnique({
    where: { id: "main-cash" },
  });
  if (!cash) {
    await prisma.cashAccount.create({
      data: {
        id: "main-cash",
        name: "Cash-in-Hand",
        openingBalance: 0,
        currentBalance: 0,
      },
    });
  }
}

interface PostingEntry {
  accountCode: string;
  entryType: "DEBIT" | "CREDIT";
  amount: number;
}

interface PostTransactionParams {
  date?: Date;
  description: string;
  referenceType?: string;
  referenceId?: string;
  entries: PostingEntry[];
}

export async function postTransaction(params: PostTransactionParams) {
  await ensureDefaultAccounts();

  const totalDebits = params.entries
    .filter((e) => e.entryType === "DEBIT")
    .reduce((sum, e) => sum + e.amount, 0);

  const totalCredits = params.entries
    .filter((e) => e.entryType === "CREDIT")
    .reduce((sum, e) => sum + e.amount, 0);

  // Financial verification: Debits must equal Credits (with small float tolerance)
  if (Math.abs(totalDebits - totalCredits) > 0.01) {
    throw new Error(
      `Double entry mismatch! Total Debits (${totalDebits.toFixed(2)}) must equal Total Credits (${totalCredits.toFixed(2)})`
    );
  }

  const transactionNo = `TXN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const ledgerTxn = await prisma.ledgerTransaction.create({
    data: {
      transactionNo,
      date: params.date || new Date(),
      description: params.description,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      debitTotal: totalDebits,
      creditTotal: totalCredits,
    },
  });

  for (const entry of params.entries) {
    const account = await prisma.ledgerAccount.findUnique({
      where: { code: entry.accountCode },
    });

    if (!account) {
      throw new Error(`Ledger account with code ${entry.accountCode} not found.`);
    }

    await prisma.ledgerEntry.create({
      data: {
        ledgerTransactionId: ledgerTxn.id,
        accountId: account.id,
        entryType: entry.entryType,
        amount: entry.amount,
      },
    });

    // Update Account Balance
    // For ASSET and EXPENSE: DEBIT increases balance (+), CREDIT decreases balance (-)
    // For LIABILITY, EQUITY, REVENUE: CREDIT increases balance (+), DEBIT decreases balance (-)
    let balanceDelta = 0;
    if (account.type === "ASSET" || account.type === "EXPENSE") {
      balanceDelta = entry.entryType === "DEBIT" ? entry.amount : -entry.amount;
    } else {
      balanceDelta = entry.entryType === "CREDIT" ? entry.amount : -entry.amount;
    }

    await prisma.ledgerAccount.update({
      where: { id: account.id },
      data: {
        balance: { increment: balanceDelta },
      },
    });
  }

  return ledgerTxn;
}

// 1. Partner Investment
export async function postPartnerInvestment(params: {
  partnerId: string;
  partnerName: string;
  amount: number;
  paymentMethod: string;
  referenceNo?: string;
}) {
  const assetAccountCode = params.paymentMethod === "CASH" ? "1010" : "1020";

  // Update Cash-in-hand or Bank
  if (params.paymentMethod === "CASH") {
    await prisma.cashAccount.update({
      where: { id: "main-cash" },
      data: { currentBalance: { increment: params.amount } },
    });
  }

  return await postTransaction({
    description: `Partner Investment from ${params.partnerName}`,
    referenceType: "INVESTMENT",
    referenceId: params.partnerId,
    entries: [
      { accountCode: assetAccountCode, entryType: "DEBIT", amount: params.amount },
      { accountCode: "3020", entryType: "CREDIT", amount: params.amount }, // Partner Capital
    ],
  });
}

// 2. Partner Withdrawal
export async function postPartnerWithdrawal(params: {
  partnerId: string;
  partnerName: string;
  amount: number;
  paymentMethod: string;
  referenceNo?: string;
}) {
  const assetAccountCode = params.paymentMethod === "CASH" ? "1010" : "1020";

  if (params.paymentMethod === "CASH") {
    await prisma.cashAccount.update({
      where: { id: "main-cash" },
      data: { currentBalance: { decrement: params.amount } },
    });
  }

  return await postTransaction({
    description: `Partner Withdrawal by ${params.partnerName}`,
    referenceType: "WITHDRAWAL",
    referenceId: params.partnerId,
    entries: [
      { accountCode: "3020", entryType: "DEBIT", amount: params.amount }, // Reduce Partner Capital
      { accountCode: assetAccountCode, entryType: "CREDIT", amount: params.amount },
    ],
  });
}

// 3. Loan Given (Money Given)
export async function postLoanDisbursement(params: {
  loanId: string;
  customerName: string;
  principalAmount: number;
  paymentMethod: string;
}) {
  const assetAccountCode = params.paymentMethod === "CASH" ? "1010" : "1020";

  if (params.paymentMethod === "CASH") {
    await prisma.cashAccount.update({
      where: { id: "main-cash" },
      data: { currentBalance: { decrement: params.principalAmount } },
    });
  }

  return await postTransaction({
    description: `Loan Disbursed to ${params.customerName}`,
    referenceType: "LOAN_GIVEN",
    referenceId: params.loanId,
    entries: [
      { accountCode: "1030", entryType: "DEBIT", amount: params.principalAmount }, // Loans Receivable increases
      { accountCode: assetAccountCode, entryType: "CREDIT", amount: params.principalAmount },
    ],
  });
}

// 4. Loan Collection (Principal + Interest)
export async function postLoanCollection(params: {
  loanId: string;
  customerName: string;
  totalAmount: number;
  principalPortion: number;
  interestPortion: number;
  paymentMethod: string;
  date?: Date;
}) {
  const assetAccountCode = params.paymentMethod === "CASH" ? "1010" : "1020";

  if (params.paymentMethod === "CASH") {
    await prisma.cashAccount.update({
      where: { id: "main-cash" },
      data: { currentBalance: { increment: params.totalAmount } },
    });
  }

  const entries: PostingEntry[] = [
    { accountCode: assetAccountCode, entryType: "DEBIT", amount: params.totalAmount },
  ];

  if (params.principalPortion > 0) {
    entries.push({
      accountCode: "1030", // Loans Receivable reduces
      entryType: "CREDIT",
      amount: params.principalPortion,
    });
  }

  if (params.interestPortion > 0) {
    entries.push({
      accountCode: "4010", // Interest Income
      entryType: "CREDIT",
      amount: params.interestPortion,
    });
  }

  return await postTransaction({
    date: params.date,
    description: `Collection from ${params.customerName} (Prin: ₹${params.principalPortion}, Int: ₹${params.interestPortion})`,
    referenceType: "COLLECTION",
    referenceId: params.loanId,
    entries,
  });
}

// 5. Business Expense
export async function postExpensePosting(params: {
  expenseId: string;
  category: string;
  amount: number;
  paymentMethod: string;
  description: string;
}) {
  const assetAccountCode = params.paymentMethod === "CASH" ? "1010" : "1020";

  if (params.paymentMethod === "CASH") {
    await prisma.cashAccount.update({
      where: { id: "main-cash" },
      data: { currentBalance: { decrement: params.amount } },
    });
  }

  return await postTransaction({
    description: `Expense: ${params.category} - ${params.description}`,
    referenceType: "EXPENSE",
    referenceId: params.expenseId,
    entries: [
      { accountCode: "5010", entryType: "DEBIT", amount: params.amount }, // Operating Expense
      { accountCode: assetAccountCode, entryType: "CREDIT", amount: params.amount },
    ],
  });
}

// 6. Additional Income
export async function postIncomePosting(params: {
  incomeId: string;
  type: string;
  amount: number;
  paymentMethod: string;
  description: string;
}) {
  const assetAccountCode = params.paymentMethod === "CASH" ? "1010" : "1020";

  if (params.paymentMethod === "CASH") {
    await prisma.cashAccount.update({
      where: { id: "main-cash" },
      data: { currentBalance: { increment: params.amount } },
    });
  }

  return await postTransaction({
    description: `Income: ${params.type} - ${params.description}`,
    referenceType: "INCOME",
    referenceId: params.incomeId,
    entries: [
      { accountCode: assetAccountCode, entryType: "DEBIT", amount: params.amount },
      { accountCode: "4030", entryType: "CREDIT", amount: params.amount }, // Other Income
    ],
  });
}
