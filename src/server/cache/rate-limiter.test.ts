import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./redis-client', () => ({
  getRedisClient: vi.fn(),
  isRedisConfigured: vi.fn(),
}));

import { checkRateLimitWithBoth } from './rate-limiter';
import { getRedisClient, isRedisConfigured } from './redis-client';

describe('checkRateLimitWithBoth', () => {
  const counters = new Map<string, number>();
  const incrMock = vi.fn(async (key: string) => {
    const current = counters.get(key) ?? 0;
    const next = current + 1;
    counters.set(key, next);
    return next;
  });

  const ttlMock = vi.fn(async () => 60);
  const expireMock = vi.fn(async () => true);

  beforeEach(() => {
    counters.clear();
    incrMock.mockClear();
    ttlMock.mockClear();
    expireMock.mockClear();

    vi.mocked(isRedisConfigured).mockReturnValue(true);
    vi.mocked(getRedisClient).mockResolvedValue({
      incr: incrMock,
      expire: expireMock,
      ttl: ttlMock,
      del: vi.fn(),
      get: vi.fn(),
      ping: vi.fn(),
    });
  });

  it('increments only once per identifier', async () => {
    const result = await checkRateLimitWithBoth('/api/v1/decisions', 'user-1', '127.0.0.1');

    expect(result.success).toBe(true);
    expect(incrMock).toHaveBeenCalledTimes(2);
  });

  it('increments once when only user id is provided', async () => {
    const result = await checkRateLimitWithBoth('/api/v1/decisions', 'user-1', undefined);

    expect(result.success).toBe(true);
    expect(incrMock).toHaveBeenCalledTimes(1);
  });
});
