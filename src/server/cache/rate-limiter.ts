/**
 * Rate Limiter Module
 * Redis-backed rate limiting middleware using token bucket algorithm
 * 
 * Architecture: src/server/cache/rate-limiter.ts
 * Required by: Story 2.2 - Configure Redis cache
 * 
 * Rate Limiting Configuration:
 * - Default: 100 requests per minute per user
 * - Strict endpoints: 10 requests per minute (e.g., /api/policy/evaluate)
 * - Public endpoints: 60 requests per minute per IP
 */

import { getRedisClient, isRedisConfigured } from './redis-client';
import { rateLimitKeys } from './cache-keys';

export interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  maxRequests: number;   // Max requests per window
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface EndpointRateLimitConfig {
  user: RateLimitConfig;
  ip: RateLimitConfig;
}

// Default rate limit configurations
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 100,     // 100 requests per minute
};

export const STRICT_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 10,      // 10 requests per minute
};

export const PUBLIC_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 60,      // 60 requests per minute per IP
};

// Endpoint-specific configurations
export const ENDPOINT_RATE_LIMITS: Record<string, EndpointRateLimitConfig> = {
  '/api/policy/evaluate': {
    user: STRICT_RATE_LIMIT,
    ip: STRICT_RATE_LIMIT,
  },
  '/api/auth/login': {
    user: { windowMs: 60 * 1000, maxRequests: 5 },
    ip: { windowMs: 60 * 1000, maxRequests: 10 },
  },
  '/api/auth/register': {
    user: { windowMs: 60 * 1000, maxRequests: 3 },
    ip: { windowMs: 60 * 1000, maxRequests: 5 },
  },
  '/api/v1/decisions': {
    user: DEFAULT_RATE_LIMIT,
    ip: PUBLIC_RATE_LIMIT,
  },
};

/**
 * Get rate limit configuration for an endpoint
 * @param endpoint - API endpoint path
 */
export function getEndpointConfig(endpoint: string): EndpointRateLimitConfig {
  // Check for exact match first
  if (ENDPOINT_RATE_LIMITS[endpoint]) {
    return ENDPOINT_RATE_LIMITS[endpoint];
  }

  // Check for partial match (e.g., /api/v1/decisions/123 matches /api/v1/decisions)
  for (const [path, config] of Object.entries(ENDPOINT_RATE_LIMITS)) {
    if (endpoint.startsWith(path)) {
      return config;
    }
  }

  // Default configuration
  return {
    user: DEFAULT_RATE_LIMIT,
    ip: PUBLIC_RATE_LIMIT,
  };
}

/**
 * Check rate limit using token bucket algorithm
 * Uses Redis INCR with expiry for sliding window
 * 
 * @param endpoint - API endpoint
 * @param userId - User ID (for user-based limiting)
 * @param ip - Client IP address (for IP-based limiting)
 * @param config - Rate limit configuration
 * @returns Rate limit result with limit info
 */
export async function checkRateLimit(
  endpoint: string,
  userId: string | undefined,
  ip: string | undefined,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): Promise<RateLimitResult> {
  const isProduction = process.env.NODE_ENV === 'production';

  // If Redis is not configured, fail closed in production.
  if (!isRedisConfigured()) {
    if (isProduction) {
      return {
        success: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: Date.now() + config.windowMs,
        retryAfter: Math.ceil(config.windowMs / 1000),
      };
    }

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs,
    };
  }

  try {
    const client = await getRedisClient();
    const windowSeconds = Math.ceil(config.windowMs / 1000);
    const now = Date.now();

    // Use user-based limit if userId provided, otherwise use IP-based
    const identifier = userId || ip;
    const key = rateLimitKeys.generic(`${endpoint}:${identifier}`);

    // Increment counter
    const current = await client.incr(key);

    // Set expiry on first request
    if (current === 1) {
      await client.expire(key, windowSeconds);
    }

    // Get TTL for reset time
    const ttl = await client.ttl(key);
    const resetTime = now + (ttl > 0 ? ttl * 1000 : config.windowMs);

    // Check if limit exceeded
    if (current > config.maxRequests) {
      const retryAfter = ttl > 0 ? ttl : windowSeconds;
      return {
        success: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime,
        retryAfter,
      };
    }

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - current,
      resetTime,
    };
  } catch (error) {
    console.error('RateLimiter: Error checking rate limit:', error);
    if (isProduction) {
      return {
        success: false,
        limit: config.maxRequests,
        remaining: 0,
        resetTime: Date.now() + config.windowMs,
        retryAfter: Math.ceil(config.windowMs / 1000),
      };
    }

    // Non-production fallback remains fail-open for local development.
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs,
    };
  }
}

/**
 * Check rate limit with both user and IP-based limiting
 * Takes the stricter of the two limits
 * 
 * @param endpoint - API endpoint
 * @param userId - User ID
 * @param ip - Client IP
 * @returns Combined rate limit result
 */
export async function checkRateLimitWithBoth(
  endpoint: string,
  userId: string | undefined,
  ip: string | undefined
): Promise<RateLimitResult> {
  const config = getEndpointConfig(endpoint);

  const userResult = userId
    ? await checkRateLimit(endpoint, userId, undefined, config.user)
    : null;

  if (userResult && !userResult.success) {
    return userResult;
  }

  const ipResult = ip
    ? await checkRateLimit(endpoint, undefined, ip, config.ip)
    : null;

  if (ipResult && !ipResult.success) {
    return ipResult;
  }

  if (userResult && ipResult) {
    return userResult.remaining < ipResult.remaining ? userResult : ipResult;
  }

  if (userResult) {
    return userResult;
  }

  if (ipResult) {
    return ipResult;
  }

  return {
    success: true,
    limit: config.user.maxRequests,
    remaining: config.user.maxRequests,
    resetTime: Date.now() + config.user.windowMs,
  };
}

/**
 * Reset rate limit for a user/endpoint
 * Used for admin actions or testing
 * 
 * @param endpoint - API endpoint
 * @param identifier - User ID or IP address
 */
export async function resetRateLimit(endpoint: string, identifier: string): Promise<boolean> {
  if (!isRedisConfigured()) {
    return true;
  }

  try {
    const client = await getRedisClient();
    const key = rateLimitKeys.generic(`${endpoint}:${identifier}`);
    await client.del(key);
    return true;
  } catch (error) {
    console.error('RateLimiter: Error resetting rate limit:', error);
    return false;
  }
}

/**
 * Get current rate limit status without incrementing
 * 
 * @param endpoint - API endpoint
 * @param identifier - User ID or IP address
 * @param config - Rate limit configuration
 */
export async function getRateLimitStatus(
  endpoint: string,
  identifier: string,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT
): Promise<RateLimitResult> {
  if (!isRedisConfigured()) {
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs,
    };
  }

  try {
    const client = await getRedisClient();
    const key = rateLimitKeys.generic(`${endpoint}:${identifier}`);
    
    const current = await client.get(key);
    const count = current ? parseInt(current, 10) : 0;
    const ttl = await client.ttl(key);
    const resetTime = Date.now() + (ttl > 0 ? ttl * 1000 : config.windowMs);

    return {
      success: count <= config.maxRequests,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      resetTime,
    };
  } catch (error) {
    console.error('RateLimiter: Error getting rate limit status:', error);
    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs,
    };
  }
}

/**
 * Create rate limiting headers for response
 * 
 * @param result - Rate limit check result
 * @returns Headers object
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
  };
}
