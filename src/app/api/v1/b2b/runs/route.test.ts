import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  withB2BAuthMock,
  requireScopeMock,
  createErrorResponseMock,
  validateRunsQueryMock,
  countMock,
  findManyMock,
} = vi.hoisted(() => ({
  withB2BAuthMock: vi.fn(),
  requireScopeMock: vi.fn(),
  createErrorResponseMock: vi.fn(),
  validateRunsQueryMock: vi.fn(),
  countMock: vi.fn(),
  findManyMock: vi.fn(),
}));

vi.mock('../_base', () => ({
  withB2BAuth: withB2BAuthMock,
  requireScope: requireScopeMock,
  createErrorResponse: createErrorResponseMock,
}));

vi.mock('../schemas', () => ({
  validateRunsQuery: validateRunsQueryMock,
}));

vi.mock('@/server/db/client', () => ({
  prisma: {
    dailyRun: {
      count: countMock,
      findMany: findManyMock,
    },
  },
}));

import { GET } from './route';

describe('GET /api/v1/b2b/runs', () => {
  beforeEach(() => {
    withB2BAuthMock.mockReset();
    requireScopeMock.mockReset();
    createErrorResponseMock.mockReset();
    validateRunsQueryMock.mockReset();
    countMock.mockReset();
    findManyMock.mockReset();

    withB2BAuthMock.mockImplementation(async (request, handler) =>
      handler(
        {
          id: 'client-1',
          name: 'Client 1',
          scopes: ['runs:read'],
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

    validateRunsQueryMock.mockReturnValue({ page: 1, limit: 20 });
    countMock.mockResolvedValue(0);
    findManyMock.mockResolvedValue([]);
  });

  it('returns 403 when missing runs:read scope', async () => {
    requireScopeMock.mockReturnValue(
      NextResponse.json(
        {
          error: { code: 'FORBIDDEN', message: 'Missing required scope: runs:read' },
          meta: { traceId: 'trace-1', timestamp: '2026-01-01T00:00:00.000Z' },
        },
        { status: 403 }
      )
    );

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/runs');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('FORBIDDEN');
  });

  it('returns 400 when query validation fails', async () => {
    validateRunsQueryMock.mockImplementation(() => {
      throw new Error('invalid limit');
    });

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/runs?limit=abc');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
  });

  it('maps run statuses and pagination metadata', async () => {
    validateRunsQueryMock.mockReturnValue({ page: 2, limit: 2 });
    countMock.mockResolvedValue(5);
    findManyMock.mockResolvedValue([
      {
        id: 'run-1',
        runDate: new Date('2026-01-10T00:00:00.000Z'),
        status: 'COMPLETED',
        startedAt: new Date('2026-01-10T01:00:00.000Z'),
        completedAt: new Date('2026-01-10T01:10:00.000Z'),
        totalMatches: 8,
        predictionsCount: 8,
        createdAt: new Date('2026-01-10T00:30:00.000Z'),
      },
      {
        id: 'run-2',
        runDate: new Date('2026-01-09T00:00:00.000Z'),
        status: 'FAILED',
        startedAt: new Date('2026-01-09T01:00:00.000Z'),
        completedAt: null,
        totalMatches: 8,
        predictionsCount: 3,
        createdAt: new Date('2026-01-09T00:30:00.000Z'),
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/runs?page=2&limit=2');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(2);
    expect(payload.data[0].status).toBe('completed');
    expect(payload.data[1].status).toBe('failed');
    expect(payload.meta.total).toBe(5);
    expect(payload.meta.totalPages).toBe(3);
    expect(payload.meta.page).toBe(2);
    expect(payload.meta.limit).toBe(2);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 2,
        take: 2,
      })
    );
  });
});
