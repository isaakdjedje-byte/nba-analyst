/**
 * Redis Cache Service for Real-time NBA Data
 * TTL: Odds (24h), Injuries (6h), Lineups (12h), Live Data (2h)
 */

import { createClient, RedisClientType } from 'redis';

interface CacheConfig {
  url?: string;
  ttl: {
    odds: number;      // 24h = 86400
    injuries: number;  // 6h = 21600
    lineups: number;   // 12h = 43200
    live: number;      // 2h = 7200
    default: number;   // 1h = 3600
  };
}

const DEFAULT_CONFIG: CacheConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  ttl: {
    odds: 86400,      // 24 hours
    injuries: 21600,  // 6 hours
    lineups: 43200,   // 12 hours
    live: 7200,       // 2 hours
    default: 3600,    // 1 hour
  },
};

export class RedisCache {
  private client: RedisClientType | null = null;
  private config: CacheConfig;
  private isConnected = false;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    try {
      this.client = createClient({
        url: this.config.url,
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      this.client.on('connect', () => {
        console.log('Connected to Redis');
      });

      await this.client.connect();
      this.isConnected = true;
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  /**
   * Set value with TTL based on data type
   */
  async set<T>(key: string, value: T, type: keyof CacheConfig['ttl'] = 'default'): Promise<void> {
    if (!this.client) await this.connect();
    
    const ttl = this.config.ttl[type];
    const serialized = JSON.stringify(value);
    
    await this.client!.setEx(key, ttl, serialized);
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.client) await this.connect();
    
    const value = await this.client!.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  /**
   * Delete key from cache
   */
  async del(key: string): Promise<void> {
    if (!this.client) await this.connect();
    await this.client!.del(key);
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.client) await this.connect();
    const result = await this.client!.exists(key);
    return result === 1;
  }

  /**
   * Get multiple keys with pattern
   */
  async getKeys(pattern: string): Promise<string[]> {
    if (!this.client) await this.connect();
    return await this.client!.keys(pattern);
  }

  /**
   * Get all values matching pattern
   */
  async getAll<T>(pattern: string): Promise<T[]> {
    if (!this.client) await this.connect();
    
    const keys = await this.getKeys(pattern);
    const values: T[] = [];
    
    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value) values.push(value);
    }
    
    return values;
  }

  /**
   * Flush all cache
   */
  async flushAll(): Promise<void> {
    if (!this.client) await this.connect();
    await this.client!.flushAll();
  }

  /**
   * Cache odds data
   */
  async cacheOdds(gameId: string, odds: Record<string, unknown>): Promise<void> {
    await this.set(`odds:${gameId}`, odds, 'odds');
  }

  /**
   * Get cached odds
   */
  async getOdds(gameId: string): Promise<Record<string, unknown> | null> {
    return this.get<Record<string, unknown>>(`odds:${gameId}`);
  }

  /**
   * Cache injury report
   */
  async cacheInjuries(team: string, injuries: Record<string, unknown>): Promise<void> {
    await this.set(`injuries:${team}`, injuries, 'injuries');
  }

  /**
   * Get cached injuries
   */
  async getInjuries(team: string): Promise<Record<string, unknown> | null> {
    return this.get<Record<string, unknown>>(`injuries:${team}`);
  }

  /**
   * Cache lineup
   */
  async cacheLineup(gameId: string, lineup: Record<string, unknown>): Promise<void> {
    await this.set(`lineup:${gameId}`, lineup, 'lineups');
  }

  /**
   * Get cached lineup
   */
  async getLineup(gameId: string): Promise<Record<string, unknown> | null> {
    return this.get<Record<string, unknown>>(`lineup:${gameId}`);
  }

  /**
   * Cache live game data
   */
  async cacheLiveData(gameId: string, data: Record<string, unknown>): Promise<void> {
    await this.set(`live:${gameId}`, data, 'live');
  }

  /**
   * Get cached live data
   */
  async getLiveData(gameId: string): Promise<Record<string, unknown> | null> {
    return this.get<Record<string, unknown>>(`live:${gameId}`);
  }

  /**
   * Get cache stats
   */
  async getStats(): Promise<{ odds: number; injuries: number; lineups: number; live: number; total: number }> {
    if (!this.client) await this.connect();
    
    const [oddsKeys, injuriesKeys, lineupsKeys, liveKeys] = await Promise.all([
      this.getKeys('odds:*'),
      this.getKeys('injuries:*'),
      this.getKeys('lineup:*'),
      this.getKeys('live:*'),
    ]);

    return {
      odds: oddsKeys.length,
      injuries: injuriesKeys.length,
      lineups: lineupsKeys.length,
      live: liveKeys.length,
      total: oddsKeys.length + injuriesKeys.length + lineupsKeys.length + liveKeys.length,
    };
  }
}

// Singleton instance
let cacheInstance: RedisCache | null = null;

export function getCache(): RedisCache {
  if (!cacheInstance) {
    cacheInstance = new RedisCache();
  }
  return cacheInstance;
}

export async function initCache(): Promise<RedisCache> {
  const cache = getCache();
  await cache.connect();
  return cache;
}

export async function closeCache(): Promise<void> {
  if (cacheInstance) {
    await cacheInstance.disconnect();
    cacheInstance = null;
  }
}
