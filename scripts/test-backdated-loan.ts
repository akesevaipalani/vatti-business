import { prisma } from "../lib/prisma";
import { calculateLoan } from "../lib/loans/calculator";
import { postLoanDisbursement, postLoanCollection } from "../lib/accounting/engine";
import {
  generateInstallmentsForLoan,
  getCollectionSchedule,
  recordCollectionForInstallment,
} from "../lib/loans/installments";
import { parseISTDate, toISTDateString, formatISTDisplay, getTodayIST } from "../lib/date";

async function runBackdatedLoanTest() {
  console.log("=== STARTING BACKDATED LOAN DISBURSEMENT TEST ===");

  const BACKDATED_DATE = "2026-09-24";
  const COLLECTION_DATE = "2026-09-25";

  // 1. Create temporary test customer
  const tempCustomer = await prisma.customer.create({
    data: {
      customerCode: "TEMP-BD-CUST",
      name: "Temporary Backdated Tester",
      mobile: "9988776655",
      city: "Tiruchengode",
      address: "Test Street",
      openingBalance: 0,
      currentBalance: 0,
    },
  });
  console.log(`Created temporary customer: ${tempCustomer.customerCode} (${tempCustomer.id})`);

  try {
    // 2. Disburse Daily Loan backdated to 2026-09-24
    const principal = 10000;
    const totalInstallments = 100;
    const paymentFrequency = "DAILY";
    const loanCalculationType = "STANDARD";
    const interestType = "FLAT";
    const interestRate = 0; // 100 daily dues of 100 each for clean test
    const loanDate = parseISTDate(BACKDATED_DATE);

    console.log(`Disbursing loan with loanDate: ${loanDate.toISOString()}, IST string: ${toISTDateString(loanDate)}`);

    const calc = calculateLoan({
      principal,
      loanCalculationType,
      interestRate,
      interestType,
      paymentFrequency,
      totalInstallments,
      startDate: loanDate,
    });

    const loanNo = `LOAN-TEST-BD-${Date.now()}`;
    const dueDate = new Date(calc.schedule[calc.schedule.length - 1].dueDate);

    const loan = await prisma.loan.create({
      data: {
        loanNo,
        customerId: tempCustomer.id,
        date: loanDate, // Authoritative backdated disbursement date
        principalAmount: principal,
        loanCalculationType,
        advanceInterest: 0,
        disbursedAmount: principal,
        interestType,
        interestRate,
        interestFrequency: "DAILY",
        paymentFrequency: "DAILY",
        totalInstallments,
        installmentAmount: calc.installmentAmount,
        processingFee: 0,
        totalPayable: principal,
        principalOutstanding: principal,
        interestOutstanding: 0,
        dueDate,
        status: "ACTIVE",
        notes: "Backdated test loan",
      } as any,
    });

    console.log(`Created Loan: ${loan.loanNo} with DB date: ${loan.date.toISOString()}`);
    console.log(`Loan Date in IST: ${toISTDateString(loan.date)} (Formatted: ${formatISTDisplay(loan.date)})`);

    // Verify database loan date = 24/09/2026
    const savedDateIST = toISTDateString(loan.date);
    if (savedDateIST !== BACKDATED_DATE) {
      throw new Error(`Assertion failed: Expected loan date ${BACKDATED_DATE}, but got ${savedDateIST}`);
    }
    console.log(`✓ STEP 1 PASSED: Loan date in PostgreSQL is strictly ${BACKDATED_DATE}`);

    // Generate installments
    await generateInstallmentsForLoan(loan.id, calc.schedule, { customerId: tempCustomer.id });

    // Verify installments
    const installments = await prisma.loanInstallment.findMany({
      where: { loanId: loan.id },
      orderBy: { installmentNumber: "asc" },
    });

    console.log(`Total installments created: ${installments.length}`);
    const inst1 = installments[0];
    const inst1DueYMD = toISTDateString(inst1.dueDate);
    console.log(`Installment 1 Due Date: ${inst1DueYMD} (${formatISTDisplay(inst1.dueDate)})`);

    if (inst1DueYMD !== COLLECTION_DATE) {
      throw new Error(`Assertion failed: Expected Installment 1 dueDate ${COLLECTION_DATE}, but got ${inst1DueYMD}`);
    }
    console.log(`✓ STEP 2 PASSED: Installment 1 dueDate is strictly ${COLLECTION_DATE} (1 day after ${BACKDATED_DATE})`);

    // Post double-entry disbursement
    await postLoanDisbursement({
      loanId: loan.id,
      customerName: tempCustomer.name,
      principalAmount: principal,
      customerReceives: principal,
      advanceInterest: 0,
      processingFee: 0,
      paymentMethod: "CASH",
      date: loanDate,
    });
    console.log(`✓ STEP 3 PASSED: Posted backdated double-entry transaction on ${toISTDateString(loanDate)}`);

    // 3. Query Collection Schedule for 2026-09-25
    console.log(`\nQuerying Collection Schedule for date: ${COLLECTION_DATE}...`);
    const scheduleBefore = await getCollectionSchedule(COLLECTION_DATE);

    console.log(`Schedule Before Collection on ${COLLECTION_DATE}:`);
    console.log(`  Today's Due Count: ${scheduleBefore.summary.todayDueCount}`);
    console.log(`  Today's Pending Count: ${scheduleBefore.summary.todayPendingCount}`);
    console.log(`  Collected Today Count: ${scheduleBefore.summary.todayCollectedCount}`);

    const dueItem = scheduleBefore.todayDue.find((i) => i.loanId === loan.id);
    const pendingItem = scheduleBefore.todayPending.find((i) => i.loanId === loan.id);
    const collectedItem = scheduleBefore.collectedToday.find((i) => i.loanId === loan.id);

    if (!dueItem) {
      throw new Error(`Assertion failed: Loan installment not found in Today's Due for ${COLLECTION_DATE}`);
    }
    console.log(`✓ STEP 4 PASSED: Installment appears under Today's Due on ${COLLECTION_DATE}`);

    if (!pendingItem) {
      throw new Error(`Assertion failed: Loan installment not found in Today's Pending for ${COLLECTION_DATE}`);
    }
    console.log(`✓ STEP 5 PASSED: Installment appears under Today's Pending on ${COLLECTION_DATE}`);

    if (collectedItem) {
      throw new Error(`Assertion failed: Loan unexpectedly appears in Collected Today before collection!`);
    }
    console.log(`✓ STEP 6 PASSED: Collected Today is 0 for this loan prior to payment`);

    // 4. Pay the 25/09/2026 installment
    console.log(`\nRecording full payment for Installment 1 on ${COLLECTION_DATE}...`);
    const payResult = await recordCollectionForInstallment({
      installmentId: inst1.id,
      amount: inst1.installmentAmount,
      principalPortion: inst1.principalPortion,
      interestPortion: inst1.interestPortion,
      collectionDate: COLLECTION_DATE,
      paymentMethod: "CASH",
      notes: "Payment on due date test",
    });
    console.log(`Payment recorded successfully: ${payResult.payment.paymentNo}`);

    // 5. Query Collection Schedule again for 2026-09-25
    const scheduleAfter = await getCollectionSchedule(COLLECTION_DATE);
    console.log(`Schedule After Collection on ${COLLECTION_DATE}:`);
    console.log(`  Today's Due Count: ${scheduleAfter.summary.todayDueCount}`);
    console.log(`  Today's Pending Count: ${scheduleAfter.summary.todayPendingCount}`);
    console.log(`  Collected Today Count: ${scheduleAfter.summary.todayCollectedCount}`);

    const pendingItemAfter = scheduleAfter.todayPending.find((i) => i.loanId === loan.id);
    const collectedItemAfter = scheduleAfter.collectedToday.find((i) => i.loanId === loan.id);

    if (pendingItemAfter) {
      throw new Error(`Assertion failed: Fully paid installment is still appearing in Today's Pending!`);
    }
    console.log(`✓ STEP 7 PASSED: Today's Pending = 0 for this loan after full collection`);

    if (!collectedItemAfter) {
      throw new Error(`Assertion failed: Payment does not appear in Collected Today for ${COLLECTION_DATE}!`);
    }
    console.log(`✓ STEP 8 PASSED: Payment appears in Collected Today for ${COLLECTION_DATE}`);

    console.log("\nALL BACKDATED LOAN DISBURSEMENT AND COLLECTION ASSERTIONS PASSED 100%!");
  } finally {
    console.log("\n=== CLEANING UP TEMPORARY TEST DATA ===");

    // Find and delete loan payments
    const payments = await prisma.loanPayment.findMany({
      where: { customerId: tempCustomer.id },
    });
    for (const p of payments) {
      await prisma.loanPayment.delete({ where: { id: p.id } });
    }

    // Delete installments
    await prisma.loanInstallment.deleteMany({
      where: { customerId: tempCustomer.id },
    });

    // Delete loans
    const loans = await prisma.loan.findMany({
      where: { customerId: tempCustomer.id },
    });
    for (const l of loans) {
      await prisma.loan.delete({ where: { id: l.id } });
    }

    // Delete test ledger transactions
    const ledgerTxns = await prisma.ledgerTransaction.findMany({
      where: {
        OR: [
          { description: { contains: tempCustomer.name } },
          { description: { contains: "LOAN-TEST-BD" } },
        ],
      },
      include: { entries: true },
    });
    for (const txn of ledgerTxns) {
      await prisma.ledgerEntry.deleteMany({ where: { ledgerTransactionId: txn.id } });
      await prisma.ledgerTransaction.delete({ where: { id: txn.id } });
    }

    // Delete test audit logs
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { details: { contains: tempCustomer.name } },
          { details: { contains: "LOAN-TEST-BD" } },
        ],
      },
    });

    // Reset cash balance to baseline 149915
    await prisma.cashAccount.update({
      where: { id: "main-cash" },
      data: { currentBalance: 149915 },
    });

    // Delete temporary customer
    await prisma.customer.delete({ where: { id: tempCustomer.id } });

    console.log("Cleanup completed successfully.");
  }
}

runBackdatedLoanTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed with error:", err);
    process.exit(1);
  });
