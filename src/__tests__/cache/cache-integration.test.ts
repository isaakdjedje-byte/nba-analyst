import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis client for integration tests
const mockRedisClient = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  ping: vi.fn().mockResolvedValue('PONG'),
  get: vi.fn(),
  set: vi.fn(),
  setEx: vi.fn(),
  del: vi.fn(),
  expire: vi.fn(),
  incr: vi.fn(),
  decr: vi.fn(),
  exists: vi.fn().mockResolvedValue(1),
  ttl: vi.fn().mockResolvedValue(60),
  quit: vi.fn().mockResolvedValue('OK'),
  isOpen: true,
  isReady: true,
  scan: vi.fn().mockResolvedValue([0, []]),
};

// Mock the redis module
vi.mock('redis', () => ({
  createClient: vi.fn(() => mockRedisClient),
}));

// Mock environment variables
vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
vi.stubEnv('NODE_ENV', 'test');

describe('Cache Integration Tests', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  describe('CacheService - End-to-end flow', () => {
    it('should fetch from source on cache miss', async () => {
      mockRedisClient.get.mockResolvedValueOnce(null);
      mockRedisClient.setEx.mockResolvedValueOnce('OK');

      const { CacheService } = await import('../../server/cache/cache-service');
      const cache = new CacheService(600);

      const fetcher = vi.fn().mockResolvedValue({ id: 1, data: 'test' });

      const result = await cache.getOrFetch('test:key', fetcher);

      expect(result.fromCache).toBe(false);
      expect(result.data).toEqual({ id: 1, data: 'test' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it('should return cached data on cache hit', async () => {
      const cachedData = JSON.stringify({ id: 1, data: 'cached' });
      mockRedisClient.get.mockResolvedValueOnce(cachedData);

      const { CacheService } = await import('../../server/cache/cache-service');
      const cache = new CacheService(600);

      const fetcher = vi.fn().mockResolvedValue({ id: 1, data: 'fresh' });

      const result = await cache.getOrFetch('test:key', fetcher);

      expect(result.fromCache).toBe(true);
      expect(result.data).toEqual({ id: 1, data: 'cached' });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should invalidate cache on delete', async () => {
      mockRedisClient.del.mockResolvedValueOnce(1);

      const { CacheService } = await import('../../server/cache/cache-service');
      const cache = new CacheService(600);

      const result = await cache.delete('test:key');

      expect(result).toBe(true);
      expect(mockRedisClient.del).toHaveBeenCalledWith('test:key');
    });

    it('should handle cache errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValueOnce(new Error('Redis error'));
      const fetcher = vi.fn().mockResolvedValue({ id: 1, data: 'fallback' });

      const { CacheService } = await import('../../server/cache/cache-service');
      const cache = new CacheService(600);

      const result = await cache.getOrFetch('test:key', fetcher);

      expect(result.fromCache).toBe(false);
      expect(result.data).toEqual({ id: 1, data: 'fallback' });
    });
  });

  describe('Rate Limiter Integration', () => {
    it('should increment counter on each request', async () => {
      mockRedisClient.incr.mockResolvedValueOnce(1);
      mockRedisClient.expire.mockResolvedValueOnce(true);
      mockRedisClient.ttl.mockResolvedValueOnce(60);

      const { checkRateLimit, DEFAULT_RATE_LIMIT } = await import('../../server/cache/rate-limiter');
      const result = await checkRateLimit('/api/test', 'user1', '192.168.1.1', DEFAULT_RATE_LIMIT);

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(99);
    });

    it('should block when limit exceeded', async () => {
      mockRedisClient.incr.mockResolvedValueOnce(101);
      mockRedisClient.ttl.mockResolvedValueOnce(30);

      const { checkRateLimit, DEFAULT_RATE_LIMIT } = await import('../../server/cache/rate-limiter');
      const result = await checkRateLimit('/api/test', 'user1', '192.168.1.1', DEFAULT_RATE_LIMIT);

      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should return rate limit headers correctly', async () => {
      const { getRateLimitHeaders } = await import('../../server/cache/rate-limiter');

      const result = {
        success: true,
        limit: 100,
        remaining: 50,
        resetTime: Date.now() + 60000,
      };

      const headers = getRateLimitHeaders(result);

      expect(headers['X-RateLimit-Limit']).toBe('100');
      expect(headers['X-RateLimit-Remaining']).toBe('50');
      expect(headers['X-RateLimit-Reset']).toBeDefined();
    });

    it('should allow request on Redis error (fail-open)', async () => {
      mockRedisClient.incr.mockRejectedValueOnce(new Error('Connection error'));

      const { checkRateLimit, DEFAULT_RATE_LIMIT } = await import('../../server/cache/rate-limiter');
      const result = await checkRateLimit('/api/test', 'user1', '192.168.1.1', DEFAULT_RATE_LIMIT);

      expect(result.success).toBe(true);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate decision cache correctly', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      const { invalidateDecisionCache, decisionKeys } = await import('../../server/cache/cache-keys');
      const keys = invalidateDecisionCache('abc123');

      expect(keys).toContain(decisionKeys.detail('abc123'));
    });
  });
});
