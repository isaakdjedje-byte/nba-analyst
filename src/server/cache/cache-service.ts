/**
 * Cache Service Module
 * Generic cache-aside implementation for Redis caching
 * 
 * Architecture: src/server/cache/cache-service.ts
 * Required by: Story 2.2 - Configure Redis cache
 */

import { getRedisClient, isRedisConfigured } from './redis-client';
import { CACHE_TTL } from './cache-keys';

export interface CacheOptions {
  ttl?: number;
  skipCache?: boolean;
}

export interface CacheResult<T> {
  data: T | null;
  fromCache: boolean;
  error?: string;
}

/**
 * Generic cache-aside pattern implementation
 * 
 * Flow:
 * 1. Check cache for data
 * 2. If cache hit, return cached data
 * 3. If cache miss, fetch from source (database, API, etc.)
 * 4. Store result in cache
 * 5. Return data
 */
export class CacheService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;
  private defaultTTL: number;

  constructor(defaultTTL: number = CACHE_TTL.DECISION_LIST) {
    this.defaultTTL = defaultTTL;
  }

  /**
   * Initialize the cache service
   */
  async initialize(): Promise<void> {
    if (!isRedisConfigured()) {
      console.warn('CacheService: Redis not configured, caching disabled');
      return;
    }
    this.client = await getRedisClient();
  }

  /**
   * Get data from cache or fetch from source
   * @param key - Cache key
   * @param fetcher - Function to fetch data if cache miss
   * @param options - Cache options (TTL, skip cache)
   * @returns Cached or freshly fetched data
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<CacheResult<T>> {
    const { ttl = this.defaultTTL, skipCache = false } = options;

    // If Redis is not configured, just fetch and return
    if (!isRedisConfigured()) {
      try {
        const data = await fetcher();
        return { data, fromCache: false };
      } catch (error) {
        return {
          data: null,
          fromCache: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    try {
      // Try to get from cache first
      if (!skipCache) {
        const cached = await this.client!.get(key);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as T;
            return { data: parsed, fromCache: true };
          } catch {
            // Invalid JSON in cache, ignore and fetch fresh
            console.warn(`CacheService: Invalid JSON in cache key ${key}`);
          }
        }
      }

      // Cache miss - fetch from source
      const data = await fetcher();

      // Store in cache if data exists
      if (data !== null && data !== undefined) {
        await this.client!.setEx(key, ttl, JSON.stringify(data));
      }

      return { data, fromCache: false };
    } catch (error) {
      // On cache error, try to return fresh data
      console.error('CacheService: Cache error:', error);
      try {
        const data = await fetcher();
        return { data, fromCache: false };
      } catch (fetchError) {
        return {
          data: null,
          fromCache: false,
          error: fetchError instanceof Error ? fetchError.message : 'Unknown error',
        };
      }
    }
  }

  /**
   * Get data directly from cache
   * @param key - Cache key
   * @returns Cached data or null
   */
  async get<T>(key: string): Promise<T | null> {
    if (!isRedisConfigured() || !this.client) {
      return null;
    }

    try {
      const cached = await this.client.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
      return null;
    } catch (error) {
      console.error('CacheService: Error getting from cache:', error);
      return null;
    }
  }

  /**
   * Store data in cache
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time to live in seconds
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<boolean> {
    if (!isRedisConfigured() || !this.client) {
      return false;
    }

    try {
      const expiry = ttl || this.defaultTTL;
      await this.client.setEx(key, expiry, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('CacheService: Error setting cache:', error);
      return false;
    }
  }

  /**
   * Delete data from cache
   * @param key - Cache key to delete
   */
  async delete(key: string): Promise<boolean> {
    if (!isRedisConfigured() || !this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('CacheService: Error deleting from cache:', error);
      return false;
    }
  }

  /**
   * Delete multiple keys from cache
   * @param keys - Array of cache keys to delete
   */
  async deleteMany(keys: string[]): Promise<boolean> {
    if (!isRedisConfigured() || !this.client || keys.length === 0) {
      return false;
    }

    try {
      for (const key of keys) {
        await this.client.del(key);
      }
      return true;
    } catch (error) {
      console.error('CacheService: Error deleting multiple keys:', error);
      return false;
    }
  }

  /**
   * Delete keys matching a pattern
   * Uses SCAN for memory-efficient pattern matching
   * @param pattern - Key pattern (e.g., "decisions:*")
   */
  async deleteByPattern(pattern: string): Promise<number> {
    if (!isRedisConfigured() || !this.client) {
      return 0;
    }

    try {
      let deleted = 0;
      let cursor = 0;

      do {
        const result = await this.client.scan(cursor, { MATCH: pattern, COUNT: 100 });
        cursor = result[0];
        const keys = result[1];

        if (keys && keys.length > 0) {
          for (const key of keys) {
            await this.client.del(key);
          }
          deleted += keys.length;
        }
      } while (cursor !== 0);

      return deleted;
    } catch (error) {
      console.error('CacheService: Error deleting by pattern:', error);
      return 0;
    }
  }

  /**
   * Check if a key exists in cache
   * @param key - Cache key to check
   */
  async exists(key: string): Promise<boolean> {
    if (!isRedisConfigured() || !this.client) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('CacheService: Error checking key existence:', error);
      return false;
    }
  }

  /**
   * Set TTL for an existing key
   * @param key - Cache key
   * @param ttl - New TTL in seconds
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    if (!isRedisConfigured() || !this.client) {
      return false;
    }

    try {
      return await this.client.expire(key, ttl);
    } catch (error) {
      console.error('CacheService: Error setting TTL:', error);
      return false;
    }
  }

  /**
   * Get TTL for a key
   * @param key - Cache key
   * @returns TTL in seconds, or -1 if key doesn't exist, -2 for invalid
   */
  async getTTL(key: string): Promise<number> {
    if (!isRedisConfigured() || !this.client) {
      return -2;
    }

    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error('CacheService: Error getting TTL:', error);
      return -2;
    }
  }
}

// Default cache service instance for decision lists
export const decisionCache = new CacheService(CACHE_TTL.DECISION_LIST);

// Default cache service instance for user data
export const userCache = new CacheService(CACHE_TTL.USER_PROFILE);
