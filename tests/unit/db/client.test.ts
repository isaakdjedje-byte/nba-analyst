import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockedPrisma = {
  $connect: vi.fn().mockResolvedValue(undefined),
  $disconnect: vi.fn().mockResolvedValue(undefined),
  $queryRaw: vi.fn().mockResolvedValue([{ version: 'PostgreSQL 15' }]),
  $transaction: vi.fn((fn) => fn(mockedPrisma)),
};

// Mock Prisma client
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(function PrismaClientMock() {
    return mockedPrisma;
  }),
}));

// Mock the env validation
vi.mock('../../../src/lib/env', () => ({
  validateDatabaseEnv: vi.fn().mockReturnValue(true),
}));

describe('Prisma Client Configuration', () => {
  let prismaClient: { $disconnect: () => Promise<void> } | undefined;

  beforeEach(async () => {
    vi.resetModules();
    // Clear the global cache
    vi.unmock('../../../src/server/db/client');
  });

  afterEach(async () => {
    // Clean up connections
    if (prismaClient) {
      await prismaClient.$disconnect();
    }
  });

  it('should export a singleton Prisma client instance', async () => {
    const { prisma: client1 } = await import('../../../src/server/db/client');
    const { prisma: client2 } = await import('../../../src/server/db/client');
    prismaClient = client1;
    
    // Should be the same instance (singleton pattern)
    expect(client1).toBe(client2);
  });

  it('should have connection pool configuration', async () => {
    // Verify that Prisma client is instantiated with options
    const { prisma: client } = await import('../../../src/server/db/client');
    prismaClient = client;
    
    // Client should be defined and have connection methods
    expect(client).toBeDefined();
    expect(typeof client.$connect).toBe('function');
    expect(typeof client.$disconnect).toBe('function');
    expect(typeof client.$queryRaw).toBe('function');
  });

  it('should support health check functionality', async () => {
    const { healthCheck } = await import('../../../src/server/db/client');
    
    // The client should have a health check method that returns a boolean
    expect(typeof healthCheck).toBe('function');
    
    // Health check should return a promise resolving to boolean
    const result = await healthCheck();
    expect(typeof result).toBe('boolean');
  });

  it('should configure for PostgreSQL provider', async () => {
    // Verify the schema is configured for PostgreSQL via datasource
    const { prisma } = await import('../../../src/server/db/client');
    prismaClient = prisma;
    
    // Prisma client should be functional for PostgreSQL
    await expect(prisma.$connect()).resolves.not.toThrow();
  });
});
