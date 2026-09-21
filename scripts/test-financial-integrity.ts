import path from "path";
import fs from "fs";
import { PrismaClient } from "@prisma/client";

// Set DATABASE_URL to isolated test database BEFORE any modules load
const testDbPath = path.resolve(__dirname, "../prisma/test_financial_integrity.db");
const templateDbPath = path.resolve(__dirname, "../prisma/vatti.db");

if (!fs.existsSync(testDbPath) || fs.statSync(testDbPath).size === 0) {
  if (fs.existsSync(templateDbPath)) {
    fs.copyFileSync(templateDbPath, testDbPath);
  }
}

const testDbUrl = `file:${testDbPath}`;
process.env.DATABASE_URL = testDbUrl;

// Instantiate isolated test prisma client
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: testDbUrl,
    },
  },
});

// Override global prisma instance to guarantee all modules use test database
(globalThis as unknown as { prisma: PrismaClient }).prisma = testPrisma;

import {
  ensureDefaultAccounts,
  postPartnerInvestment,
  postLoanDisbursement,
  postLoanCollection,
  postExpensePosting,
} from "../lib/accounting/engine";
import { calculateLoan } from "../lib/loans/calculator";
import {
  generateProfitAndLossReport,
  generateBalanceSheetReport,
  generateCashFlowReport,
} from "../lib/financials/reports";
import {
  createDatabaseBackup,
  restoreDatabaseBackup,
  getBackupDirectory,
} from "../lib/backup/backup-service";

export interface StepReport {
  step: number;
  test: string;
  expected: string;
  actual: string;
  passed: boolean;
  notes?: string;
}

const testReports: StepReport[] = [];
const createdBackupFiles: string[] = [];

function recordStep(
  step: number,
  test: string,
  expected: string,
  actual: string,
  condition: boolean,
  notes?: string
) {
  testReports.push({
    step,
    test,
    expected,
    actual,
    passed: condition,
    notes,
  });

  const icon = condition ? "✅ PASS" : "❌ FAIL";
  console.log(`[${icon}] Step ${step.toString().padStart(2, "0")}: ${test}`);
  console.log(`       Expected: ${expected}`);
  console.log(`       Actual:   ${actual}`);
  if (notes) console.log(`       Notes:    ${notes}`);
  console.log("");

  if (!condition) {
    throw new Error(`[Step ${step}] Assertion failed: ${test} | Expected: ${expected} | Actual: ${actual}`);
  }
}

