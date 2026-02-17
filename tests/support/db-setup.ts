/**
 * Database Setup for Tests
 * Handles test database initialization and cleanup
 */

import { execSync } from "child_process";
import { prisma } from "../../src/server/db/client";

/**
 * Setup test database
 * Runs migrations and seeds test data
 */
export async function setupTestDatabase(): Promise<void> {
  console.log("Setting up test database...");

  try {
    // Run migrations
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, NODE_ENV: "test" },
      stdio: "inherit",
    });

    console.log("Test database setup complete");
  } catch (error) {
    console.error("Failed to setup test database:", error);
    throw error;
  }
}

/**
 * Clean up test data
 * Removes all test data between test runs
 */
export async function cleanupTestData(): Promise<void> {
  console.log("Cleaning up test data...");

  try {
    // Delete in order to respect foreign key constraints
    await prisma.auditLog.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.account.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: "@test.com",
        },
      },
    });

    console.log("Test data cleanup complete");
  } catch (error) {
    console.error("Failed to cleanup test data:", error);
    // Don't throw - cleanup failure shouldn't fail tests
  }
}

/**
 * Create test users in database
 */
export async function createTestUsers(): Promise<void> {
  const bcrypt = require("bcrypt");
  const hashedPassword = await bcrypt.hash("test123", 10);

  const users = [
    {
      email: "admin@test.com",
      name: "Test Admin",
      password: hashedPassword,
      role: "admin",
    },
    {
      email: "ops@test.com",
      name: "Test Ops",
      password: hashedPassword,
      role: "ops",
    },
    {
      email: "support@test.com",
      name: "Test Support",
      password: hashedPassword,
      role: "support",
    },
    {
      email: "user@test.com",
      name: "Test User",
      password: hashedPassword,
      role: "user",
    },
  ];

  for (const userData of users) {
    await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: userData,
    });
  }

  console.log("Test users created");
}

/**
 * Global teardown
 */
export async function teardownTestDatabase(): Promise<void> {
  await prisma.$disconnect();
}
