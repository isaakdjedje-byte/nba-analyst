import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  getTokenMock,
  checkRateLimitWithBothMock,
  getRateLimitHeadersMock,
  getRedisClientMock,
  getClientIPMock,
  findManyMock,
  findFirstMock,
  countMock,
} = vi.hoisted(() => ({
  getTokenMock: vi.fn(),
  checkRateLimitWithBothMock: vi.fn(),
  getRateLimitHeadersMock: vi.fn(),
  getRedisClientMock: vi.fn(),
  getClientIPMock: vi.fn(),
  findManyMock: vi.fn(),
  findFirstMock: vi.fn(),
  countMock: vi.fn(),
}));

vi.mock('next-auth/jwt', () => ({
  getToken: getTokenMock,
}));

vi.mock('@/server/cache/rate-limiter', () => ({
  checkRateLimitWithBoth: checkRateLimitWithBothMock,
  getRateLimitHeaders: getRateLimitHeadersMock,
}));

vi.mock('@/server/cache/redis-client', () => ({
  getRedisClient: getRedisClientMock,
}));

vi.mock('@/server/cache/rate-limiter-middleware', () => ({
  getClientIP: getClientIPMock,
}));

vi.mock('@/server/db/client', () => ({
  prisma: {
    policyDecision: {
      findMany: findManyMock,
      findFirst: findFirstMock,
      count: countMock,
    },
  },
}));

import { GET } from './route';

