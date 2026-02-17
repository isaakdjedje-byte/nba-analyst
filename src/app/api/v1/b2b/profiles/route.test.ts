import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  withB2BAuthMock,
  requireScopeMock,
  createErrorResponseMock,
  validateProfilePaginationMock,
  validateCreateProfileRequestMock,
  getProfilesByApiKeyIdMock,
  createProfileMock,
  governanceValidateMock,
} = vi.hoisted(() => ({
  withB2BAuthMock: vi.fn(),
  requireScopeMock: vi.fn(),
  createErrorResponseMock: vi.fn(),
  validateProfilePaginationMock: vi.fn(),
  validateCreateProfileRequestMock: vi.fn(),
  getProfilesByApiKeyIdMock: vi.fn(),
  createProfileMock: vi.fn(),
  governanceValidateMock: vi.fn(),
}));

vi.mock('../_base', () => ({
  withB2BAuth: withB2BAuthMock,
  requireScope: requireScopeMock,
  createErrorResponse: createErrorResponseMock,
}));

vi.mock('../schemas', () => ({
  validateProfilePagination: validateProfilePaginationMock,
  validateCreateProfileRequest: validateCreateProfileRequestMock,
}));

vi.mock('@/server/db/repositories/b2b-profiles-repository', () => ({
  getProfilesByApiKeyId: getProfilesByApiKeyIdMock,
  createProfile: createProfileMock,
}));

vi.mock('@/server/policy/b2b-profile-validator', () => ({
  validateProfileConfig: governanceValidateMock,
}));

import { GET, POST } from './route';

describe('B2B profiles route', () => {
  beforeEach(() => {
    withB2BAuthMock.mockReset();
    requireScopeMock.mockReset();
    createErrorResponseMock.mockReset();
    validateProfilePaginationMock.mockReset();
    validateCreateProfileRequestMock.mockReset();
    getProfilesByApiKeyIdMock.mockReset();
    createProfileMock.mockReset();
    governanceValidateMock.mockReset();

    withB2BAuthMock.mockImplementation(async (request, handler) =>
      handler(
        {
          id: 'client-1',
          name: 'Client 1',
          scopes: ['profiles:read', 'profiles:write'],
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
    validateCreateProfileRequestMock.mockReturnValue({
      name: 'Default',
      description: 'desc',
      confidenceMin: 0.7,
      edgeMin: 0.08,
      maxDriftScore: 0.2,
      isDefault: false,
    });

    governanceValidateMock.mockReturnValue({ valid: true, errors: [] });
    getProfilesByApiKeyIdMock.mockResolvedValue({ profiles: [], total: 0 });
    createProfileMock.mockResolvedValue({ id: 'profile-1', name: 'Default' });
  });

  it('GET returns 400 when pagination validation fails', async () => {
    validateProfilePaginationMock.mockImplementation(() => {
      throw new Error('invalid page');
    });

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/profiles?page=0');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
  });

  it('GET returns 403 when profiles:read scope is missing', async () => {
    requireScopeMock.mockReturnValue(
      NextResponse.json(
        { error: { code: 'FORBIDDEN' }, meta: { traceId: 'trace-1', timestamp: '2026-01-01T00:00:00.000Z' } },
        { status: 403 }
      )
    );

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/profiles');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('FORBIDDEN');
  });

  it('POST returns 403 when profiles:write scope is missing', async () => {
    requireScopeMock.mockImplementation((_client, scope) => {
      if (scope === 'profiles:write') {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN' }, meta: { traceId: 'trace-1', timestamp: '2026-01-01T00:00:00.000Z' } },
          { status: 403 }
        );
      }

      return null;
    });

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/profiles', {
      method: 'POST',
      body: JSON.stringify({ name: 'Blocked' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('FORBIDDEN');
    expect(createProfileMock).not.toHaveBeenCalled();
  });

  it('GET returns profile list with pagination metadata', async () => {
    getProfilesByApiKeyIdMock.mockResolvedValue({
      profiles: [{ id: 'profile-1', name: 'Profile 1' }],
      total: 1,
    });

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/profiles?page=1&limit=20');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    expect(payload.meta.total).toBe(1);
    expect(payload.meta.totalPages).toBe(1);
  });

  it('POST returns 422 on governance violation', async () => {
    governanceValidateMock.mockReturnValue({
      valid: false,
      errors: ['confidence too low'],
    });

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/profiles', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Aggressive',
        confidenceMin: 0.4,
        edgeMin: 0.01,
        maxDriftScore: 0.9,
      }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error.code).toBe('GOVERNANCE_VIOLATION');
  });

  it('POST creates profile when payload is valid', async () => {
    const request = new NextRequest('http://localhost:3000/api/v1/b2b/profiles', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Balanced',
        description: 'safe profile',
        confidenceMin: 0.7,
        edgeMin: 0.08,
        maxDriftScore: 0.2,
        isDefault: true,
      }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.data.id).toBe('profile-1');
    expect(createProfileMock).toHaveBeenCalledTimes(1);
  });
});
