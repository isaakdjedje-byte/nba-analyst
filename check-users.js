const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function checkUsers() {
  const users = await prisma.user.findMany({
    select: { email: true, password: true, role: true }
  });

  console.log('=== Users in database ===\n');

  for (const u of users) {
    console.log('Email:', u.email);
    console.log('Role:', u.role);
    console.log('Password hash:', u.password ? u.password.substring(0, 40) + '...' : 'NULL');

    // Test password
    const isValid = await bcrypt.compare('password123', u.password);
    console.log('Password "password123" valid?:', isValid);
    console.log('---');
  }

  await prisma.$disconnect();
}

checkUsers().catch(e => {
  console.error(e);
  process.exit(1);
});
