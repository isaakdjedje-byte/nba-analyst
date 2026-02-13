import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// Load test environment (optional - dotenv may not be available in CI)
try {
  const dotenv = require('dotenv');
  dotenv.config({ path: path.resolve(__dirname, '.env.test') });
} catch {
  // dotenv not available, continue without it
}

// Alternative: Use dynamic import for ESM compatibility
// import dotenv from 'dotenv';
// dotenv.config({ path: path.resolve(__dirname, '.env.test') });

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 3 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Enable visual comparisons
    viewport: { width: 1280, height: 720 },
    // Storage state for authentication
    storageState: process.env.AUTH_FILE || undefined,
  },

  // Global setup disabled for unit tests - enable for integration tests
  // globalSetup: require.resolve('./tests/support/global-setup'),
  // globalTeardown: require.resolve('./tests/support/global-teardown'),

  // Configure snapshot path template for visual regression
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}-{projectName}{ext}',

  projects: process.env.CI 
    ? [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ]
    : [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'firefox',
          use: { ...devices['Desktop Firefox'] },
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
        },
        {
          name: 'Mobile Chrome',
          use: { ...devices['Pixel 5'] },
        },
        {
          name: 'Mobile Safari',
          use: { ...devices['iPhone 12'] },
        },
      ],

  webServer: {
    command: process.env.CI ? 'npm start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
