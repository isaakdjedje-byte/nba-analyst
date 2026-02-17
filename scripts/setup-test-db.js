/**
 * Setup Test Database Script
 * Creates test database and seeds test users
 */

const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.resolve(__dirname, '../.env.test') });

const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

// Use test database URL
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL not set in .env.test');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: databaseUrl,
    },
  },
});

async function setupTestDatabase() {
  console.log('🚀 Setting up test database...');

  try {
    // Run Prisma migrations
    console.log('📦 Running migrations...');
    execSync('npx prisma migrate deploy', {
      stdio: 'inherit',
      env: process.env
    });

    // Seed test users
    console.log('👤 Creating test users...');
    const passwordHash = await bcrypt.hash('test123', 10);

    const testUsers = [
      { email: 'admin@test.com', name: 'Test Admin', password: passwordHash, role: 'admin' },
      { email: 'ops@test.com', name: 'Test Ops', password: passwordHash, role: 'ops' },
      { email: 'support@test.com', name: 'Test Support', password: passwordHash, role: 'support' },
      { email: 'user@test.com', name: 'Test User', password: passwordHash, role: 'user' },
    ];

    for (const user of testUsers) {
      await prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: user,
      });
      console.log(`  ✅ ${user.email} (${user.role})`);
    }

    console.log('✅ Test database setup complete!');
    console.log('');
    console.log('Test Users:');
    console.log('  admin@test.com / test123 (role: admin)');
    console.log('  ops@test.com / test123 (role: ops)');
    console.log('  support@test.com / test123 (role: support)');
    console.log('  user@test.com / test123 (role: user)');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupTestDatabase();
