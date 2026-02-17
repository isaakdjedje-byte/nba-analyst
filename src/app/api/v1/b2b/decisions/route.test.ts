import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  withB2BAuthMock,
  requireScopeMock,
  createErrorResponseMock,
  validateDecisionsQueryMock,
  countMock,
  findManyMock,
} = vi.hoisted(() => ({
  withB2BAuthMock: vi.fn(),
  requireScopeMock: vi.fn(),
  createErrorResponseMock: vi.fn(),
  validateDecisionsQueryMock: vi.fn(),
  countMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock('../_base', () => ({
  withB2BAuth: withB2BAuthMock,
  requireScope: requireScopeMock,
  createErrorResponse: createErrorResponseMock,
}));

vi.mock('../schemas', () => ({
  validateDecisionsQuery: validateDecisionsQueryMock,
}));

vi.mock('@/server/db/client', () => ({
  prisma: {
    policyDecision: {
      count: countMock,
      findMany: findManyMock,
    },
  },
}));

import { GET } from './route';

describe('GET /api/v1/b2b/decisions', () => {
  beforeEach(() => {
    withB2BAuthMock.mockReset();
    requireScopeMock.mockReset();
    createErrorResponseMock.mockReset();
    validateDecisionsQueryMock.mockReset();
    countMock.mockReset();
    findManyMock.mockReset();

    withB2BAuthMock.mockImplementation(async (request, handler) =>
      handler(
        {
          id: 'client-1',
          name: 'Client 1',
          scopes: ['decisions:read'],
          rateLimit: 100,
          isActive: true,
        },
        'trace-1',
        '2026-01-01T00:00:00.000Z'
      )
    );

    requireScopeMock.mockReturnValue(null);

    createErrorResponseMock.mockImplementation((code, message, traceId, timestamp, details) => ({
      error: { code, message, details },
      meta: { traceId, timestamp },
    }));

    validateDecisionsQueryMock.mockReturnValue({
      page: 1,
      limit: 20,
    });

    countMock.mockResolvedValue(0);
    findManyMock.mockResolvedValue([]);
  });

  it('returns auth failure from B2B middleware', async () => {
    withB2BAuthMock.mockResolvedValue(
      NextResponse.json(
        {
          error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
          meta: { traceId: 'trace-auth', timestamp: '2026-01-01T00:00:00.000Z' },
        },
        { status: 401 }
      )
    );

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when required scope is missing', async () => {
    requireScopeMock.mockReturnValue(
      NextResponse.json(
        {
          error: { code: 'FORBIDDEN', message: 'Missing required scope: decisions:read' },
          meta: { traceId: 'trace-1', timestamp: '2026-01-01T00:00:00.000Z' },
        },
        { status: 403 }
      )
    );

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('FORBIDDEN');
  });

  it('returns 400 when query validation fails', async () => {
    validateDecisionsQueryMock.mockImplementation(() => {
      throw new Error('Invalid fromDate format');
    });

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions?fromDate=2026/01/01');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns mapped decisions and pagination metadata', async () => {
    validateDecisionsQueryMock.mockReturnValue({
      page: 2,
      limit: 10,
      status: 'Pick',
      matchId: 'match-1',
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    countMock.mockResolvedValue(21);
    findManyMock.mockResolvedValue([
      {
        id: 'dec-1',
        matchId: 'match-1',
        homeTeam: 'Lakers',
        awayTeam: 'Celtics',
        matchDate: new Date('2026-01-10T20:00:00.000Z'),
        status: 'PICK',
        rationale: 'Strong edge',
        confidence: 0.81,
        edge: 0.12,
        recommendedPick: 'HOME_ML',
        traceId: 'trace-dec-1',
        createdAt: new Date('2026-01-10T18:00:00.000Z'),
        prediction: {
          id: 'pred-1',
          matchId: 'match-1',
          league: 'NBA',
        },
      },
      {
        id: 'dec-2',
        matchId: 'match-2',
        homeTeam: 'Heat',
        awayTeam: 'Bulls',
        matchDate: new Date('2026-01-11T20:00:00.000Z'),
        status: 'UNKNOWN',
        rationale: 'Fallback status',
        confidence: 0.62,
        edge: null,
        recommendedPick: null,
        traceId: 'trace-dec-2',
        createdAt: new Date('2026-01-11T18:00:00.000Z'),
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions?page=2&limit=10&status=Pick&matchId=match-1&fromDate=2026-01-01&toDate=2026-01-31');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(2);
    expect(payload.data[0].status).toBe('Pick');
    expect(payload.data[1].status).toBe('No-Bet');
    expect(payload.meta.page).toBe(2);
    expect(payload.meta.limit).toBe(10);
    expect(payload.meta.total).toBe(21);
    expect(payload.meta.totalPages).toBe(3);
    expect(payload.meta.count).toBe(2);

    expect(countMock).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: 'PICK',
        matchId: 'match-1',
      }),
    });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({
          status: 'PICK',
          matchId: 'match-1',
          matchDate: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      })
    );
  });
});
