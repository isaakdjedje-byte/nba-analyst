import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load test environment
dotenv.config({ path: path.resolve(__dirname, '.env.test') });

// Determine current epic from .current-epic file
function getCurrentEpic(): string {
  try {
    const epicFile = path.resolve(__dirname, '.current-epic');
    if (fs.existsSync(epicFile)) {
      return fs.readFileSync(epicFile, 'utf-8').trim();
    }
  } catch (e) {
    console.warn('Could not read .current-epic, defaulting to all');
  }
  return 'all';
}

const currentEpic = getCurrentEpic();
console.log(`Running tests for Epic: ${currentEpic}`);

// Define test projects based on epic
const getProjects = () => {
  const epic1Projects = [
    {
      name: 'epic-1-auth',
      testMatch: [
        '**/e2e/smoke-tests.spec.ts',
      ],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'epic-1-auth-mobile',
      testMatch: [
        '**/e2e/smoke-tests.spec.ts',
      ],
      use: { ...devices['Pixel 5'] },
    },
  ];

  const epic2Projects = [
    {
      name: 'epic-2-data',
      testMatch: /\/(api)\/.*(data|db|cache|decisions|policy|risk|runs)\.(spec|test)\./,
      grep: /@epic2/,
      use: { ...devices['Desktop Chrome'] },
    },
  ];

  const epic3Projects = [
    {
      name: 'epic-3-ux',
      testMatch: /\/(e2e)\/.*(dashboard|picks|decision|ux)\.(spec|test)\./,
      grep: /@epic3/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'epic-3-ux-mobile',
      grep: /@epic3/,
      use: { ...devices['Pixel 5'] },
    },
  ];

  const epic4Projects = [
    {
      name: 'epic-4-admin',
      testMatch: /\/(api)\/.*(admin|mfa|role|users-crud|audit)\.(spec|test)\./,
      grep: /@epic4/,
      use: { ...devices['Desktop Chrome'] },
    },
  ];

  const epic5Projects = [
    {
      name: 'epic-5-policy',
      testMatch: /\/(api)\/.*(policy|governance|admin)\.(spec|test)\./,
      grep: /@epic5/,
      use: { ...devices['Desktop Chrome'] },
    },
  ];

  const epic6Projects = [
    {
      name: 'epic-6-b2b',
      testMatch: /\/(api)\/.*(v1|b2b|integration)\.(spec|test)\./,
      grep: /@epic6/,
      use: { ...devices['Desktop Chrome'] },
    },
  ];

  const allProjects = [
    ...epic1Projects,
    ...epic2Projects,
    ...epic3Projects,
    ...epic4Projects,
    ...epic5Projects,
    ...epic6Projects,
  ];

  // Filter projects based on current epic
  if (currentEpic === 'all') {
    return [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
      { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
      { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
      { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
    ];
  }

  // Return only projects for current epic
  const epicNum = parseInt(currentEpic);
  switch (epicNum) {
    case 1:
      return epic1Projects;
    case 2:
      return epic2Projects;
    case 3:
      return epic3Projects;
    case 4:
      return epic4Projects;
    case 5:
      return epic5Projects;
    case 6:
      return epic6Projects;
    default:
      return allProjects;
  }
};

export default defineConfig({
  testDir: './tests',
  testMatch: /(api|e2e)\/.*\.(spec|test)\.(ts|js)$/, // Only run API and E2E tests (not component/unit)
  testIgnore: [
    '**/unit/**',
    '**/integration/**',
    '**/component/**', // Component tests need separate config
    '**/*.test.ts', // Ignore Vitest tests
  ],
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
    viewport: { width: 1280, height: 720 },
    storageState: process.env.AUTH_FILE || undefined,
  },

  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}-{projectName}{ext}',

  projects: process.env.CI ? getProjects() : [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 12'] } },
  ],

  webServer: {
    command: process.env.CI ? 'npm start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
