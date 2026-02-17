/**
 * Cache Keys Module
 * Centralized cache key definitions with consistent naming conventions
 * 
 * Architecture: src/server/cache/cache-keys.ts
 * Required by: Story 2.2 - Configure Redis cache
 * 
 * Key Structure:
 * - Decision lists: decisions:{date}:list
 * - Individual decision: decisions:{id}
 * - User sessions: session:{userId}
 * - Rate limit counters: ratelimit:{endpoint}:{userId}
 */

export interface CacheKeyOptions {
  prefix: string;
  date?: string;
  id?: string;
  userId?: string;
  endpoint?: string;
  ip?: string;
}

/**
 * Default TTL values in seconds
 */
export const CACHE_TTL = {
  // Decision caches
  DECISION_LIST: 600,        // 10 minutes
  DECISION_DETAIL: 1800,     // 30 minutes
  
  // Session caches
  SESSION: 3600,             // 1 hour
  SESSION_SHORT: 300,        // 5 minutes
  
  // Rate limiting
  RATE_LIMIT: 60,            // 1 minute window
  
  // User data
  USER_PROFILE: 1800,         // 30 minutes
  USER_PREFERENCES: 86400,   // 24 hours

  // Performance metrics
  PERFORMANCE_METRICS: 300,  // 5 minutes
} as const;

/**
 * Generate a consistent cache key
 * @param options - Key components
 * @returns Formatted cache key string
 */
export function makeCacheKey(options: CacheKeyOptions): string {
  const parts = [options.prefix];
  
  if (options.date) {
    parts.push(options.date);
  }
  if (options.id) {
    parts.push(options.id);
  }
  if (options.userId) {
    parts.push(options.userId);
  }
  if (options.endpoint) {
    parts.push(options.endpoint);
  }
  if (options.ip) {
    parts.push(options.ip);
  }
  
  return parts.join(':');
}

/**
 * Decision-related cache keys
 */
export const decisionKeys = {
  /**
   * Cache key for decision list by date
   * @param date - Date string (YYYY-MM-DD format)
   */
  list: (date: string): string => 
    makeCacheKey({ prefix: 'decisions', date, id: 'list' }),
  
  /**
   * Cache key for individual decision
   * @param id - Decision ID
   */
  detail: (id: string): string => 
    makeCacheKey({ prefix: 'decisions', id }),
  
  /**
   * Cache key for today's decisions (convenience)
   */
  today: (): string => {
    const today = new Date().toISOString().split('T')[0];
    return decisionKeys.list(today);
  },
  
  /**
   * Cache key for user's decisions
   * @param userId - User ID
   */
  userDecisions: (userId: string): string => 
    makeCacheKey({ prefix: 'decisions', userId, id: 'list' }),
  
  /**
   * Cache key for pending decisions
   */
  pending: (): string => 
    makeCacheKey({ prefix: 'decisions', id: 'pending' }),
};

/**
 * Session-related cache keys
 */
export const sessionKeys = {
  /**
   * Cache key for user session
   * @param userId - User ID
   */
  user: (userId: string): string => 
    makeCacheKey({ prefix: 'session', userId }),
  
  /**
   * Cache key for session by token
   * @param token - Session token
   */
  token: (token: string): string => 
    makeCacheKey({ prefix: 'session', id: token }),
};

/**
 * Rate limiting cache keys
 */
export const rateLimitKeys = {
  /**
   * Cache key for user-based rate limiting
   * @param endpoint - API endpoint
   * @param userId - User ID
   */
  user: (endpoint: string, userId: string): string => 
    makeCacheKey({ prefix: 'ratelimit', endpoint, userId }),
  
  /**
   * Cache key for IP-based rate limiting
   * @param endpoint - API endpoint
   * @param ip - Client IP address
   */
  ip: (endpoint: string, ip: string): string => 
    makeCacheKey({ prefix: 'ratelimit', endpoint, ip }),
  
  /**
   * Generic rate limit key
   * @param identifier - Rate limit identifier
   */
  generic: (identifier: string): string => 
    makeCacheKey({ prefix: 'ratelimit', id: identifier }),
};

/**
 * User data cache keys
 */
export const userKeys = {
  /**
   * Cache key for user profile
   * @param userId - User ID
   */
  profile: (userId: string): string => 
    makeCacheKey({ prefix: 'user', id: userId }),
  
  /**
   * Cache key for user preferences
   * @param userId - User ID
   */
  preferences: (userId: string): string => 
    makeCacheKey({ prefix: 'user', userId, id: 'preferences' }),
  
  /**
   * Cache key for user's role
   * @param userId - User ID
   */
  role: (userId: string): string => 
    makeCacheKey({ prefix: 'user', userId, id: 'role' }),
};

/**
 * Policy evaluation cache keys
 */
export const policyKeys = {
  /**
   * Cache key for policy evaluation result
   * @param cacheKey - Unique cache key based on input parameters
   */
  evaluation: (cacheKey: string): string => 
    makeCacheKey({ prefix: 'policy', id: cacheKey }),
  
  /**
   * Cache key for policy rules
   */
  rules: (): string => 
    makeCacheKey({ prefix: 'policy', id: 'rules' }),
};

/**
 * Invalidate cache keys for a specific decision
 * @param decisionId - Decision ID to invalidate
 * @returns Array of cache keys to delete
 */
export function invalidateDecisionCache(decisionId: string): string[] {
  const today = new Date().toISOString().split('T')[0];
  return [
    decisionKeys.detail(decisionId),
    decisionKeys.today(),
    decisionKeys.list(today),
  ];
}

/**
 * Invalidate all decision caches
 * @returns Array of all decision cache key patterns
 */
export function invalidateAllDecisionCache(): string[] {
  return [
    'decisions:*',
  ];
}

/**
 * Performance metrics cache keys
 * Story 4.1: Performance view with historical recommendations
 */
export const performanceKeys = {
  /**
   * Cache key for performance metrics by date range
   * @param fromDate - Start date (YYYY-MM-DD format)
   * @param toDate - End date (YYYY-MM-DD format)
   */
  metrics: (fromDate: string, toDate: string): string => 
    makeCacheKey({ prefix: 'performance', date: fromDate, id: toDate }),
  
  /**
   * Invalidate all performance metrics caches
   */
  invalidateAll: (): string[] => [
    'performance:*',
  ],
};
