/**
 * E2E Test Helpers - Database
 * Test database setup and teardown for daily run pipeline E2E tests
 *
 * Story: 2.10 - Implementer les tests E2E du pipeline daily run
 */

import { PrismaClient } from '@prisma/client';
import { createClient, RedisClientType } from 'redis';

export interface TestEnvironment {
  prisma: PrismaClient;
  redis: RedisClientType | null;
  databaseUrl: string;
  isInitialized: boolean;
}

// Global test environment instance
let testEnvironment: TestEnvironment | null = null;

/**
 * Initialize test environment with database and cache
 */
export async function setupTestEnvironment(): Promise<TestEnvironment> {
  if (testEnvironment?.isInitialized) {
    return testEnvironment;
  }

  // Use test database URL from environment or default
  const databaseUrl = process.env.DATABASE_URL || 'file:./test.db';
  
  // Initialize Prisma with test database
  const prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });

  // Initialize Redis if available (optional for E2E tests)
  let redis: RedisClientType | null = null;
  try {
    if (process.env.REDIS_URL) {
      redis = createClient({ url: process.env.REDIS_URL });
      await redis.connect();
    }
  } catch (error) {
    console.warn('Redis not available for E2E tests:', error);
  }

  testEnvironment = {
    prisma,
    redis,
    databaseUrl,
    isInitialized: true,
  };

  return testEnvironment;
}

/**
 * Clean up test environment
 */
export async function teardownTestEnvironment(): Promise<void> {
  if (testEnvironment?.prisma) {
    await testEnvironment.prisma.$disconnect();
  }
  if (testEnvironment?.redis) {
    await testEnvironment.redis.quit();
  }
  testEnvironment = null;
}

/**
 * Clear all test data from database
 * Preserves user accounts but clears runs, decisions, matches, etc.
 */
export async function clearTestData(prisma: PrismaClient): Promise<void> {
  // Delete in order to respect foreign key constraints
  const tables = [
    'AuditLog',
    'PolicyDecision',
    'Decision',
    'Prediction',
    'Match',
    'DailyRun',
    'DataIngestionLog',
    'HardStopState',
  ];

  for (const table of tables) {
    try {
      // @ts-ignore - dynamic table access
      await (prisma as any)[table.toLowerCase()]?.deleteMany?.({});
    } catch {
      // Table might not exist in schema, skip
    }
  }
}

/**
 * Clear Redis cache for tests
 */
export async function clearTestCache(redis: RedisClientType | null): Promise<void> {
  if (!redis) return;
  
  try {
    await redis.flushDb();
  } catch (error) {
    console.warn('Failed to clear Redis cache:', error);
  }
}

/**
 * Setup before all E2E tests
 */
export async function beforeAllE2E(): Promise<TestEnvironment> {
  const env = await setupTestEnvironment();
  await clearTestData(env.prisma);
  await clearTestCache(env.redis);
  return env;
}

/**
 * Teardown after all E2E tests
 */
export async function afterAllE2E(): Promise<void> {
  await teardownTestEnvironment();
}

/**
 * Setup before each E2E test
 */
export async function beforeEachE2E(): Promise<void> {
  if (testEnvironment) {
    await clearTestData(testEnvironment.prisma);
    await clearTestCache(testEnvironment.redis);
  }
}

/**
 * Get current test environment (must call setup first)
 */
export function getTestEnvironment(): TestEnvironment {
  if (!testEnvironment || !testEnvironment.isInitialized) {
    throw new Error('Test environment not initialized. Call setupTestEnvironment() first.');
  }
  return testEnvironment;
}
