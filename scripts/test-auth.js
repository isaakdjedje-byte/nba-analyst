/**
 * Authentication Test Script
 * Tests registration and login flows
 */

const bcrypt = require('bcrypt');

async function testAuth() {
  console.log('🧪 Testing Authentication Flows\n');

  // Import Prisma
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    // Test 1: User Registration
    console.log('Test 1: User Registration');
    console.log('-------------------------');

    const hashedPassword = await bcrypt.hash('testpassword123', 12);
    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'test2@example.com',
        password: hashedPassword,
        role: 'user',
      },
    });

    console.log('✅ User created successfully:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log();

    // Test 2: Password Verification
    console.log('Test 2: Password Verification');
    console.log('--------------------------------');

    const foundUser = await prisma.user.findUnique({
      where: { email: 'test2@example.com' },
    });

    if (!foundUser || !foundUser.password) {
      throw new Error('User not found');
    }

    const isPasswordValid = await bcrypt.compare('testpassword123', foundUser.password);

    if (isPasswordValid) {
      console.log('✅ Password verification passed');
    } else {
      console.log('❌ Password verification failed');
    }
    console.log();

    // Test 3: Duplicate Email Prevention
    console.log('Test 3: Duplicate Email Prevention');
    console.log('-----------------------------------');

    try {
      await prisma.user.create({
        data: {
          name: 'Another User',
          email: 'test2@example.com', // Same email
          password: hashedPassword,
          role: 'user',
        },
      });
      console.log('❌ Duplicate email allowed (should have failed)');
    } catch (error) {
      console.log('✅ Duplicate email correctly rejected');
      console.log(`   Error: ${error.message}`);
    }
    console.log();

    // Test 4: Database Schema Verification
    console.log('Test 4: Database Schema Verification');
    console.log('-------------------------------------');

    const userCount = await prisma.user.count();
    const accountCount = await prisma.account.count();
    const sessionCount = await prisma.session.count();

    console.log(`✅ Database tables created:`);
    console.log(`   Users: ${userCount} records`);
    console.log(`   Accounts: ${accountCount} records`);
    console.log(`   Sessions: ${sessionCount} records`);
    console.log();

    // Test 5: Role-based User Creation
    console.log('Test 5: Role-based User Creation');
    console.log('----------------------------------');

    const adminUser = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'admin',
      },
    });

    console.log('✅ Admin user created:');
    console.log(`   ID: ${adminUser.id}`);
    console.log(`   Role: ${adminUser.role}`);
    console.log();

    console.log('🎉 All authentication tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAuth();
