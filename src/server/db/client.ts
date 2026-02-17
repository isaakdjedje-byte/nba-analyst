import { PrismaClient, Prisma } from '@prisma/client';
import { validateDatabaseEnv } from '../../lib/env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Prisma client configuration options for connection pooling and logging
 */
const prismaClientOptions: ConstructorParameters<typeof PrismaClient>[0] = {
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error'] as Prisma.LogLevel[]
    : ['error', 'warn'] as Prisma.LogLevel[],
  
  // Connection pool configuration for serverless-friendly setup
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
};

/**
 * Create a new PrismaClient instance with proper configuration
 */
function createPrismaClient(): PrismaClient {
  // Validate database environment before creating client
  try {
    validateDatabaseEnv();
  } catch (error) {
    console.error('Failed to validate database environment:', error);
    throw error;
  }

  return new PrismaClient(prismaClientOptions);
}

// Singleton pattern: reuse existing instance in development
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Store in global for development to prevent connection exhaustion during hot reload
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Health check for Prisma connection
 * @returns Promise<boolean> true if connection is healthy
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Get database connection status
 */
export async function getConnectionStatus(): Promise<{
  connected: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const result = await prisma.$queryRaw<[{ version: string }]>`SELECT version()`;
    return {
      connected: true,
      version: result[0]?.version,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Gracefully disconnect Prisma client
 * Use this for cleanup in tests or application shutdown
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Connect to database with retry logic
 */
export async function connectWithRetry(
  maxRetries: number = 3,
  retryDelayMs: number = 1000
): Promise<void> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$connect();
      console.log(`Database connected successfully (attempt ${attempt})`);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`Database connection attempt ${attempt} failed:`, lastError.message);
      
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  throw new Error(
    `Failed to connect to database after ${maxRetries} attempts: ${lastError?.message}`
  );
}

// Export types for type-safe database operations
export type { Prisma };
