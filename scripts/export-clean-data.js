const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

async function exportCleanData() {
  console.log('=== VATTI BUSINESS - CLEAN DATA EXPORT TOOL ===');
  const prisma = new PrismaClient();

  const data = {
    exportDate: new Date().toISOString(),
    version: '1.0.0',
    businessProfile: await prisma.businessProfile.findMany(),
    users: await prisma.user.findMany(),
    partners: await prisma.partner.findMany(),
    partnerInvestments: await prisma.partnerInvestment.findMany(),
    cashAccounts: await prisma.cashAccount.findMany(),
    ledgerAccounts: await prisma.ledgerAccount.findMany(),
    ledgerTransactions: await prisma.ledgerTransaction.findMany(),
    ledgerEntries: await prisma.ledgerEntry.findMany(),
    auditLogs: await prisma.auditLog.findMany(),
    // Zero-check tables
    customersCount: await prisma.customer.count(),
    loansCount: await prisma.loan.count(),
    incomeCount: await prisma.income.count(),
    expenseCount: await prisma.expense.count(),
  };

  // Validate partners & capital
  const totalCapital = data.partners.reduce((sum, p) => sum + Number(p.currentCapital), 0);
  console.log(`Partners found: ${data.partners.length}`);
  data.partners.forEach(p => console.log(`  - ${p.name}: ₹${p.currentCapital}`));
  console.log(`Total Partner Capital: ₹${totalCapital}`);

  if (totalCapital !== 150000 || data.partners.length !== 3) {
    throw new Error(`Data validation failed! Expected ₹1,50,000 across 3 partners, got ₹${totalCapital}`);
  }

  if (data.customersCount !== 0 || data.loansCount !== 0) {
    throw new Error(`Data validation failed! Customers or loans are not zero.`);
  }

  const exportPath = path.resolve(__dirname, '..', 'backups', 'clean_partner_export.json');
  fs.writeFileSync(exportPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\nSuccessfully exported clean verified partner dataset to:\n${exportPath}`);

  await prisma.$disconnect();
}

exportCleanData().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
