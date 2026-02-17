import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Redis client for testing
const mockRedis = {
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  ping: vi.fn().mockResolvedValue('PONG'),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  expire: vi.fn(),
  incr: vi.fn(),
  decr: vi.fn(),
  setEx: vi.fn(),
  on: vi.fn(),
  quit: vi.fn().mockResolvedValue(undefined),
};

vi.mock('redis', () => ({
  createClient: vi.fn(() => mockRedis),
}));

describe('Redis Client', () => {
  beforeEach(async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.resetModules();
    vi.stubEnv('REDIS_URL', 'redis://localhost:6379');
    vi.stubEnv('NODE_ENV', 'test');
    await import('../../server/cache/redis-client');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe('Connection', () => {
    it('should connect to Redis when initialized', async () => {
      const { getRedisClient } = await import('../../server/cache/redis-client');
      await getRedisClient();
      expect(mockRedis.connect).toHaveBeenCalled();
    });

    it('should handle connection errors gracefully', async () => {
      mockRedis.connect.mockRejectedValueOnce(new Error('Connection refused'));
      
      const { createRedisClient } = await import('../../server/cache/redis-client');
      const client = createRedisClient();
      
      await expect(client.connect()).rejects.toThrow('Connection refused');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status when Redis is connected', async () => {
      mockRedis.ping.mockResolvedValueOnce('PONG');
      
      const { healthCheck } = await import('../../server/cache/redis-client');
      const result = await healthCheck();
      
      expect(result).toEqual({ status: 'healthy', latency: expect.any(Number) });
    });

    it('should return unhealthy status when Redis is down', async () => {
      mockRedis.ping.mockRejectedValueOnce(new Error('Connection refused'));
      
      const { healthCheck } = await import('../../server/cache/redis-client');
      const result = await healthCheck();
      
      expect(result).toEqual({ status: 'unhealthy', error: expect.any(String) });
    });
  });

  describe('Error Handling', () => {
    it('should return no-op client on connection failure in non-production', async () => {
      mockRedis.connect.mockRejectedValueOnce(new Error('Temporary failure'));
      
      const { getRedisClient } = await import('../../server/cache/redis-client');
      const client = await getRedisClient();
      
      expect(client).toBeDefined();
      expect(client.isReady).toBe(true);
    });
  });
});
