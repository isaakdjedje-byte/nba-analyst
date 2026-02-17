import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decisionKeys, rateLimitKeys, CACHE_TTL, invalidateDecisionCache } from '../../server/cache/cache-keys';
import { getEndpointConfig, STRICT_RATE_LIMIT, DEFAULT_RATE_LIMIT, getRateLimitHeaders } from '../../server/cache/rate-limiter';

// Mock Redis client
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
  exists: vi.fn(),
  ttl: vi.fn(),
  quit: vi.fn().mockResolvedValue('OK'),
  isOpen: true,
  isReady: true,
};

// Mock the redis module
vi.mock('redis', () => ({
  createClient: vi.fn(() => mockRedisClient),
}));

// Mock environment variables
vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
vi.stubEnv('NODE_ENV', 'test');

describe('Cache Keys Module', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('decisionKeys', () => {
    it('should generate correct decision list key', () => {
      const key = decisionKeys.list('2024-01-15');
      expect(key).toBe('decisions:2024-01-15:list');
    });

    it('should generate correct decision detail key', () => {
      const key = decisionKeys.detail('abc123');
      expect(key).toBe('decisions:abc123');
    });

    it('should generate correct today key', () => {
      const today = new Date().toISOString().split('T')[0];
      const key = decisionKeys.today();
      expect(key).toBe(`decisions:${today}:list`);
    });
  });

  describe('rateLimitKeys', () => {
    it('should generate correct user rate limit key', () => {
      const key = rateLimitKeys.user('/api/test', 'user123');
      expect(key).toBe('ratelimit:user123:/api/test');
    });

    it('should generate correct IP rate limit key', () => {
      const key = rateLimitKeys.ip('/api/test', '192.168.1.1');
      expect(key).toBe('ratelimit:/api/test:192.168.1.1');
    });

    it('should generate correct generic rate limit key', () => {
      const key = rateLimitKeys.generic('identifier');
      expect(key).toBe('ratelimit:identifier');
    });
  });

  describe('CACHE_TTL', () => {
    it('should have correct TTL values', () => {
      expect(CACHE_TTL.DECISION_LIST).toBe(600);       // 10 minutes
      expect(CACHE_TTL.DECISION_DETAIL).toBe(1800);    // 30 minutes
      expect(CACHE_TTL.SESSION).toBe(3600);            // 1 hour
      expect(CACHE_TTL.RATE_LIMIT).toBe(60);          // 1 minute
    });
  });

  describe('invalidateDecisionCache', () => {
    it('should return correct invalidation keys', () => {
      const keys = invalidateDecisionCache('abc123');
      const today = new Date().toISOString().split('T')[0];
      
      expect(keys).toContain('decisions:abc123');
      expect(keys).toContain(`decisions:${today}:list`);
    });
  });
});

describe('Rate Limiter', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('getEndpointConfig', () => {
    it('should return strict config for policy evaluation endpoint', async () => {
      const config = getEndpointConfig('/api/policy/evaluate');
      
      expect(config.user.maxRequests).toBe(STRICT_RATE_LIMIT.maxRequests);
    });

    it('should return default config for unknown endpoint', async () => {
      const config = getEndpointConfig('/api/unknown');
      
      expect(config.user.maxRequests).toBe(DEFAULT_RATE_LIMIT.maxRequests);
    });

    it('should return specific config for login endpoint', async () => {
      const config = getEndpointConfig('/api/auth/login');
      
      expect(config.user.maxRequests).toBe(5);
    });
  });

  describe('getRateLimitHeaders', () => {
    it('should return correct headers', () => {
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
  });
});
