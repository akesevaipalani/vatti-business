const { PrismaClient } = require("@prisma/client");
const path = require("path");
const fs = require("fs");

async function inspect(dbPath, label) {
  console.log("=== " + label + ": " + dbPath + " ===");
  if (!fs.existsSync(dbPath)) {
    console.log("Not found");
    return null;
  }
  console.log("Size:", fs.statSync(dbPath).size, "bytes");
  const prisma = new PrismaClient({ datasources: { db: { url: "file:" + dbPath } } });

  const counts = {
    partners: await prisma.partner.count(),
    partnerInvestments: await prisma.partnerInvestment.count(),
    partnerWithdrawals: await prisma.partnerWithdrawal.count(),
    partnerProfitAllocations: await prisma.partnerProfitAllocation.count(),
    partnerSettlements: await prisma.partnerSettlement.count(),
    customers: await prisma.customer.count(),
    loans: await prisma.loan.count(),
    loanInstallments: await prisma.loanInstallment.count(),
    loanPayments: await prisma.loanPayment.count(),
    guarantors: await prisma.guarantor.count(),
    collaterals: await prisma.collateral.count(),
    incomes: await prisma.income.count(),
    expenses: await prisma.expense.count(),
    bankTransactions: await prisma.bankTransaction.count(),
    sales: await prisma.sale.count(),
    purchases: await prisma.purchase.count(),
    products: await prisma.product.count(),
    assets: await prisma.asset.count(),
    liabilities: await prisma.liability.count(),
    ledgerTransactions: await prisma.ledgerTransaction.count(),
    ledgerEntries: await prisma.ledgerEntry.count(),
    auditLogs: await prisma.auditLog.count(),
    dailyClosings: await prisma.dailyClosing.count(),
    reminders: await prisma.reminder.count(),
    users: await prisma.user.count(),
    businessProfiles: await prisma.businessProfile.count(),
    cashAccounts: await prisma.cashAccount.count(),
    ledgerAccounts: await prisma.ledgerAccount.count(),
  };

  console.log(JSON.stringify(counts, null, 2));

  // Partner summary
  const partners = await prisma.partner.findMany();
  console.log("\nPartners Details:");
  partners.forEach(p => console.log(`  ${p.name}: Capital = ₹${p.currentCapital}`));

  // Loans details
  const loans = await prisma.loan.findMany({ include: { customer: true } });
  console.log("\nLoans Details:");
  loans.forEach(l => console.log(`  Loan: ${l.loanNo}, Customer: ${l.customer?.name}, Principal: ₹${l.principalAmount}`));

  // Ledger transactions
  const txs = await prisma.ledgerTransaction.findMany();
  console.log("\nLedger Transactions Details:");
  txs.forEach(t => console.log(`  ${t.transactionNo}: ${t.description} (RefType: ${t.referenceType}, RefId: ${t.referenceId})`));

  await prisma.$disconnect();
  return counts;
}

async function main() {
  await inspect(path.resolve("prisma/vatti.db"), "Template DB");
  await inspect(path.join(process.env.APPDATA, "VATTI BUSINESS", "vatti.db"), "AppData DB");
}

main().catch(console.error);
