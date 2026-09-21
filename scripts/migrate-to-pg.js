require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function migrateToPg() {
  console.log('=== VATTI BUSINESS - POSTGRESQL MIGRATION UTILITY ===');
  const targetUrl = process.env.POSTGRES_URL || process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;

  if (!targetUrl) {
    console.log('Usage:');
    console.log('  Configure DATABASE_URL in .env or set $env:DATABASE_URL');
    console.log('  node scripts/migrate-to-pg.js');
    console.log('\nError: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  // Mask sensitive credentials
  const maskedUrl = targetUrl.replace(/:[^:@]+@/, ':****@');
  console.log(`Target Database: ${maskedUrl}`);

  let exportPath = path.resolve(__dirname, '..', 'backups', 'verified_clean_partner_export.json');
  if (!fs.existsSync(exportPath)) {
    exportPath = path.resolve(__dirname, '..', 'backups', 'clean_partner_export.json');
  }
  if (!fs.existsSync(exportPath)) {
    console.log('Clean export file not found. Running export script first...');
    execSync('node scripts/export-clean-data.js', { stdio: 'inherit' });
  }

  const rawData = fs.readFileSync(exportPath, 'utf8');
  const data = JSON.parse(rawData);
  console.log(`Loaded dataset from ${path.basename(exportPath)} with ${data.partners.length} partners (₹${data.partners.reduce((s, p) => s + p.currentCapital, 0)})`);

  console.log('\nStep 1: Checking PostgreSQL schema readiness...');
  const { PrismaClient } = require('@prisma/client');
  const pgPrisma = new PrismaClient({
    datasources: { db: { url: targetUrl } }
  });

  try {
    const tableCheck = await pgPrisma.$queryRawUnsafe(`
      SELECT count(*) as count FROM information_schema.tables WHERE table_schema = 'public'
    `);
    const tableCount = parseInt(tableCheck[0].count, 10);
    console.log(`Verified ${tableCount} existing tables in PostgreSQL public schema.`);
    if (tableCount === 0) {
      console.log('Pushing schema to PostgreSQL database...');
      execSync(`npx prisma db push --schema=prisma/schema.postgresql.prisma`, {
        stdio: 'inherit',
        env: { ...process.env, DATABASE_URL: targetUrl }
      });
    } else {
      console.log('Schema is already applied and up-to-date. Skipping redundant db push.');
    }
  } catch (err) {
    console.log('Schema check note:', err.message);
  }

  console.log('\nStep 2: Connecting to target PostgreSQL instance via Prisma Client...');

  try {
    console.log('Importing BusinessProfile...');
    for (const bp of data.businessProfile) {
      await pgPrisma.businessProfile.upsert({
        where: { id: bp.id },
        update: bp,
        create: bp
      });
    }

    console.log('Importing LedgerAccounts...');
    for (const la of data.ledgerAccounts) {
      await pgPrisma.ledgerAccount.upsert({
        where: { code: la.code },
        update: la,
        create: la
      });
    }

    console.log('Importing CashAccounts...');
    for (const ca of data.cashAccounts) {
      await pgPrisma.cashAccount.upsert({
        where: { id: ca.id },
        update: ca,
        create: ca
      });
    }

    console.log('Importing Partners...');
    for (const p of data.partners) {
      await pgPrisma.partner.upsert({
        where: { id: p.id },
        update: p,
        create: p
      });
    }

    console.log('Importing PartnerInvestments...');
    for (const pi of data.partnerInvestments) {
      await pgPrisma.partnerInvestment.upsert({
        where: { id: pi.id },
        update: pi,
        create: pi
      });
    }

    console.log('Importing Users...');
    for (const u of data.users) {
      await pgPrisma.user.upsert({
        where: { id: u.id },
        update: u,
        create: u
      });
    }

    console.log('Importing LedgerTransactions...');
    for (const lt of data.ledgerTransactions) {
      await pgPrisma.ledgerTransaction.upsert({
        where: { id: lt.id },
        update: lt,
        create: lt
      });
    }

    console.log('Importing LedgerEntries...');
    for (const le of data.ledgerEntries) {
      await pgPrisma.ledgerEntry.upsert({
        where: { id: le.id },
        update: le,
        create: le
      });
    }

    console.log('\nStep 3: Verifying PostgreSQL data integrity...');
    const pgPartners = await pgPrisma.partner.findMany({ orderBy: { partnerCode: 'asc' } });
    const pgTotalCapital = pgPartners.reduce((s, p) => s + Number(p.currentCapital), 0);
    const pgCustomers = await pgPrisma.customer.count();
    const pgLoans = await pgPrisma.loan.count();
    const pgInstallments = await pgPrisma.loanInstallment.count();
    const pgPayments = await pgPrisma.loanPayment.count();
    const pgIncome = await pgPrisma.income.count();
    const pgExpenses = await pgPrisma.expense.count();
    const pgCashAccount = await pgPrisma.cashAccount.findUnique({ where: { id: 'main-cash' } });
    const pgLedger1010 = await pgPrisma.ledgerAccount.findUnique({ where: { code: '1010' } });
    const pgLedger1030 = await pgPrisma.ledgerAccount.findUnique({ where: { code: '1030' } });
    const pgLedger3020 = await pgPrisma.ledgerAccount.findUnique({ where: { code: '3020' } });

    console.log(`PostgreSQL Partners (${pgPartners.length}):`);
    pgPartners.forEach(p => console.log(`  - ${p.partnerCode}: ${p.name} = ₹${p.currentCapital}`));
    console.log(`PostgreSQL Total Partner Capital: ₹${pgTotalCapital}`);
    console.log(`PostgreSQL Customers: ${pgCustomers}`);
    console.log(`PostgreSQL Loans: ${pgLoans}`);
    console.log(`PostgreSQL LoanInstallments: ${pgInstallments}`);
    console.log(`PostgreSQL LoanPayments: ${pgPayments}`);
    console.log(`PostgreSQL Income: ${pgIncome}`);
    console.log(`PostgreSQL Expenses: ${pgExpenses}`);
    console.log(`PostgreSQL CashAccount (main-cash): ₹${pgCashAccount?.currentBalance}`);
    console.log(`PostgreSQL Ledger 1010 (Cash-in-Hand): ₹${pgLedger1010?.balance}`);
    console.log(`PostgreSQL Ledger 1030 (Loans Receivable): ₹${pgLedger1030?.balance}`);
    console.log(`PostgreSQL Ledger 3020 (Partner Capital): ₹${pgLedger3020?.balance}`);

    const pgProducts = await pgPrisma.product.count();
    const pgSales = await pgPrisma.sale.count();
    const pgPurchases = await pgPrisma.purchase.count();

    // Check Debits = Credits in Ledger
    const txAgg = await pgPrisma.ledgerTransaction.aggregate({
      _sum: { debitTotal: true, creditTotal: true }
    });
    const entryDebits = await pgPrisma.ledgerEntry.aggregate({
      where: { entryType: 'DEBIT' },
      _sum: { amount: true }
    });
    const entryCredits = await pgPrisma.ledgerEntry.aggregate({
      where: { entryType: 'CREDIT' },
      _sum: { amount: true }
    });

    const debitsTotal = entryDebits._sum.amount || 0;
    const creditsTotal = entryCredits._sum.amount || 0;
    const totalAssets = (pgLedger1010?.balance || 0) + (pgLedger1030?.balance || 0);
    const totalLiabilities = 0;
    const totalEquity = pgLedger3020?.balance || 0;

    console.log(`PostgreSQL Products / Stock: ${pgProducts}`);
    console.log(`PostgreSQL Sales: ${pgSales}`);
    console.log(`PostgreSQL Purchases: ${pgPurchases}`);
    console.log(`Ledger Debits: ₹${debitsTotal} | Ledger Credits: ₹${creditsTotal} (Debits = Credits: ${debitsTotal === creditsTotal})`);
    console.log(`Assets: ₹${totalAssets} | Liabilities: ₹${totalLiabilities} | Equity: ₹${totalEquity} (Assets = Equity: ${totalAssets === totalEquity})`);

    const isValid = (
      pgPartners.length === 3 &&
      pgTotalCapital === 150000 &&
      pgCustomers === 0 &&
      pgLoans === 0 &&
      pgInstallments === 0 &&
      pgPayments === 0 &&
      pgIncome === 0 &&
      pgExpenses === 0 &&
      pgProducts === 0 &&
      pgSales === 0 &&
      pgPurchases === 0 &&
      pgCashAccount?.currentBalance === 150000 &&
      pgLedger1010?.balance === 150000 &&
      pgLedger1030?.balance === 0 &&
      pgLedger3020?.balance === 150000 &&
      debitsTotal === 150000 &&
      creditsTotal === 150000 &&
      totalAssets === 150000 &&
      totalEquity === 150000
    );

    if (isValid) {
      console.log('\n>>> MIGRATION CERTIFICATE: PASSED 100% <<<');
      console.log('All financial balances, zero-inventory state, Debits=Credits, and Assets=Equity verified in Supabase PostgreSQL.');
    } else {
      throw new Error('Verification failed: Totals/balances do not match clean partner state!');
    }
  } finally {
    await pgPrisma.$disconnect();
  }
}

migrateToPg().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
