import { prisma } from "@/lib/prisma";
import crypto from "crypto";

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

let defaultAccountsEnsured = false;
export async function ensureDefaultAccounts() {
  if (defaultAccountsEnsured) return;

  const existing = await prisma.ledgerAccount.findMany({ select: { code: true } });
  const existingCodes = new Set(existing.map((a) => a.code));
  const missing = CHART_OF_ACCOUNTS.filter((a) => !existingCodes.has(a.code));
  if (missing.length > 0) {
    for (const acct of missing) {
      await prisma.ledgerAccount.upsert({
        where: { code: acct.code },
        update: {},
        create: {
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
  defaultAccountsEnsured = true;
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

  // Batch query all referenced accounts in a single round trip
  const requiredCodes = Array.from(new Set(params.entries.map((e) => e.accountCode)));
  const accounts = await prisma.ledgerAccount.findMany({
    where: { code: { in: requiredCodes } },
  });
  const accountMap = new Map(accounts.map((a) => [a.code, a]));

  for (const entry of params.entries) {
    if (!accountMap.has(entry.accountCode)) {
      throw new Error(`Ledger account with code ${entry.accountCode} not found.`);
    }
  }

  // Batch insert ledger entries
  const entryRecords = params.entries.map((entry) => {
    const account = accountMap.get(entry.accountCode)!;
    return {
      id: crypto.randomUUID(),
      ledgerTransactionId: ledgerTxn.id,
      accountId: account.id,
      entryType: entry.entryType,
      amount: entry.amount,
    };
  });
  await prisma.ledgerEntry.createMany({ data: entryRecords });

  // Compute aggregated delta per account to update balances efficiently
  const deltaMap = new Map<string, number>();
  for (const entry of params.entries) {
    const account = accountMap.get(entry.accountCode)!;
    let balanceDelta = 0;
    if (account.type === "ASSET" || account.type === "EXPENSE") {
      balanceDelta = entry.entryType === "DEBIT" ? entry.amount : -entry.amount;
    } else {
      balanceDelta = entry.entryType === "CREDIT" ? entry.amount : -entry.amount;
    }
    deltaMap.set(account.id, (deltaMap.get(account.id) || 0) + balanceDelta);
  }

  await Promise.all(
    Array.from(deltaMap.entries()).map(([accountId, balanceDelta]) =>
      prisma.ledgerAccount.update({
        where: { id: accountId },
        data: { balance: { increment: balanceDelta } },
      })
    )
  );

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
  customerReceives?: number;
  advanceInterest?: number;
  processingFee?: number;
  paymentMethod: string;
}) {
  const assetAccountCode = params.paymentMethod === "CASH" ? "1010" : "1020";
  const advInt = Number(params.advanceInterest) || 0;
  const pFee = Number(params.processingFee) || 0;
  const cashDisbursed = params.customerReceives !== undefined && params.customerReceives >= 0
    ? params.customerReceives
    : Math.max(0, params.principalAmount - advInt - pFee);

  if (params.paymentMethod === "CASH") {
    await prisma.cashAccount.update({
      where: { id: "main-cash" },
      data: { currentBalance: { decrement: cashDisbursed } },
    });
  }

  const entries: PostingEntry[] = [
    { accountCode: "1030", entryType: "DEBIT", amount: params.principalAmount }, // Loans Receivable = Face Amount
    { accountCode: assetAccountCode, entryType: "CREDIT", amount: cashDisbursed }, // Cash out
  ];

  if (advInt > 0) {
    entries.push({
      accountCode: "4010", // Advance Interest Income earned upfront
      entryType: "CREDIT",
      amount: advInt,
    });
  }

  if (pFee > 0) {
    entries.push({
      accountCode: "4030", // Processing Fees & Other Income earned upfront
      entryType: "CREDIT",
      amount: pFee,
    });
  }

  return await postTransaction({
    description: `Loan Disbursed to ${params.customerName}${advInt > 0 ? ` (Adv Int: ₹${advInt})` : ""}`,
    referenceType: "LOAN_GIVEN",
    referenceId: params.loanId,
    entries,
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