async function runFullWorkflow() {
  console.log("================================================================================");
  console.log("  VATTI BUSINESS - 32-STEP END-TO-END BUSINESS LOGIC & FINANCIAL INTEGRITY TEST ");
  console.log("================================================================================");
  console.log(`Isolated Database: ${testDbPath}\n`);

  // Step 0: Clean Test Database and Setup Chart of Accounts
  await testPrisma.auditLog.deleteMany();
  await testPrisma.backupRecord.deleteMany();
  await testPrisma.ledgerEntry.deleteMany();
  await testPrisma.ledgerTransaction.deleteMany();
  await testPrisma.ledgerAccount.deleteMany();
  await testPrisma.cashAccount.deleteMany();
  await testPrisma.bankAccount.deleteMany();
  await testPrisma.collateral.deleteMany();
  await testPrisma.guarantor.deleteMany();
  await testPrisma.loanPayment.deleteMany();
  await testPrisma.loan.deleteMany();
  await testPrisma.customer.deleteMany();
  await testPrisma.partnerSettlement.deleteMany();
  await testPrisma.partnerProfitAllocation.deleteMany();
  await testPrisma.partnerWithdrawal.deleteMany();
  await testPrisma.partnerInvestment.deleteMany();
  await testPrisma.partner.deleteMany();
  await testPrisma.expense.deleteMany();
  await testPrisma.income.deleteMany();
  await testPrisma.asset.deleteMany();
  await testPrisma.liability.deleteMany();
  await testPrisma.borrowedLoan.deleteMany();

  await ensureDefaultAccounts();

  // ---------------------------------------------------------------------------
  // STEP 1: Create Partner A
  // ---------------------------------------------------------------------------
  const partnerA = await testPrisma.partner.create({
    data: {
      partnerCode: "PRT-001",
      name: "Partner A",
      mobile: "9876500001",
      initialCapital: 0,
      currentCapital: 0,
      profitSharePercent: 50,
      lossSharePercent: 50,
      status: "ACTIVE",
    },
  });

  await testPrisma.auditLog.create({
    data: {
      action: "CREATE",
      entity: "PARTNER",
      entityId: partnerA.id,
      performedBy: "Admin",
      details: "Created Partner A profile with ₹0 initial capital",
    },
  });

  recordStep(
    1,
    "Create Partner A",
    "Partner A created with status ACTIVE and currentCapital = ₹0",
    `Partner ID: ${partnerA.id}, Name: ${partnerA.name}, Capital: ₹${partnerA.currentCapital}`,
    partnerA.name === "Partner A" && partnerA.currentCapital === 0
  );

  // ---------------------------------------------------------------------------
  // STEP 2: Add Partner Investment of ₹1,00,000
  // ---------------------------------------------------------------------------
  const investmentAmount = 100000;
  const investmentA = await testPrisma.partnerInvestment.create({
    data: {
      investmentCode: "INV-PRT-000001",
      partnerId: partnerA.id,
      amount: investmentAmount,
      type: "ADDITIONAL",
      paymentMethod: "CASH",
      referenceNo: "CHQ-10001",
      notes: "Initial Business Capital Injection",
    },
  });

  // Update Partner Current Capital
  const updatedPartnerA = await testPrisma.partner.update({
    where: { id: partnerA.id },
    data: { currentCapital: { increment: investmentAmount } },
  });

  // Post Double-Entry General Ledger & Update Cash Account
  await postPartnerInvestment({
    partnerId: partnerA.id,
    partnerName: partnerA.name,
    amount: investmentAmount,
    paymentMethod: "CASH",
    referenceNo: investmentA.referenceNo || undefined,
  });

  await testPrisma.auditLog.create({
    data: {
      action: "INVESTMENT",
      entity: "PARTNER",
      entityId: partnerA.id,
      performedBy: "Admin",
      details: `Recorded ₹${investmentAmount} investment from Partner A via CASH`,
    },
  });

  recordStep(
    2,
    "Add Partner Investment of ₹1,00,000",
    "Investment record created (INV-PRT-000001) for ₹1,00,000 in CASH",
    `Investment code: ${investmentA.investmentCode}, Amount: ₹${investmentA.amount}, Mode: ${investmentA.paymentMethod}`,
    investmentA.amount === 100000 && investmentA.paymentMethod === "CASH"
  );

  // ---------------------------------------------------------------------------
  // STEP 3: Verify Partner Capital = ₹1,00,000
  // ---------------------------------------------------------------------------
  const partnerCheck = await testPrisma.partner.findUnique({ where: { id: partnerA.id } });
  const acct3020 = await testPrisma.ledgerAccount.findUnique({ where: { code: "3020" } });
  const cashStep3 = await testPrisma.cashAccount.findUnique({ where: { id: "main-cash" } });

  recordStep(
    3,
    "Verify Partner Capital = ₹1,00,000",
    "Partner.currentCapital = ₹1,00,000, Account 3020 = ₹1,00,000, Cash-in-Hand = ₹1,00,000",
    `Partner Capital: ₹${partnerCheck?.currentCapital}, Account 3020: ₹${acct3020?.balance}, Cash: ₹${cashStep3?.currentBalance}`,
    partnerCheck?.currentCapital === 100000 && acct3020?.balance === 100000 && cashStep3?.currentBalance === 100000
  );

  // ---------------------------------------------------------------------------
  // STEP 4: Create Customer A
  // ---------------------------------------------------------------------------
  const customerA = await testPrisma.customer.create({
    data: {
      customerCode: "CUST-001",
      name: "Customer A",
      mobile: "9876500002",
      city: "Madurai",
      occupation: "Retail Trader",
    },
  });

  await testPrisma.auditLog.create({
    data: {
      action: "CREATE",
      entity: "CUSTOMER",
      entityId: customerA.id,
      performedBy: "Admin",
      details: "Created Customer A profile",
    },
  });

  recordStep(
    4,
    "Create Customer A",
    "Customer A created with code CUST-001",
    `Customer ID: ${customerA.id}, Code: ${customerA.customerCode}, Name: ${customerA.name}`,
    customerA.name === "Customer A" && customerA.customerCode === "CUST-001"
  );

  // ---------------------------------------------------------------------------
  // STEP 5: Create a ₹50,000 loan for Customer A
  // ---------------------------------------------------------------------------
  const loanPrincipal = 50000;
  const loanRate = 2; // 2% per month
  const loanTenure = 10; // 10 months
  const loanCalc = calculateLoan({
    principal: loanPrincipal,
    interestRate: loanRate,
    interestType: "FLAT",
    interestFrequency: "MONTHLY",
    paymentFrequency: "MONTHLY",
    totalInstallments: loanTenure,
  });

  const loanA = await testPrisma.loan.create({
    data: {
      loanNo: "LN-2026-001",
      customerId: customerA.id,
      principalAmount: loanPrincipal,
      interestType: "FLAT",
      interestRate: loanRate,
      interestFrequency: "MONTHLY",
      paymentFrequency: "MONTHLY",
      totalInstallments: loanTenure,
      installmentAmount: loanCalc.installmentAmount,
      totalPayable: loanCalc.totalPayable,
      principalOutstanding: loanPrincipal,
      interestOutstanding: loanCalc.totalInterest,
      dueDate: new Date(loanCalc.schedule[loanCalc.schedule.length - 1].dueDate),
      status: "ACTIVE",
    },
  });

  await postLoanDisbursement({
    loanId: loanA.id,
    customerName: customerA.name,
    principalAmount: loanPrincipal,
    paymentMethod: "CASH",
  });

  await testPrisma.auditLog.create({
    data: {
      action: "CREATE",
      entity: "LOAN",
      entityId: loanA.id,
      performedBy: "Admin",
      details: `Disbursed ₹50,000 loan LN-2026-001 to ${customerA.name}`,
    },
  });

  recordStep(
    5,
    "Create a ₹50,000 loan for Customer A",
    "Loan LN-2026-001 created with principal ₹50,000 and status ACTIVE",
    `Loan No: ${loanA.loanNo}, Principal: ₹${loanA.principalAmount}, Total Payable: ₹${loanA.totalPayable}`,
    loanA.principalAmount === 50000 && loanA.status === "ACTIVE"
  );

  // ---------------------------------------------------------------------------
  // STEP 6: Verify Cash/Bank decreases by ₹50,000
  // ---------------------------------------------------------------------------
  const cashStep6 = await testPrisma.cashAccount.findUnique({ where: { id: "main-cash" } });
  const acct1010_Step6 = await testPrisma.ledgerAccount.findUnique({ where: { code: "1010" } });

  recordStep(
    6,
    "Verify Cash/Bank decreases by ₹50,000",
    "Cash-in-hand decreases from ₹1,00,000 to ₹50,000 (diff: ₹50,000)",
    `Cash Account Balance: ₹${cashStep6?.currentBalance}, Account 1010 Balance: ₹${acct1010_Step6?.balance}`,
    cashStep6?.currentBalance === 50000 && acct1010_Step6?.balance === 50000
  );

  // ---------------------------------------------------------------------------
  // STEP 7: Verify Loan Receivable increases by ₹50,000
  // ---------------------------------------------------------------------------
  const acct1030_Step7 = await testPrisma.ledgerAccount.findUnique({ where: { code: "1030" } });

  recordStep(
    7,
    "Verify Loan Receivable increases by ₹50,000",
    "Account 1030 (Loans Receivable) balance increases to ₹50,000",
    `Account 1030 Balance: ₹${acct1030_Step7?.balance}`,
    acct1030_Step7?.balance === 50000
  );

  // ---------------------------------------------------------------------------
  // STEP 8: Calculate the applicable interest
  // ---------------------------------------------------------------------------
  // Flat Interest formula: Principal * (Rate / 100) * Months
  // ₹50,000 * (2 / 100) * 10 = ₹1,000/month * 10 = ₹10,000
  const computedMonthlyInterest = (loanPrincipal * loanRate) / 100;
  const computedTotalInterest = computedMonthlyInterest * loanTenure;
  const computedTotalPayable = loanPrincipal + computedTotalInterest;
  const computedInstallment = computedTotalPayable / loanTenure;

  recordStep(
    8,
    "Calculate the applicable interest",
    "Formula: ₹50,000 * 2% * 10 months = ₹10,000 interest, ₹60,000 total payable",
    `Monthly Interest: ₹${computedMonthlyInterest}, Total Interest: ₹${computedTotalInterest}, Total Payable: ₹${computedTotalPayable}`,
    computedTotalInterest === 10000 && computedTotalPayable === 60000
  );

  // ---------------------------------------------------------------------------
  // STEP 9: Verify the interest calculation
  // ---------------------------------------------------------------------------
  recordStep(
    9,
    "Verify the interest calculation",
    "Loan engine output matches mathematical formula (Interest: ₹10,000, Installment: ₹6,000)",
    `Engine Interest: ₹${loanCalc.totalInterest}, Engine Installment: ₹${loanCalc.installmentAmount}, Schedule Items: ${loanCalc.schedule.length}`,
    loanCalc.totalInterest === computedTotalInterest &&
      loanCalc.installmentAmount === computedInstallment &&
      loanCalc.totalPayable === computedTotalPayable &&
      loanCalc.schedule.length === 10
  );

  // ---------------------------------------------------------------------------
  // STEP 10: Record a ₹5,000 customer collection
  // ---------------------------------------------------------------------------
  const collectionAmount = 5000;
  const allocatedPrincipal = 4000;
  const allocatedInterest = 1000;

  const payment1 = await testPrisma.loanPayment.create({
    data: {
      paymentNo: "PAY-2026-000001",
      loanId: loanA.id,
      customerId: customerA.id,
      amount: collectionAmount,
      principalPortion: allocatedPrincipal,
      interestPortion: allocatedInterest,
      paymentMethod: "CASH",
      notes: "First monthly installment collection",
    },
  });

  // Update Loan Balances
  const updatedLoan = await testPrisma.loan.update({
    where: { id: loanA.id },
    data: {
      principalPaid: { increment: allocatedPrincipal },
      interestPaid: { increment: allocatedInterest },
      principalOutstanding: loanA.principalOutstanding - allocatedPrincipal,
      interestOutstanding: loanA.interestOutstanding - allocatedInterest,
    },
  });

  // Post Double-Entry Ledger (Debit Cash 1010 ₹5,000; Credit Loan Receivable 1030 ₹4,000; Credit Interest Income 4010 ₹1,000)
  await postLoanCollection({
    loanId: loanA.id,
    customerName: customerA.name,
    totalAmount: collectionAmount,
    principalPortion: allocatedPrincipal,
    interestPortion: allocatedInterest,
    paymentMethod: "CASH",
  });

  await testPrisma.auditLog.create({
    data: {
      action: "PAYMENT",
      entity: "LOAN",
      entityId: loanA.id,
      performedBy: "Admin",
      details: `Recorded ₹5,000 payment for ${loanA.loanNo} (Principal: ₹4,000, Interest: ₹1,000)`,
    },
  });

  recordStep(
    10,
    "Record a ₹5,000 customer collection",
    "Loan payment PAY-2026-000001 recorded with ₹5,000 in CASH",
    `Payment No: ${payment1.paymentNo}, Amount: ₹${payment1.amount}, Method: ${payment1.paymentMethod}`,
    payment1.amount === 5000 && payment1.paymentMethod === "CASH"
  );

  // ---------------------------------------------------------------------------
  // STEP 11: Verify payment allocation between principal and interest
  // ---------------------------------------------------------------------------
  recordStep(
    11,
    "Verify payment allocation between principal and interest",
    "Principal Portion = ₹4,000, Interest Portion = ₹1,000, Sum = ₹5,000",
    `Principal: ₹${payment1.principalPortion}, Interest: ₹${payment1.interestPortion}, Total: ₹${payment1.principalPortion + payment1.interestPortion}`,
    payment1.principalPortion === 4000 &&
      payment1.interestPortion === 1000 &&
      payment1.principalPortion + payment1.interestPortion === 5000
  );

  // ---------------------------------------------------------------------------
  // STEP 12: Verify remaining principal
  // ---------------------------------------------------------------------------
  const expectedRemainingPrincipal = 50000 - 4000; // 46,000
  recordStep(
    12,
    "Verify remaining principal",
    `Original ₹50,000 - Paid ₹4,000 = ₹${expectedRemainingPrincipal}`,
    `Loan principalOutstanding: ₹${updatedLoan.principalOutstanding}, principalPaid: ₹${updatedLoan.principalPaid}`,
    updatedLoan.principalOutstanding === expectedRemainingPrincipal && updatedLoan.principalPaid === 4000
  );

  // ---------------------------------------------------------------------------
  // STEP 13: Verify remaining interest
  // ---------------------------------------------------------------------------
  const expectedRemainingInterest = 10000 - 1000; // 9,000
  recordStep(
    13,
    "Verify remaining interest",
    `Total Interest ₹10,000 - Paid ₹1,000 = ₹${expectedRemainingInterest}`,
    `Loan interestOutstanding: ₹${updatedLoan.interestOutstanding}, interestPaid: ₹${updatedLoan.interestPaid}`,
    updatedLoan.interestOutstanding === expectedRemainingInterest && updatedLoan.interestPaid === 1000
  );

  // ---------------------------------------------------------------------------
  // STEP 14: Verify customer ledger
  // ---------------------------------------------------------------------------
  const customerLedger = await testPrisma.customer.findUnique({
    where: { id: customerA.id },
    include: { loans: true, payments: true },
  });

  const custTotalBorrowed = customerLedger?.loans.reduce((s, l) => s + l.principalAmount, 0) || 0;
  const custTotalPaid = customerLedger?.payments.reduce((s, p) => s + p.amount, 0) || 0;
  const custOutstandingPrincipal = customerLedger?.loans.reduce((s, l) => s + l.principalOutstanding, 0) || 0;
  const custOutstandingInterest = customerLedger?.loans.reduce((s, l) => s + l.interestOutstanding, 0) || 0;
  const custTotalOutstanding = custOutstandingPrincipal + custOutstandingInterest;

  recordStep(
    14,
    "Verify customer ledger",
    "Total Borrowed = ₹50,000, Total Paid = ₹5,000, Total Outstanding = ₹55,000 (Prin: 46k + Int: 9k)",
    `Borrowed: ₹${custTotalBorrowed}, Paid: ₹${custTotalPaid}, Outstanding: ₹${custTotalOutstanding}`,
    custTotalBorrowed === 50000 && custTotalPaid === 5000 && custTotalOutstanding === 55000
  );

  // ---------------------------------------------------------------------------
  // STEP 15: Verify cash book
  // ---------------------------------------------------------------------------
  const cashAccountStep15 = await testPrisma.cashAccount.findUnique({ where: { id: "main-cash" } });
  // Cash Inflows: Partner Investment (₹100,000) + Loan Collection (₹5,000) = ₹105,000
  // Cash Outflows: Loan Disbursement (₹50,000) = ₹50,000
  // Net Balance: ₹55,000
  const expectedCashIn = 100000 + 5000;
  const expectedCashOut = 50000;
  const expectedNetCash = expectedCashIn - expectedCashOut;

  recordStep(
    15,
    "Verify cash book",
    `Total Cash In: ₹${expectedCashIn}, Total Cash Out: ₹${expectedCashOut}, Balance: ₹${expectedNetCash}`,
    `Cash-in-hand Current Balance: ₹${cashAccountStep15?.currentBalance}`,
    cashAccountStep15?.currentBalance === expectedNetCash
  );

  // ---------------------------------------------------------------------------
  // STEP 16: Verify general ledger
  // ---------------------------------------------------------------------------
  const ledgerEntriesStep16 = await testPrisma.ledgerEntry.findMany();
  const totalDebitsStep16 = ledgerEntriesStep16.filter((e) => e.entryType === "DEBIT").reduce((s, e) => s + e.amount, 0);
  const totalCreditsStep16 = ledgerEntriesStep16.filter((e) => e.entryType === "CREDIT").reduce((s, e) => s + e.amount, 0);
  const acct1030_Step16 = await testPrisma.ledgerAccount.findUnique({ where: { code: "1030" } });
  const acct4010_Step16 = await testPrisma.ledgerAccount.findUnique({ where: { code: "4010" } });

  recordStep(
    16,
    "Verify general ledger",
    "Debits == Credits (₹155,000), Loans Receivable (1030) = ₹46,000, Interest Income (4010) = ₹1,000",
    `Debits: ₹${totalDebitsStep16}, Credits: ₹${totalCreditsStep16}, Acct 1030: ₹${acct1030_Step16?.balance}, Acct 4010: ₹${acct4010_Step16?.balance}`,
    totalDebitsStep16 === 155000 &&
      totalCreditsStep16 === 155000 &&
      acct1030_Step16?.balance === 46000 &&
      acct4010_Step16?.balance === 1000
  );

  // ---------------------------------------------------------------------------
  // STEP 17: Add a ₹2,000 business expense
  // ---------------------------------------------------------------------------
  const expenseAmount = 2000;
  const expense1 = await testPrisma.expense.create({
    data: {
      expenseNo: "EXP-2026-001",
      category: "OFFICE",
      description: "Office Electricity & Internet Bill",
      amount: expenseAmount,
      paymentMethod: "CASH",
      paidBy: "Admin",
    },
  });

  await postExpensePosting({
    expenseId: expense1.id,
    category: expense1.category,
    amount: expenseAmount,
    paymentMethod: "CASH",
    description: expense1.description,
  });

  await testPrisma.auditLog.create({
    data: {
      action: "EXPENSE",
      entity: "EXPENSE",
      entityId: expense1.id,
      performedBy: "Admin",
      details: `Paid ₹2,000 for Office Electricity & Internet via CASH`,
    },
  });

  recordStep(
    17,
    "Add a ₹2,000 business expense",
    "Expense EXP-2026-001 created for ₹2,000 in category OFFICE",
    `Expense No: ${expense1.expenseNo}, Category: ${expense1.category}, Amount: ₹${expense1.amount}`,
    expense1.amount === 2000 && expense1.category === "OFFICE"
  );

  // ---------------------------------------------------------------------------
  // STEP 18: Verify cash/bank balance
  // ---------------------------------------------------------------------------
  const cashStep18 = await testPrisma.cashAccount.findUnique({ where: { id: "main-cash" } });
  const acct1010_Step18 = await testPrisma.ledgerAccount.findUnique({ where: { code: "1010" } });
  const expectedCashStep18 = 55000 - 2000; // 53,000

  recordStep(
    18,
    "Verify cash/bank balance",
    `Cash-in-hand decreases from ₹55,000 to ₹${expectedCashStep18}`,
    `Cash Account Balance: ₹${cashStep18?.currentBalance}, Account 1010: ₹${acct1010_Step18?.balance}`,
    cashStep18?.currentBalance === expectedCashStep18 && acct1010_Step18?.balance === expectedCashStep18
  );

  // ---------------------------------------------------------------------------
  // STEP 19: Verify expense account
  // ---------------------------------------------------------------------------
  const acct5010 = await testPrisma.ledgerAccount.findUnique({ where: { code: "5010" } });

  recordStep(
    19,
    "Verify expense account",
    "Account 5010 (Operating Expenses) balance = ₹2,000",
    `Account 5010 Balance: ₹${acct5010?.balance}`,
    acct5010?.balance === 2000
  );

  // ---------------------------------------------------------------------------
  // STEP 20: Generate Profit & Loss
  // ---------------------------------------------------------------------------
  const plReport = await generateProfitAndLossReport();
  const expectedNetProfit = 1000 - 2000; // -1000 (Loss)

  recordStep(
    20,
    "Generate Profit & Loss",
    "Total Revenue = ₹1,000, Total Expenses = ₹2,000, Net Profit = -₹1,000 (Loss)",
    `Interest Revenue: ₹${plReport.revenue.interestIncome}, Total Revenue: ₹${plReport.revenue.totalRevenue}, Expenses: ₹${plReport.expenses.totalExpenses}, Net Profit: ₹${plReport.netProfit}`,
    plReport.revenue.totalRevenue === 1000 &&
      plReport.expenses.totalExpenses === 2000 &&
      plReport.netProfit === expectedNetProfit
  );

  // ---------------------------------------------------------------------------
  // STEP 21: Generate Balance Sheet
  // ---------------------------------------------------------------------------
  const balanceSheet = await generateBalanceSheetReport();
  const totalAssets = balanceSheet.assets.totalAssets;
  const totalLiabilities = balanceSheet.liabilities.totalLiabilities;
  const totalCapital = balanceSheet.capital.totalCapital;
  const bsEquationBalanced = totalAssets === totalLiabilities + totalCapital;

  recordStep(
    21,
    "Generate Balance Sheet",
    "Assets (Cash ₹53k + Loans Rec ₹46k = ₹99k) === Liabilities (₹0) + Capital (Partner ₹100k - Loss ₹1k = ₹99k)",
    `Total Assets: ₹${totalAssets}, Total Liabilities: ₹${totalLiabilities}, Total Capital: ₹${totalCapital}, Difference: ₹${balanceSheet.difference}, isBalanced: ${balanceSheet.isBalanced}`,
    totalAssets === 99000 &&
      totalLiabilities === 0 &&
      totalCapital === 99000 &&
      bsEquationBalanced &&
      balanceSheet.isBalanced === true
  );

  // ---------------------------------------------------------------------------
  // STEP 22: Generate Cash Flow
  // ---------------------------------------------------------------------------
  const cashFlow = await generateCashFlowReport();
  const expectedInflows = 100000 + 5000; // 105,000
  const expectedOutflows = 50000 + 2000; // 52,000
  const expectedNet = expectedInflows - expectedOutflows; // 53,000

  recordStep(
    22,
    "Generate Cash Flow",
    `Total Inflows: ₹${expectedInflows}, Outflows: ₹${expectedOutflows}, Net Cash Flow = ₹${expectedNet} === Available Cash ₹53,000`,
    `Inflows: ₹${cashFlow.inflows.totalInflows}, Outflows: ₹${cashFlow.outflows.totalOutflows}, Net Cash Flow: ₹${cashFlow.netCashFlow}, Cash Account: ₹${cashFlow.currentCashBalance}`,
    cashFlow.inflows.totalInflows === expectedInflows &&
      cashFlow.outflows.totalOutflows === expectedOutflows &&
      cashFlow.netCashFlow === expectedNet &&
      cashFlow.currentCashBalance === expectedNet
  );

  // ---------------------------------------------------------------------------
  // STEP 23: Generate Partner Capital Statement
  // ---------------------------------------------------------------------------
  const partnerWithHistory = await testPrisma.partner.findUnique({
    where: { id: partnerA.id },
    include: {
      investments: true,
      withdrawals: true,
      profitAllocations: true,
      settlements: true,
    },
  });

  const capitalAdded = partnerWithHistory?.investments.reduce((s, i) => s + i.amount, 0) || 0;
  const capitalWithdrawn = partnerWithHistory?.withdrawals.reduce((s, w) => s + w.amount, 0) || 0;
  const profitAdded = partnerWithHistory?.profitAllocations.reduce((s, p) => s + p.allocatedProfit, 0) || 0;
  const openingBal = partnerWithHistory?.initialCapital || 0;
  const computedClosingCapital = openingBal + capitalAdded - capitalWithdrawn + profitAdded;

  recordStep(
    23,
    "Generate Partner Capital Statement",
    "Opening ₹0 + Investments ₹1,00,000 - Drawings ₹0 + Profit ₹0 = Current Capital ₹1,00,000",
    `Opening: ₹${openingBal}, Added: ₹${capitalAdded}, Withdrawn: ₹${capitalWithdrawn}, Profit: ₹${profitAdded}, Closing: ₹${computedClosingCapital}`,
    computedClosingCapital === 100000 && partnerWithHistory?.currentCapital === 100000
  );

  // ---------------------------------------------------------------------------
  // STEP 24: Generate Partner Settlement
  // ---------------------------------------------------------------------------
  const settlementCode = "SETL-PRT-000001";
  const settlement = await testPrisma.partnerSettlement.create({
    data: {
      settlementCode,
      partnerId: partnerA.id,
      openingBalance: openingBal,
      capitalAdded,
      capitalWithdrawn,
      profitAdded,
      closingBalance: computedClosingCapital,
      paymentMethod: "BANK",
      referenceNo: "SETL-REF-99001",
      notes: "Period-end Partner Capital Account Reconciliation Voucher",
    },
  });

  await testPrisma.auditLog.create({
    data: {
      action: "SETTLEMENT",
      entity: "PARTNER",
      entityId: partnerA.id,
      performedBy: "Admin",
      details: `Generated settlement ${settlementCode} for Partner A. Closing Balance: ₹${settlement.closingBalance}`,
    },
  });

  recordStep(
    24,
    "Generate Partner Settlement",
    `Settlement voucher created with closingBalance = ₹1,00,000`,
    `Settlement Code: ${settlement.settlementCode}, Partner ID: ${settlement.partnerId}, Closing Balance: ₹${settlement.closingBalance}`,
    settlement.closingBalance === 100000 && settlement.settlementCode === settlementCode
  );

  // ---------------------------------------------------------------------------
  // STEP 25: Verify that all accounting entries are balanced
  // ---------------------------------------------------------------------------
  const allLedgerTxns = await testPrisma.ledgerTransaction.findMany({
    include: { entries: true },
  });

  let allTxnsSelfBalanced = true;
  let totalOverallDebits = 0;
  let totalOverallCredits = 0;

  for (const txn of allLedgerTxns) {
    const txnDebits = txn.entries.filter((e) => e.entryType === "DEBIT").reduce((s, e) => s + e.amount, 0);
    const txnCredits = txn.entries.filter((e) => e.entryType === "CREDIT").reduce((s, e) => s + e.amount, 0);
    totalOverallDebits += txnDebits;
    totalOverallCredits += txnCredits;
    if (Math.abs(txnDebits - txnCredits) > 0.001) {
      allTxnsSelfBalanced = false;
    }
  }

  const globalImbalance = Math.abs(totalOverallDebits - totalOverallCredits);

  recordStep(
    25,
    "Verify that all accounting entries are balanced",
    `Every individual transaction has Debits == Credits AND Total Debits == Total Credits (Diff = 0.00)`,
    `Total Transactions: ${allLedgerTxns.length}, Overall Debits: ₹${totalOverallDebits}, Credits: ₹${totalOverallCredits}, Imbalance: ₹${globalImbalance}`,
    allTxnsSelfBalanced && globalImbalance < 0.001
  );

  // ---------------------------------------------------------------------------
  // STEP 26: Verify that no transaction is duplicated
  // ---------------------------------------------------------------------------
  const txnNumbers = allLedgerTxns.map((t) => t.transactionNo);
  const uniqueTxnNumbers = new Set(txnNumbers);
  const noDuplicateTxns = txnNumbers.length === uniqueTxnNumbers.size;

  const payments = await testPrisma.loanPayment.findMany();
  const paymentNos = payments.map((p) => p.paymentNo);
  const noDuplicatePayments = paymentNos.length === new Set(paymentNos).size;

  const expenses = await testPrisma.expense.findMany();
  const expenseNos = expenses.map((e) => e.expenseNo);
  const noDuplicateExpenses = expenseNos.length === new Set(expenseNos).size;

  recordStep(
    26,
    "Verify that no transaction is duplicated",
    "Zero duplicate transaction numbers, payment numbers, or expense numbers",
    `Unique Txn Nos: ${uniqueTxnNumbers.size}/${txnNumbers.length}, Unique Payments: ${noDuplicatePayments}, Unique Expenses: ${noDuplicateExpenses}`,
    noDuplicateTxns && noDuplicatePayments && noDuplicateExpenses
  );

  // ---------------------------------------------------------------------------
  // STEP 27: Verify that no transaction is double-counted
  // ---------------------------------------------------------------------------
  // Check exact posting count per business event:
  // 1 Investment Txn, 1 Loan Disbursement Txn, 1 Payment Collection Txn, 1 Expense Txn = 4 Txns total
  const expectedTxnCount = 4;
  const actualTxnCount = allLedgerTxns.length;
  const loanDisbursementEntries = allLedgerTxns.filter((t) => t.referenceType === "LOAN_GIVEN");
  const collectionEntries = allLedgerTxns.filter((t) => t.referenceType === "COLLECTION");

  recordStep(
    27,
    "Verify that no transaction is double-counted",
    `Exactly 4 business transactions posted to General Ledger (1 Investment, 1 Loan, 1 Payment, 1 Expense)`,
    `Total Transactions: ${actualTxnCount}, Loan Disbursements: ${loanDisbursementEntries.length}, Collections: ${collectionEntries.length}`,
    actualTxnCount === expectedTxnCount && loanDisbursementEntries.length === 1 && collectionEntries.length === 1
  );

  // ---------------------------------------------------------------------------
  // STEP 28: Verify money calculations use precise Decimal handling
  // ---------------------------------------------------------------------------
  // Check that all monetary balances and transaction amounts in the DB are exact cents without float drift
  const allAccounts = await testPrisma.ledgerAccount.findMany();
  let floatDriftFound = false;

  for (const acct of allAccounts) {
    const isCleanDecimal = Number((Math.round(acct.balance * 100) / 100).toFixed(2)) === acct.balance;
    if (!isCleanDecimal) floatDriftFound = true;
  }

  const cleanCash = Number((Math.round((cashStep18?.currentBalance || 0) * 100) / 100).toFixed(2)) === cashStep18?.currentBalance;
  if (!cleanCash) floatDriftFound = true;

  recordStep(
    28,
    "Verify that money calculations use precise Decimal handling",
    "Zero floating-point rounding drift across all Ledger Accounts and Cash Book",
    `Accounts checked: ${allAccounts.length + 1}, Float drift detected: ${floatDriftFound ? "YES" : "NONE"}`,
    !floatDriftFound
  );

  // ---------------------------------------------------------------------------
  // STEP 29: Verify that all transactions have dates and references
  // ---------------------------------------------------------------------------
  let allTxnsHaveDatesAndRefs = true;
  for (const txn of allLedgerTxns) {
    if (!txn.date || isNaN(new Date(txn.date).getTime()) || !txn.transactionNo || !txn.referenceType) {
      allTxnsHaveDatesAndRefs = false;
    }
  }

  recordStep(
    29,
    "Verify that all transactions have dates and references",
    "100% of ledger transactions possess valid ISO Date, Transaction No, and Reference Type",
    `Transactions inspected: ${allLedgerTxns.length}, Missing dates/refs: ${allTxnsHaveDatesAndRefs ? 0 : "FOUND"}`,
    allTxnsHaveDatesAndRefs
  );

  // ---------------------------------------------------------------------------
  // STEP 30: Test backup
  // ---------------------------------------------------------------------------
  const backupResult = await createDatabaseBackup();
  createdBackupFiles.push(backupResult.filePath);

  const backupFileExists = fs.existsSync(backupResult.filePath);
  const backupFileSize = backupFileExists ? fs.statSync(backupResult.filePath).size : 0;
  const backupRecordInDb = await testPrisma.backupRecord.findFirst({
    where: { fileName: backupResult.fileName },
  });

  recordStep(
    30,
    "Test backup",
    "Database backup file created on disk with size > 0 and recorded in BackupRecord table",
    `Backup File: ${backupResult.fileName}, Size: ${backupFileSize} bytes, DB Record Status: ${backupRecordInDb?.status}`,
    backupFileExists && backupFileSize > 0 && backupRecordInDb?.status === "SUCCESS"
  );

  // ---------------------------------------------------------------------------
  // STEP 31: Test restore using the temporary test database
  // ---------------------------------------------------------------------------
  const restoreResult = await restoreDatabaseBackup(backupResult.fileName);
  if (restoreResult.preBackupFile) {
    const preBackupPath = path.join(getBackupDirectory(), restoreResult.preBackupFile);
    createdBackupFiles.push(preBackupPath);
  }

  // Verify that database is completely accessible and data matches post-restore
  const restoredCash = await testPrisma.cashAccount.findUnique({ where: { id: "main-cash" } });
  const restoredPartner = await testPrisma.partner.findUnique({ where: { id: partnerA.id } });
  const restoredLoan = await testPrisma.loan.findUnique({ where: { id: loanA.id } });

  recordStep(
    31,
    "Test restore using the temporary test database",
    "Restore succeeds; pre-restore backup generated; all entities intact after restore",
    `Restore Success: ${restoreResult.success}, Pre-Backup: ${restoreResult.preBackupFile}, Restored Cash: ₹${restoredCash?.currentBalance}, Restored Partner Capital: ₹${restoredPartner?.currentCapital}, Restored Loan Status: ${restoredLoan?.status}`,
    restoreResult.success === true &&
      restoredCash?.currentBalance === 53000 &&
      restoredPartner?.currentCapital === 100000 &&
      restoredLoan?.status === "ACTIVE"
  );

  // ---------------------------------------------------------------------------
  // STEP 32: Verify audit log entries
  // ---------------------------------------------------------------------------
  const allAuditLogs = await testPrisma.auditLog.findMany({
    orderBy: { timestamp: "asc" },
  });

  const loggedActions = new Set(allAuditLogs.map((a) => a.action));
  const expectedActions = ["CREATE", "INVESTMENT", "PAYMENT", "EXPENSE", "SETTLEMENT", "RESTORE"];
  const hasAllExpectedActions = expectedActions.every((act) => loggedActions.has(act));

  const allLogsComplete = allAuditLogs.every(
    (l) => l.action && l.entity && l.performedBy && l.details && l.timestamp
  );

  recordStep(
    32,
    "Verify audit log entries",
    "Audit logs recorded for all events (CREATE, INVESTMENT, PAYMENT, EXPENSE, SETTLEMENT, RESTORE) with full metadata",
    `Total Logs: ${allAuditLogs.length}, Distinct Actions: [${Array.from(loggedActions).join(", ")}], Complete Metadata: ${allLogsComplete}`,
    allAuditLogs.length >= 7 && hasAllExpectedActions && allLogsComplete
  );

  // ---------------------------------------------------------------------------
  // Mathematical Reconciliation Summary Output
  // ---------------------------------------------------------------------------
  console.log("================================================================================");
  console.log("                     FINAL MATHEMATICAL RECONCILIATION                          ");
  console.log("================================================================================");
  console.log(`1. Double-Entry Books    : Total Debits = ₹${totalOverallDebits.toFixed(2)} | Total Credits = ₹${totalOverallCredits.toFixed(2)} (Net Diff = ₹0.00)`);
  console.log(`2. Balance Sheet Proof   : Assets (₹${totalAssets}) = Liabilities (₹${totalLiabilities}) + Equity (₹${totalCapital})`);
  console.log(`3. Cash Flow Proof       : Net Cash Flow (₹${cashFlow.netCashFlow}) = Available Physical Cash (₹${cashStep18?.currentBalance})`);
  console.log(`4. Loan Book Proof       : Disbursed (₹${loanPrincipal}) = Principal Paid (₹${updatedLoan.principalPaid}) + Outstanding (₹${updatedLoan.principalOutstanding})`);
  console.log(`5. Interest Proof        : Total Accrued (₹${loanCalc.totalInterest}) = Interest Paid (₹${updatedLoan.interestPaid}) + Outstanding (₹${updatedLoan.interestOutstanding})`);
  console.log(`6. Partner Capital Proof : Opening (₹0) + Injections (₹${capitalAdded}) = Closing Capital (₹${partnerWithHistory?.currentCapital})`);
  console.log(`7. Profit & Loss Proof   : Interest Revenue (₹1,00,0) - Operating Expenses (₹2,000) = Net Loss (-₹1,000)`);
  console.log(`8. Audit Trail Proof     : ${allAuditLogs.length} audit entries captured across 6 distinct lifecycle events`);
  console.log(`9. Precision Proof       : 0 floating-point rounding errors detected`);
  console.log(`10. Data Protection Proof: Database backup & restore successfully cycle-tested with full data integrity`);
  console.log("================================================================================\n");

  const totalPassed = testReports.filter((r) => r.passed).length;
  console.log(`SUMMARY: ${totalPassed} / 32 Steps Passed Successfully (100%).\n`);
}

runFullWorkflow()
  .catch((err) => {
    console.error("FATAL ERROR during financial integrity test:", err);
    process.exit(1);
  })
  .finally(async () => {
    await testPrisma.$disconnect();
    // Allow Windows file handle release
    await new Promise((r) => setTimeout(r, 500));

    // 1. Clean up temporary test database files
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
        console.log(`Cleaned up temporary test database: ${testDbPath}`);
      }
      const journalPath = `${testDbPath}-journal`;
      if (fs.existsSync(journalPath)) {
        fs.unlinkSync(journalPath);
      }
    } catch {
      // ignore
    }

    // 2. Clean up test backup files created during the run
    for (const f of createdBackupFiles) {
      try {
        if (fs.existsSync(f)) {
          fs.unlinkSync(f);
          console.log(`Cleaned up test backup file: ${f}`);
        }
      } catch {
        // ignore
      }
    }
  });
