import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  withB2BAuthMock,
  requireScopeMock,
  findFirstMock,
} = vi.hoisted(() => ({
  withB2BAuthMock: vi.fn(),
  requireScopeMock: vi.fn(),
  findFirstMock: vi.fn(),
}));

vi.mock('../../_base', () => ({
  withB2BAuth: withB2BAuthMock,
  requireScope: requireScopeMock,
}));

vi.mock('@/server/db/client', () => ({
  prisma: {
    policyDecision: {
      findFirst: findFirstMock,
    },
  },
}));

import { GET } from './route';

describe('GET /api/v1/b2b/decisions/:id', () => {
  beforeEach(() => {
    withB2BAuthMock.mockReset();
    requireScopeMock.mockReset();
    findFirstMock.mockReset();

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
  });

  it('returns 403 when scope is missing', async () => {
    requireScopeMock.mockReturnValue(
      NextResponse.json(
        { error: { code: 'FORBIDDEN' }, meta: { traceId: 'trace-1', timestamp: '2026-01-01T00:00:00.000Z' } },
        { status: 403 }
      )
    );

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions/dec-1');
    const response = await GET(request, { params: Promise.resolve({ id: 'dec-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when decision is not found', async () => {
    findFirstMock.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions/dec-missing');
    const response = await GET(request, { params: Promise.resolve({ id: 'dec-missing' }) });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 when lookup query is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions/dec-1?lookup=bad');
    const response = await GET(request, { params: Promise.resolve({ id: 'dec-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it('returns 400 when id lookup is requested with empty id', async () => {
    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions/?lookup=id');
    const response = await GET(request, { params: Promise.resolve({ id: '' }) });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it('supports lookup by traceId', async () => {
    findFirstMock.mockResolvedValue({
      id: 'dec-1',
      matchId: 'match-1',
      homeTeam: 'Lakers',
      awayTeam: 'Celtics',
      matchDate: new Date('2026-01-10T20:00:00.000Z'),
      status: 'PICK',
      rationale: 'Edge',
      confidence: 0.8,
      edge: 0.1,
      recommendedPick: 'HOME_ML',
      traceId: 'trace-dec-1',
      createdAt: new Date('2026-01-10T18:00:00.000Z'),
      predictionInputs: { confidence: 0.8 },
      modelVersion: 'v1',
    });

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions/trace-dec-1?lookup=traceId');
    const response = await GET(request, { params: Promise.resolve({ id: 'trace-dec-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(findFirstMock).toHaveBeenCalledWith({ where: { traceId: 'trace-dec-1' } });
    expect(payload.data.status).toBe('Pick');
    expect(payload.data.metadata.modelVersion).toBe('v1');
  });
});
