import { z } from 'zod';

// Database URL validation schema
const databaseUrlSchema = z.string().refine(
  (url) => {
    // Check for valid PostgreSQL connection string or SQLite for testing
    return url.startsWith('postgresql://') || 
           url.startsWith('postgres://') || 
           url.startsWith('file:'); // SQLite for test environment
  },
  {
    message: 'DATABASE_URL must be a valid database connection string (postgresql://, postgres://, or file: for SQLite)',
  }
);

// Redis URL validation schema
const redisUrlSchema = z.string().url().refine(
  (url) => {
    return url.startsWith('redis://') || url.startsWith('rediss://');
  },
  {
    message: 'REDIS_URL must be a valid Redis connection string (redis:// or rediss://)',
  }
).optional();

// Environment validation
const envSchema = z.object({
  DATABASE_URL: databaseUrlSchema,
  REDIS_URL: redisUrlSchema,
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

/**
 * Validates that DATABASE_URL environment variable is properly configured
 * @returns true if validation passes
 * @throws Error if DATABASE_URL is missing or invalid
 */
export function validateDatabaseEnv(): boolean {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Validate the URL format
  const result = databaseUrlSchema.safeParse(databaseUrl);
  if (!result.success) {
    throw new Error(result.error.errors[0]?.message || 'Invalid DATABASE_URL format');
  }

  // In production, require connection pool settings
  if (process.env.NODE_ENV === 'production') {
    const url = new URL(databaseUrl);
    const connectionLimit = url.searchParams.get('connection_limit');
    const poolMode = url.searchParams.get('pool_mode');

    if (!connectionLimit && !poolMode) {
      throw new Error(
        'Production DATABASE_URL must include connection_limit or pool_mode parameter for connection pooling'
      );
    }
  }

  return true;
}

/**
 * Get the database connection string with applied defaults
 */
export function getDatabaseUrl(): string {
  validateDatabaseEnv();
  return process.env.DATABASE_URL!;
}

/**
 * Parse DATABASE_URL and extract connection components
 */
export function parseDatabaseUrl(url: string): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  connectionLimit?: number;
  poolMode?: string;
} {
  const parsed = new URL(url);
  
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '5432', 10),
    database: parsed.pathname.replace(/^\//, ''),
    user: parsed.username,
    password: parsed.password,
    connectionLimit: parsed.searchParams.get('connection_limit')
      ? parseInt(parsed.searchParams.get('connection_limit')!, 10)
      : undefined,
    poolMode: parsed.searchParams.get('pool_mode') || undefined,
  };
}

/**
 * Validate Redis environment variables
 * Redis is optional for development, but required in production
 * @returns true if Redis is properly configured or not required
 */
export function validateRedisEnv(): boolean {
  const hasRedisUrl = !!process.env.REDIS_URL;
  const hasRedisHost = !!process.env.REDIS_HOST;
  
  // In development, Redis is optional
  if (process.env.NODE_ENV !== 'production') {
    if (!hasRedisUrl && !hasRedisHost) {
      console.warn('Redis not configured - caching will be disabled');
      return true;
    }
  }
  
  // If Redis is configured, validate the URL format
  if (hasRedisUrl) {
    const result = redisUrlSchema.safeParse(process.env.REDIS_URL);
    if (!result.success) {
      throw new Error(result.error.errors[0]?.message || 'Invalid REDIS_URL format');
    }
  } else if (hasRedisHost) {
    // Validate host-based configuration
    const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('REDIS_PORT must be a valid port number (1-65535)');
    }
  }
  
  return true;
}

/**
 * Get the Redis connection URL
 * @returns Redis URL string or undefined if not configured
 */
export function getRedisUrl(): string | undefined {
  if (process.env.REDIS_URL) {
    validateRedisEnv();
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

/**
 * Parse Redis URL and extract connection components
 */
export function parseRedisUrl(url: string): {
  host: string;
  port: number;
  password?: string;
  db: number;
} {
  const parsed = new URL(url);
  
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    db: parseInt(parsed.pathname.replace(/^\//, '') || '0', 10),
  };
}

/**
 * Validate and export environment variables
 * This should be called at application startup
 */
export function validateEnv() {
  try {
    validateDatabaseEnv();
    validateRedisEnv();
    return true;
  } catch (error) {
    console.error('Environment validation failed:', error);
    return false;
  }
}

// Export validation schema for testing
export { envSchema, databaseUrlSchema, redisUrlSchema };
