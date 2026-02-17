/**
 * Global Setup for Playwright Tests
 * Runs once before all test suites
 */

import { execSync } from "child_process";

async function globalSetup() {
  console.log("🚀 Global Setup: Initializing test environment...");

  // Ensure we're using test environment
  process.env.NODE_ENV = "test";

  try {
    // Setup test database
    console.log("📦 Setting up test database...");
    execSync("npx prisma migrate deploy", {
      env: process.env,
      stdio: "inherit",
    });

    // Seed test users
    console.log("👤 Creating test users...");
    await import("./seed-users");

    console.log("✅ Global setup complete");
  } catch (error) {
    console.error("❌ Global setup failed:", error);
    throw error;
  }
}

export default globalSetup;
