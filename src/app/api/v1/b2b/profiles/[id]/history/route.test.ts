import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  withB2BAuthMock,
  requireScopeMock,
  createErrorResponseMock,
  validateProfilePaginationMock,
  getProfileHistoryMock,
  getProfileByIdForApiKeyMock,
} = vi.hoisted(() => ({
  withB2BAuthMock: vi.fn(),
  requireScopeMock: vi.fn(),
  createErrorResponseMock: vi.fn(),
  validateProfilePaginationMock: vi.fn(),
  getProfileHistoryMock: vi.fn(),
  getProfileByIdForApiKeyMock: vi.fn(),
}));

vi.mock('../../../_base', () => ({
  withB2BAuth: withB2BAuthMock,
  requireScope: requireScopeMock,
  createErrorResponse: createErrorResponseMock,
}));

vi.mock('../../../schemas', () => ({
  validateProfilePagination: validateProfilePaginationMock,
}));

vi.mock('@/server/db/repositories/b2b-profiles-repository', () => ({
  getProfileHistory: getProfileHistoryMock,
  getProfileByIdForApiKey: getProfileByIdForApiKeyMock,
}));

import { GET } from './route';

const validProfileId = '123e4567-e89b-42d3-a456-426614174000';

describe('GET /api/v1/b2b/profiles/:id/history', () => {
  beforeEach(() => {
    withB2BAuthMock.mockReset();
    requireScopeMock.mockReset();
    createErrorResponseMock.mockReset();
    validateProfilePaginationMock.mockReset();
    getProfileHistoryMock.mockReset();
    getProfileByIdForApiKeyMock.mockReset();

    withB2BAuthMock.mockImplementation(async (request, handler) =>
      handler(
        {
          id: 'client-1',
          name: 'Client 1',
          scopes: ['profiles:read'],
          rateLimit: 100,
          isActive: true,
        },
        'trace-1',
        '2026-01-01T00:00:00.000Z'
      )
    );

    createErrorResponseMock.mockImplementation((code, message, traceId, timestamp, details) => ({
      error: { code, message, details },
      meta: { traceId, timestamp },
    }));

    requireScopeMock.mockReturnValue(null);

    validateProfilePaginationMock.mockReturnValue({ page: 1, limit: 20 });
    getProfileByIdForApiKeyMock.mockResolvedValue({ id: validProfileId, name: 'Profile 1' });
    getProfileHistoryMock.mockResolvedValue({ history: [], total: 0 });
  });

  it('returns 400 for invalid UUID', async () => {
    const request = new NextRequest('http://localhost:3000/api/v1/b2b/profiles/not-uuid/history');
    const response = await GET(request, { params: Promise.resolve({ id: 'not-uuid' }) });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 when profiles:read scope is missing', async () => {
    requireScopeMock.mockReturnValue(
      NextResponse.json(
        { error: { code: 'FORBIDDEN' }, meta: { traceId: 'trace-1', timestamp: '2026-01-01T00:00:00.000Z' } },
        { status: 403 }
      )
    );

    const request = new NextRequest(`http://localhost:3000/api/v1/b2b/profiles/${validProfileId}/history`);
    const response = await GET(request, { params: Promise.resolve({ id: validProfileId }) });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when profile is missing', async () => {
    getProfileByIdForApiKeyMock.mockResolvedValue(null);

    const request = new NextRequest(`http://localhost:3000/api/v1/b2b/profiles/${validProfileId}/history`);
    const response = await GET(request, { params: Promise.resolve({ id: validProfileId }) });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 when pagination validation fails', async () => {
    validateProfilePaginationMock.mockImplementation(() => {
      throw new Error('invalid limit');
    });

    const request = new NextRequest(`http://localhost:3000/api/v1/b2b/profiles/${validProfileId}/history?limit=abc`);
    const response = await GET(request, { params: Promise.resolve({ id: validProfileId }) });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns history and pagination metadata', async () => {
    validateProfilePaginationMock.mockReturnValue({ page: 2, limit: 2 });
    getProfileHistoryMock.mockResolvedValue({
      history: [
        { id: 'h1', action: 'UPDATE', traceId: 'trace-h1' },
        { id: 'h2', action: 'DELETE', traceId: 'trace-h2' },
      ],
      total: 5,
    });

    const request = new NextRequest(`http://localhost:3000/api/v1/b2b/profiles/${validProfileId}/history?page=2&limit=2`);
    const response = await GET(request, { params: Promise.resolve({ id: validProfileId }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(2);
    expect(payload.meta.page).toBe(2);
    expect(payload.meta.limit).toBe(2);
    expect(payload.meta.total).toBe(5);
    expect(payload.meta.totalPages).toBe(3);
    expect(payload.meta.count).toBe(2);
  });
});
