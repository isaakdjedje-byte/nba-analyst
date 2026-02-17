/**
 * Global Teardown for Playwright Tests
 * Runs once after all test suites
 */

async function globalTeardown() {
  console.log("🧹 Global Teardown: Cleaning up...");

  try {
    // Cleanup is handled in individual tests
    // This is where you'd cleanup shared resources if needed

    console.log("✅ Global teardown complete");
  } catch (error) {
    console.error("❌ Global teardown failed:", error);
    // Don't throw - teardown failure shouldn't fail the test run
  }
}

export default globalTeardown;
