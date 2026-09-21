const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function check() {
  const pts = await p.partner.findMany();
  console.log('=== PARTNER DATA VERIFICATION ===');
  pts.forEach(x => console.log(`  - ${x.name}: ₹${x.currentCapital}`));
  const total = pts.reduce((a, b) => a + Number(b.currentCapital), 0);
  console.log(`Total Capital: ₹${total}`);
  console.log(`Customers: ${await p.customer.count()}`);
  console.log(`Loans: ${await p.loan.count()}`);
  console.log(`Installments: ${await p.loanInstallment.count()}`);
  console.log(`Payments: ${await p.loanPayment.count()}`);
  console.log(`Income: ${await p.income.count()}`);
  console.log(`Expense: ${await p.expense.count()}`);
  
  console.log('\n=== USERS VERIFICATION ===');
  const users = await p.user.findMany({ include: { partner: true } });
  users.forEach(u => console.log(`  - ${u.username} (${u.role}): ${u.name} [Partner: ${u.partner?.name || 'None'}]`));
  
  await p.$disconnect();
}

check().catch(console.error);
