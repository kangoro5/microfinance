require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const superPass = await bcrypt.hash(process.env.SEED_SUPERADMIN_PASSWORD || 'ChangeMe123!', 10);
  const adminPass = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!', 10);
  const memberPass = await bcrypt.hash(process.env.SEED_MEMBER_PASSWORD || 'ChangeMe123!', 10);

  await prisma.user.upsert({
    where: { email: process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@jehomes.test' },
    update: {},
    create: {
      role: 'SUPER_ADMIN',
      email: process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@jehomes.test',
      name: 'Super Admin',
      passwordHash: superPass,
    },
  });
  console.log('Seeded Super Admin');

  const adminDefs = [
    { fullName: 'Admin One', email: 'admin1@jehomes.test', phone: '0700000001' },
  ];

  const admins = [];
  for (const def of adminDefs) {
    const existingUser = await prisma.user.findUnique({ where: { email: def.email } });
    if (existingUser) {
      const admin = await prisma.admin.findUnique({ where: { userId: existingUser.id } });
      admins.push(admin);
      continue;
    }
    const admin = await prisma.admin.create({
      data: {
        fullName: def.fullName,
        phone: def.phone,
        user: { create: { role: 'ADMIN', email: def.email, name: def.fullName, passwordHash: adminPass } },
      },
    });
    admins.push(admin);
  }
  console.log(`Seeded ${admins.length} Admins`);

  // One sample member + two independent accounts under the first admin
  const samplePhone = '0711000001';
  let member = await prisma.member.findUnique({ where: { phone: samplePhone } });
  if (!member) {
    member = await prisma.member.create({
      data: {
        fullName: 'Jane Sample Member',
        phone: samplePhone,
        nationalId: '12345678',
        address: 'Nairobi, Kenya',
        nextOfKin: 'John Sample',
        admin: { connect: { id: admins[0].id } },
        user: { create: { role: 'MEMBER', name: 'Jane Sample Member', passwordHash: memberPass } },
      },
    });

    await prisma.account.create({
      data: {
        accountNumber: 'SV-100001',
        memberId: member.id,
        type: 'SAVINGS',
        openingBalance: 5000,
        balance: 5000,
        interestRate: 5,
        frequency: 'MONTHLY',
      },
    });
    await prisma.account.create({
      data: {
        accountNumber: 'LN-200001',
        memberId: member.id,
        type: 'LOAN',
        openingBalance: 20000,
        balance: 20000,
        interestRate: 12,
        frequency: 'MONTHLY',
      },
    });
    console.log('Seeded sample member with 2 independent accounts');
  }

  const superAdminPassword = process.env.SEED_SUPERADMIN_PASSWORD || 'ChangeMe123!';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!';
  const memberPassword = process.env.SEED_MEMBER_PASSWORD || 'ChangeMe123!';

  console.log('\nSeed complete. Sample logins:');
  console.log(`  Super Admin: ${process.env.SEED_SUPERADMIN_EMAIL || 'superadmin@jehomes.test'} / ${superAdminPassword}`);
  console.log(`  Admin:       admin1@jehomes.test / ${adminPassword}`);
  console.log(`  Member:      phone ${samplePhone} / ${memberPassword}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
