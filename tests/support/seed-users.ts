/**
 * Seed Test Users
 * Creates test users for RBAC testing
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function seedUsers() {
  console.log("🌱 Seeding test users...");

  const passwordHash = await bcrypt.hash("test123", 10);

  const testUsers = [
    {
      email: "admin@test.com",
      name: "Test Admin",
      password: passwordHash,
      role: "admin" as const,
    },
    {
      email: "ops@test.com",
      name: "Test Ops",
      password: passwordHash,
      role: "ops" as const,
    },
    {
      email: "support@test.com",
      name: "Test Support",
      password: passwordHash,
      role: "support" as const,
    },
    {
      email: "user@test.com",
      name: "Test User",
      password: passwordHash,
      role: "user" as const,
    },
  ];

  for (const user of testUsers) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: user,
    });
    console.log(`  ✅ Created user: ${user.email} (${user.role})`);
  }

  await prisma.$disconnect();
  console.log("🎉 Test users seeded successfully");
}

// Run if called directly
if (require.main === module) {
  seedUsers().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export { seedUsers };
