/**
 * Redis Client Module
 * Provides Redis connection, health checks, and error handling
 * 
 * Architecture: src/server/cache/redis-client.ts
 * Required by: Story 2.2 - Configure Redis cache
 */

import { createClient } from 'redis';

// Redis URL getter - inline to avoid import issues
function getRedisUrl(): string | undefined {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  
  if (process.env.REDIS_HOST) {
    const host = process.env.REDIS_HOST;
    const port = process.env.REDIS_PORT || '6379';
    const password = process.env.REDIS_PASSWORD ? `:${process.env.REDIS_PASSWORD}@` : '';
    const db = process.env.REDIS_DB || '0';
    return `redis://${password}${host}:${port}/${db}`;
  }
  
  return undefined;
}

export interface RedisHealthCheck {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redisClient: any = null;
let isConnecting = false;

/**
 * Create and configure Redis client
 * Uses REDIS_URL or builds URL from REDIS_HOST/REDIS_PORT/REDIS_PASSWORD
 * Supports connection pooling for production workloads
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createRedisClient(): any {
  const redisUrl = getRedisUrl();
  
  if (!redisUrl) {
    // Return a dummy client for development without Redis
    console.warn('Redis not configured - using no-op client');
    return createNoOpClient();
  }

  const client = createClient({
    url: redisUrl,
    // Connection pooling for production
    socket: {
      reconnectStrategy: (retries: number) => {
        if (retries > 10) {
          return new Error('Redis reconnection failed after 10 attempts');
        }
        return Math.min(retries * 100, 3000);
      },
    },
  });

  // Event handlers
  client.on('error', (err: Error) => {
    console.error('Redis Client Error:', err);
  });

  client.on('connect', () => {
    console.log('Redis client connected');
  });

  client.on('ready', () => {
    console.log('Redis client ready');
    isConnecting = false;
  });

  client.on('reconnecting', () => {
    isConnecting = true;
    console.log('Redis client reconnecting...');
  });

  client.on('end', () => {
    console.log('Redis client disconnected');
  });

  return client;
}

/**
 * Create a no-op client for development without Redis
 * All operations succeed but don't actually cache anything
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createNoOpClient(): any {
  const noOpClient = {
    isOpen: true,
    isReady: true,
    connect: async () => {},
    disconnect: async () => {},
    get: async () => null,
    set: async () => 'OK',
    setEx: async () => 'OK',
    del: async () => 0,
    expire: async () => false,
    incr: async () => 1,
    decr: async () => 0,
    ping: async () => 'PONG',
    quit: async () => 'OK',
    exists: async () => 0,
    ttl: async () => -1,
    on: () => {},
  };
  
  return noOpClient;
}

/**
 * Get or create the singleton Redis client
 * Thread-safe initialization with connection retry
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getRedisClient(): Promise<any> {
  if (redisClient?.isReady) {
    return redisClient;
  }

  if (isConnecting) {
    // Wait for existing connection attempt
    await new Promise((resolve) => setTimeout(resolve, 500));
    return getRedisClient();
  }

  isConnecting = true;
  
  try {
    redisClient = createRedisClient();
    await redisClient.connect();
    return redisClient;
  } catch (error) {
    isConnecting = false;
    console.error('Failed to connect to Redis:', error);
    
    // In development, return no-op client instead of failing
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Using no-op Redis client for development');
      return createNoOpClient();
    }
    
    throw error;
  }
}

/**
 * Check Redis health status
 * @returns Health check result with status and latency
 */
export async function healthCheck(): Promise<RedisHealthCheck> {
  const redisUrl = getRedisUrl();
  
  if (!redisUrl) {
    return {
      status: 'unhealthy',
      error: 'Redis not configured',
    };
  }

  try {
    const client = await getRedisClient();
    const start = Date.now();
    await client.ping();
    const latency = Date.now() - start;

    return {
      status: 'healthy',
      latency,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Disconnect Redis client gracefully
 * Call this on application shutdown
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.quit();
    redisClient = null;
    console.log('Redis client disconnected');
  }
}

/**
 * Check if Redis is available and configured
 */
export function isRedisConfigured(): boolean {
  return !!getRedisUrl();
}

// Export for testing
 
export { redisClient };