describe('GET /api/v1/decisions', () => {
  beforeEach(() => {
    getTokenMock.mockReset();
    checkRateLimitWithBothMock.mockReset();
    getRateLimitHeadersMock.mockReset();
    getRedisClientMock.mockReset();
    getClientIPMock.mockReset();
    findManyMock.mockReset();
    findFirstMock.mockReset();
    countMock.mockReset();

    checkRateLimitWithBothMock.mockResolvedValue({
      success: true,
      limit: 60,
      remaining: 59,
      resetTime: Date.now() + 60000,
    });
    getRateLimitHeadersMock.mockReturnValue({
      'X-RateLimit-Limit': '60',
      'X-RateLimit-Remaining': '59',
      'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
    });
    getClientIPMock.mockReturnValue('127.0.0.1');
    getRedisClientMock.mockResolvedValue({
      get: vi.fn().mockResolvedValue(null),
      setEx: vi.fn().mockResolvedValue('OK'),
    });
    countMock.mockResolvedValue(0);
    findManyMock.mockResolvedValue([]);
    findFirstMock.mockResolvedValue({
      matchDate: new Date('2026-01-01T00:00:00.000Z'),
    });
  });

  it('returns 401 when no token is provided', async () => {
    getTokenMock.mockResolvedValue(null);
    process.env.ALLOW_UNAUTHENTICATED_DECISIONS_DEV = 'false';

    const request = new NextRequest('http://localhost:3000/api/v1/decisions');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when status filter is invalid', async () => {
    getTokenMock.mockResolvedValue({ role: 'user', sub: 'user-1' });

    const request = new NextRequest('http://localhost:3000/api/v1/decisions?status=INVALID');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('INVALID_STATUS');
  });

  it('returns paginated decision payload for authenticated users', async () => {
    getTokenMock.mockResolvedValue({ role: 'user', sub: 'user-1' });
    countMock.mockResolvedValue(1);
    findManyMock.mockResolvedValue([
      {
        id: 'dec-1',
        matchId: 'match-1',
        homeTeam: 'Lakers',
        awayTeam: 'Celtics',
        matchDate: new Date('2026-01-01T20:00:00.000Z'),
        status: 'PICK',
        rationale: 'Edge detected',
        edge: 0.12,
        confidence: 0.78,
        recommendedPick: 'HOME_ML',
        runId: 'run-1',
        createdAt: new Date('2026-01-01T18:00:00.000Z'),
        prediction: {
          id: 'pred-1',
          matchId: 'match-1',
          league: 'NBA',
        },
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/v1/decisions?page=1&limit=20');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    expect(payload.meta.totalCount).toBe(1);
    expect(payload.meta.page).toBe(1);
    expect(payload.meta.limit).toBe(20);
  });

  it('returns 403 when user role is not allowed', async () => {
    getTokenMock.mockResolvedValue({ role: 'guest', sub: 'user-1' });

    const request = new NextRequest('http://localhost:3000/api/v1/decisions');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('FORBIDDEN');
  });

  it('returns 429 when rate limit is exceeded', async () => {
    checkRateLimitWithBothMock.mockResolvedValue({
      success: false,
      limit: 60,
      remaining: 0,
      resetTime: Date.now() + 60000,
      retryAfter: 60,
    });

    const request = new NextRequest('http://localhost:3000/api/v1/decisions');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('returns 400 when page is less than 1', async () => {
    getTokenMock.mockResolvedValue({ role: 'user', sub: 'user-1' });

    const request = new NextRequest('http://localhost:3000/api/v1/decisions?page=0&limit=20');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('INVALID_PAGINATION');
  });

  it('returns 400 when limit is less than 1', async () => {
    getTokenMock.mockResolvedValue({ role: 'user', sub: 'user-1' });

    const request = new NextRequest('http://localhost:3000/api/v1/decisions?page=1&limit=0');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('INVALID_PAGINATION');
  });

  it('returns 400 when page is non numeric', async () => {
    getTokenMock.mockResolvedValue({ role: 'user', sub: 'user-1' });

    const request = new NextRequest('http://localhost:3000/api/v1/decisions?page=abc&limit=20');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('INVALID_PAGINATION');
  });

  it('returns 400 when limit is non numeric', async () => {
    getTokenMock.mockResolvedValue({ role: 'user', sub: 'user-1' });

    const request = new NextRequest('http://localhost:3000/api/v1/decisions?page=1&limit=ten');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('INVALID_PAGINATION');
  });

  it('caps limit at 100 when requested limit is higher', async () => {
    getTokenMock.mockResolvedValue({ role: 'user', sub: 'user-1' });

    const request = new NextRequest('http://localhost:3000/api/v1/decisions?page=1&limit=999');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.meta.limit).toBe(100);
    expect(findManyMock).toHaveBeenCalledWith(expect.objectContaining({
      skip: 0,
      take: 100,
    }));
  });

  it('uses cache on page 1 when cached decisions are available', async () => {
    getTokenMock.mockResolvedValue({ role: 'user', sub: 'user-1' });
    countMock.mockResolvedValue(1);

    const redisGet = vi.fn().mockResolvedValue(JSON.stringify([
      {
        id: 'dec-cached-1',
        matchId: 'match-cached-1',
        homeTeam: 'Knicks',
        awayTeam: 'Nets',
        matchDate: '2026-01-02T20:00:00.000Z',
        status: 'PICK',
        rationale: 'Cached edge',
        edge: 0.15,
        confidence: 0.8,
        recommendedPick: 'HOME_ML',
        runId: 'run-cached',
        createdAt: '2026-01-02T18:00:00.000Z',
        prediction: {
          id: 'pred-cached',
          matchId: 'match-cached-1',
          league: 'NBA',
        },
      },
    ]));

    getRedisClientMock.mockResolvedValue({
      get: redisGet,
      setEx: vi.fn().mockResolvedValue('OK'),
    });

    const request = new NextRequest('http://localhost:3000/api/v1/decisions?page=1&limit=20');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.meta.fromCache).toBe(true);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.id).toBe('dec-cached-1');
    expect(findManyMock).not.toHaveBeenCalled();
    expect(redisGet).toHaveBeenCalledTimes(1);
  });

  it('falls back to database when cache read throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    getTokenMock.mockResolvedValue({ role: 'user', sub: 'user-1' });
    countMock.mockResolvedValue(1);
    findManyMock.mockResolvedValue([
      {
        id: 'dec-db-1',
        matchId: 'match-db-1',
        homeTeam: 'Bulls',
        awayTeam: 'Heat',
        matchDate: new Date('2026-01-03T20:00:00.000Z'),
        status: 'PICK',
        rationale: 'DB fallback',
        edge: 0.08,
        confidence: 0.71,
        recommendedPick: 'AWAY_ML',
        runId: 'run-db',
        createdAt: new Date('2026-01-03T18:00:00.000Z'),
        prediction: {
          id: 'pred-db',
          matchId: 'match-db-1',
          league: 'NBA',
        },
      },
    ]);

    getRedisClientMock.mockResolvedValue({
      get: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
      setEx: vi.fn().mockResolvedValue('OK'),
    });

    const request = new NextRequest('http://localhost:3000/api/v1/decisions?page=1&limit=20');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.meta.fromCache).toBe(false);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.id).toBe('dec-db-1');
    expect(findManyMock).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
  });

  it('bypasses cache for paginated requests after page 1', async () => {
    getTokenMock.mockResolvedValue({ role: 'user', sub: 'user-1' });
    countMock.mockResolvedValue(1);

    const redisGet = vi.fn().mockResolvedValue(JSON.stringify([
      {
        id: 'dec-cached-2',
        matchId: 'match-cached-2',
        homeTeam: 'Raptors',
        awayTeam: 'Bucks',
        matchDate: '2026-01-04T20:00:00.000Z',
        status: 'PICK',
        rationale: 'Cached should be ignored for page>1',
        edge: 0.1,
        confidence: 0.75,
        recommendedPick: 'HOME_ML',
        runId: 'run-cached-2',
        createdAt: '2026-01-04T18:00:00.000Z',
      },
    ]));

    findManyMock.mockResolvedValue([
      {
        id: 'dec-db-2',
        matchId: 'match-db-2',
        homeTeam: 'Suns',
        awayTeam: 'Warriors',
        matchDate: new Date('2026-01-05T20:00:00.000Z'),
        status: 'PICK',
        rationale: 'DB page>1',
        edge: 0.11,
        confidence: 0.76,
        recommendedPick: 'AWAY_ML',
        runId: 'run-db-2',
        createdAt: new Date('2026-01-05T18:00:00.000Z'),
      },
    ]);

    getRedisClientMock.mockResolvedValue({
      get: redisGet,
      setEx: vi.fn().mockResolvedValue('OK'),
    });

    const request = new NextRequest('http://localhost:3000/api/v1/decisions?page=2&limit=20');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.meta.fromCache).toBe(false);
    expect(payload.data[0]?.id).toBe('dec-db-2');
    expect(redisGet).toHaveBeenCalledTimes(1);
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to database when cache payload is malformed', async () => {
    getTokenMock.mockResolvedValue({ role: 'user', sub: 'user-1' });
    countMock.mockResolvedValue(1);

    getRedisClientMock.mockResolvedValue({
      get: vi.fn().mockResolvedValue(JSON.stringify([{ invalid: true }])),
      setEx: vi.fn().mockResolvedValue('OK'),
    });

    findManyMock.mockResolvedValue([
      {
        id: 'dec-db-3',
        matchId: 'match-db-3',
        homeTeam: 'Spurs',
        awayTeam: 'Mavs',
        matchDate: new Date('2026-01-06T20:00:00.000Z'),
        status: 'PICK',
        rationale: 'DB malformed cache fallback',
        edge: 0.09,
        confidence: 0.7,
        recommendedPick: 'HOME_ML',
        runId: 'run-db-3',
        createdAt: new Date('2026-01-06T18:00:00.000Z'),
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/v1/decisions?page=1&limit=20');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.meta.fromCache).toBe(false);
    expect(payload.data[0]?.id).toBe('dec-db-3');
    expect(findManyMock).toHaveBeenCalledTimes(1);
  });
});
