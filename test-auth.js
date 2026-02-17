const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function test() {
  console.log('Testing auth...');
  
  const user = await prisma.user.findUnique({
    where: { email: 'user@example.com' }
  });
  
  console.log('User found:', !!user);
  console.log('Has password:', !!user?.password);
  
  if (user?.password) {
    console.log('Password hash:', user.password.substring(0, 30) + '...');
    const valid = await bcrypt.compare('password123', user.password);
    console.log('Password valid:', valid);
  }
  
  await prisma.$disconnect();
}

test().catch(console.error);
