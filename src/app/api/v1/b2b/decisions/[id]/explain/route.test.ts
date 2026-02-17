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

vi.mock('../../../_base', () => ({
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

describe('GET /api/v1/b2b/decisions/:id/explain', () => {
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

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions/dec-1/explain');
    const response = await GET(request, { params: Promise.resolve({ id: 'dec-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when decision is not found', async () => {
    findFirstMock.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions/dec-missing/explain');
    const response = await GET(request, { params: Promise.resolve({ id: 'dec-missing' }) });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 when lookup query is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions/dec-1/explain?lookup=bad');
    const response = await GET(request, { params: Promise.resolve({ id: 'dec-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it('returns 400 when decision id is empty', async () => {
    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions//explain');
    const response = await GET(request, { params: Promise.resolve({ id: '' }) });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it('returns explanation payload with mapped gates and signals', async () => {
    findFirstMock.mockResolvedValue({
      id: 'dec-1',
      traceId: 'trace-dec-1',
      matchId: 'match-1',
      status: 'PICK',
      rationale: 'Good opportunity',
      confidence: 0.82,
      edge: 0.11,
      confidenceGate: true,
      edgeGate: true,
      driftGate: true,
      hardStopGate: true,
      hardStopReason: null,
      recommendedPick: 'HOME_ML',
      modelVersion: 'v2',
      predictionInputs: {
        homeAdvantage: 0.2,
        driftScore: 0.04,
      },
      matchDate: new Date('2026-01-10T20:00:00.000Z'),
      homeTeam: 'Lakers',
      awayTeam: 'Celtics',
      createdAt: new Date('2026-01-10T18:00:00.000Z'),
    });

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions/dec-1/explain');
    const response = await GET(request, { params: Promise.resolve({ id: 'dec-1' }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.status).toBe('Pick');
    expect(payload.data.gateOutcomes).toHaveLength(4);
    expect(payload.data.dataSignals.modelVersion).toBe('v2');
    expect(payload.data.dataSignals.homeAdvantage).toBe(0.2);
  });
});
