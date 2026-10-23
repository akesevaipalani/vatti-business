/**
 * Regression Test Suite: Historical Collection Status & Reconciliation
 *
 * Scenarios tested against confirmed production receipts #26 & #27:
 * - 18/10/2026: Receipt #26 (₹1,500), Installment #24 collected on due date.
 * - 19/10/2026: Installment #25 due ₹1,500. Point-in-time state is PENDING ₹1,500.
 *               Paid later on 23/10/2026 via Receipt #27. Reconciles: Due = Collected + Pending.
 * - 23/10/2026: Receipt #27 (₹1,500) collected on 23/10/2026. Actual date & receipt preserved.
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const Module = require('module');
const assert = require('assert');

// 1. Setup in-memory TypeScript module loader with @/ path alias
const origResolve = Module._resolveFilename;
const projectRoot = path.resolve(__dirname, '..');

Module._resolveFilename = function (req, parent, isMain, opts) {
  if (req.startsWith('@/')) {
    req = path.join(projectRoot, req.slice(2));
  }
  return origResolve.call(this, req, parent, isMain, opts);
};

require.extensions['.ts'] = function (m, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;
  m._compile(out, filename);
};

// 2. Import getCollectionSchedule and Prisma Client
const { getCollectionSchedule } = require('../lib/loans/installments.ts');
const { prisma } = require('../lib/prisma.ts');

async function runRegressionTests() {
  console.log('================================================================');
  console.log('VATTI BUSINESS — HISTORICAL COLLECTION STATUS REGRESSION TESTS');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // TEST SUITE 1: 18/10/2026 (Receipt #26 Scenario)
    // -------------------------------------------------------------------------
    console.log('Scenario 1: 18/10/2026 — Due Installment #24 Collected On Time');
    const schedule18 = await getCollectionSchedule('2026-10-18');

    test('18/10: Summary reconciled flag is true', () => {
      assert.strictEqual(schedule18.summary.reconciled, true);
    });

    test('18/10: Mathematical reconciliation: Due === CollectedOnDue + Pending', () => {
      const { todayDueAmount, todayCollectedOnDue, todayPendingAmount } = schedule18.summary;
      assert.strictEqual(
        todayDueAmount,
        todayCollectedOnDue + todayPendingAmount,
        `Expected ${todayDueAmount} === ${todayCollectedOnDue} + ${todayPendingAmount}`
      );
    });

    test('18/10: Installment #24 is marked PAID with paidAmount = 1500', () => {
      const item24 = schedule18.todayDue.find(
        (i) => i.loanNo === 'ABC/LOAN/2026/000001' && i.installmentNumber === 24
      );
      assert.ok(item24, 'Installment #24 should be present in todayDue');
      assert.strictEqual(item24.status, 'PAID');
      assert.strictEqual(item24.paidAmount, 1500);
      assert.strictEqual(item24.pendingAmount, 0);
      assert.strictEqual(item24.paidLater, false);
    });

    test('18/10: Collected Today includes Receipt #26 (₹1,500)', () => {
      const rcpt26 = schedule18.collectedToday.find(
        (p) => p.paymentNo === 'ABC/RCPT/2026/000026'
      );
      assert.ok(rcpt26, 'Receipt #26 should be in collectedToday list');
      assert.strictEqual(rcpt26.amount, 1500);
      assert.strictEqual(rcpt26.loanNo, 'ABC/LOAN/2026/000001');
    });

    // -------------------------------------------------------------------------
    // TEST SUITE 2: 19/10/2026 (Historical Bug & Point-in-time Resolution)
    // -------------------------------------------------------------------------
    console.log('\nScenario 2: 19/10/2026 — Due Installment #25 Paid Later on 23/10/2026');
    const schedule19 = await getCollectionSchedule('2026-10-19');

    test('19/10: Summary reconciled flag is true', () => {
      assert.strictEqual(schedule19.summary.reconciled, true);
    });

    test('19/10: Mathematical reconciliation: Due === CollectedOnDue + Pending (1500 === 0 + 1500)', () => {
      const { todayDueAmount, todayCollectedOnDue, todayPendingAmount } = schedule19.summary;
      assert.strictEqual(
        todayDueAmount,
        todayCollectedOnDue + todayPendingAmount,
        `Expected ${todayDueAmount} === ${todayCollectedOnDue} + ${todayPendingAmount}`
      );
      assert.strictEqual(todayDueAmount, 1500);
      assert.strictEqual(todayCollectedOnDue, 0);
      assert.strictEqual(todayPendingAmount, 1500);
    });

    test('19/10: Installment #25 point-in-time status is PENDING with paidAmount = 0, pendingAmount = 1500', () => {
      const item25 = schedule19.todayDue.find(
        (i) => i.loanNo === 'ABC/LOAN/2026/000001' && i.installmentNumber === 25
      );
      assert.ok(item25, 'Installment #25 should be in todayDue');
      assert.strictEqual(item25.status, 'PENDING');
      assert.strictEqual(item25.paidAmount, 0, 'Point-in-time paidAmount on 19/10 must be 0');
      assert.strictEqual(item25.pendingAmount, 1500, 'Point-in-time pendingAmount on 19/10 must be 1500');
    });

    test('19/10: Installment #25 is flagged paidLater with Receipt #27 and future date', () => {
      const item25 = schedule19.todayDue.find(
        (i) => i.loanNo === 'ABC/LOAN/2026/000001' && i.installmentNumber === 25
      );
      assert.ok(item25);
      assert.strictEqual(item25.paidLater, true, 'paidLater must be true for installment paid on future date');
      assert.strictEqual(item25.paidLaterReceiptNo, 'ABC/RCPT/2026/000027');
      assert.ok(
        item25.paidLaterDate && item25.paidLaterDate.includes('23/10/2026'),
        `paidLaterDate should show 23/10/2026, got: ${item25.paidLaterDate}`
      );
    });

    test('19/10: Installment #25 appears in todayPending list (due to pendingAmount = 1500)', () => {
      const pending25 = schedule19.todayPending.find(
        (i) => i.loanNo === 'ABC/LOAN/2026/000001' && i.installmentNumber === 25
      );
      assert.ok(pending25, 'Installment #25 must appear in todayPending tab as of 19/10/2026');
      assert.strictEqual(pending25.pendingAmount, 1500);
    });

    test('19/10: Collected Today is empty (0 collections recorded on 19/10)', () => {
      assert.strictEqual(schedule19.collectedToday.length, 0);
      assert.strictEqual(schedule19.summary.todayCollectedAmount, 0);
    });

    // -------------------------------------------------------------------------
    // TEST SUITE 3: 23/10/2026 (Collection Day for Receipt #27)
    // -------------------------------------------------------------------------
    console.log('\nScenario 3: 23/10/2026 — Installment #29 Due, Receipt #27 Recorded');
    const schedule23 = await getCollectionSchedule('2026-10-23');

    test('23/10: Summary reconciled flag is true', () => {
      assert.strictEqual(schedule23.summary.reconciled, true);
    });

    test('23/10: Mathematical reconciliation: Due === CollectedOnDue + Pending', () => {
      const { todayDueAmount, todayCollectedOnDue, todayPendingAmount } = schedule23.summary;
      assert.strictEqual(
        todayDueAmount,
        todayCollectedOnDue + todayPendingAmount,
        `Expected ${todayDueAmount} === ${todayCollectedOnDue} + ${todayPendingAmount}`
      );
    });

    test('23/10: Collected Today contains Receipt #27 (₹1,500)', () => {
      const rcpt27 = schedule23.collectedToday.find(
        (p) => p.paymentNo === 'ABC/RCPT/2026/000027'
      );
      assert.ok(rcpt27, 'Receipt #27 should appear in collectedToday for 23/10/2026');
      assert.strictEqual(rcpt27.amount, 1500);
      assert.strictEqual(rcpt27.loanNo, 'ABC/LOAN/2026/000001');
    });

    test('23/10: Receipt #27 actual payment date and record integrity preserved', () => {
      const rcpt27 = schedule23.collectedToday.find(
        (p) => p.paymentNo === 'ABC/RCPT/2026/000027'
      );
      assert.ok(rcpt27);
      const paymentDate = new Date(rcpt27.date);
      // Date should be 2026-10-23 in IST
      assert.strictEqual(paymentDate.getUTCFullYear(), 2026);
      assert.strictEqual(paymentDate.getUTCMonth(), 9); // October (0-indexed)
      assert.strictEqual(paymentDate.getUTCDate(), 23);
    });

    test('23/10: Installment #29 (due 23/10) is pending ₹1,500 (since Receipt #27 paid inst #25)', () => {
      const item29 = schedule23.todayDue.find(
        (i) => i.loanNo === 'ABC/LOAN/2026/000001' && i.installmentNumber === 29
      );
      assert.ok(item29, 'Installment #29 should be in todayDue on 23/10');
      assert.strictEqual(item29.pendingAmount, 1500);
      assert.strictEqual(item29.status, 'PENDING');
      assert.strictEqual(item29.paidLater, false);
    });

    console.log('\n================================================================');
    console.log(`RESULTS: ${passed} passed, ${failed} failed`);
    console.log('================================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

runRegressionTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
