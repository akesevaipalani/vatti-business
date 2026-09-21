const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function seedPartnerUsers() {
  console.log('=== SEEDING PARTNER USER ACCOUNTS ===');
  const prisma = new PrismaClient();

  const partnerConfigs = [
    {
      partnerName: 'ALAKESH KUMAR',
      username: 'alakesh',
      password: 'alakesh123',
      name: 'Alakesh Kumar (Partner 1)',
      pinCode: '1111',
    },
    {
      partnerName: 'BALAMURUGAN',
      username: 'balamurugan',
      password: 'balamurugan123',
      name: 'Balamurugan (Partner 2)',
      pinCode: '2222',
    },
    {
      partnerName: 'KANNAN',
      username: 'kannan',
      password: 'kannan123',
      name: 'Kannan (Partner 3)',
      pinCode: '3333',
    },
  ];

  const defaultPartnerPermissions = {
    canCollectPayments: true,
    canViewCustomers: true,
    canCreateCustomers: true,
    canCreateLoans: true,
    canDisburseLoans: false,
    canViewAllLoans: true,
    canViewAllPartners: false,
    canViewReports: true,
    canManageSettings: false,
    canManageBackups: false,
    canManagePartners: false,
  };

  for (const config of partnerConfigs) {
    const partner = await prisma.partner.findFirst({
      where: { name: config.partnerName },
    });

    if (!partner) {
      console.warn(`Partner "${config.partnerName}" not found in database!`);
      continue;
    }

    const passwordHash = await bcrypt.hash(config.password, 10);

    const existingUser = await prisma.user.findUnique({
      where: { username: config.username },
    });

    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          partnerId: partner.id,
          role: 'PARTNER',
          name: config.name,
          permissions: JSON.stringify(defaultPartnerPermissions),
          passwordHash,
        },
      });
      console.log(`Updated user account: ${config.username} -> Partner: ${partner.name}`);
    } else {
      await prisma.user.create({
        data: {
          username: config.username,
          passwordHash,
          name: config.name,
          role: 'PARTNER',
          partnerId: partner.id,
          pinCode: config.pinCode,
          permissions: JSON.stringify(defaultPartnerPermissions),
        },
      });
      console.log(`Created user account: ${config.username} -> Partner: ${partner.name}`);
    }
  }

  console.log('\nAll 3 partner user accounts created/updated successfully!');
  const allUsers = await prisma.user.findMany({ include: { partner: true } });
  console.log('\nDatabase Users:');
  allUsers.forEach(u => console.log(`  - ${u.username} (${u.role}): ${u.name} [Partner: ${u.partner?.name || 'None'}]`));

  await prisma.$disconnect();
}

seedPartnerUsers().catch(err => {
  console.error('Seeding partner users failed:', err);
  process.exit(1);
});
