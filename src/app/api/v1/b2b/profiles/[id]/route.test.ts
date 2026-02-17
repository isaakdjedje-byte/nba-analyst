import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const {
  withB2BAuthMock,
  requireScopeMock,
  createErrorResponseMock,
  validateUpdateProfileRequestMock,
  getProfileByIdForApiKeyMock,
  updateProfileMock,
  deleteProfileMock,
  governanceValidateMock,
} = vi.hoisted(() => ({
  withB2BAuthMock: vi.fn(),
  requireScopeMock: vi.fn(),
  createErrorResponseMock: vi.fn(),
  validateUpdateProfileRequestMock: vi.fn(),
  getProfileByIdForApiKeyMock: vi.fn(),
  updateProfileMock: vi.fn(),
  deleteProfileMock: vi.fn(),
  governanceValidateMock: vi.fn(),
}));

vi.mock('../../_base', () => ({
  withB2BAuth: withB2BAuthMock,
  requireScope: requireScopeMock,
  createErrorResponse: createErrorResponseMock,
}));

vi.mock('../../schemas', () => ({
  validateUpdateProfileRequest: validateUpdateProfileRequestMock,
}));

vi.mock('@/server/db/repositories/b2b-profiles-repository', () => ({
  getProfileByIdForApiKey: getProfileByIdForApiKeyMock,
  updateProfile: updateProfileMock,
  deleteProfile: deleteProfileMock,
}));

vi.mock('@/server/policy/b2b-profile-validator', () => ({
  validateProfileConfig: governanceValidateMock,
}));

import { GET, PUT, DELETE } from './route';

const validProfileId = '123e4567-e89b-42d3-a456-426614174000';

describe('B2B profiles/:id route', () => {
  beforeEach(() => {
    withB2BAuthMock.mockReset();
    requireScopeMock.mockReset();
    createErrorResponseMock.mockReset();
    validateUpdateProfileRequestMock.mockReset();
    getProfileByIdForApiKeyMock.mockReset();
    updateProfileMock.mockReset();
    deleteProfileMock.mockReset();
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

    validateUpdateProfileRequestMock.mockReturnValue({
      name: 'Updated profile',
      confidenceMin: 0.72,
      edgeMin: 0.1,
      maxDriftScore: 0.2,
      isDefault: false,
      isActive: true,
    });

    governanceValidateMock.mockReturnValue({ valid: true, errors: [] });
    getProfileByIdForApiKeyMock.mockResolvedValue({ id: validProfileId, name: 'Profile 1' });
    updateProfileMock.mockResolvedValue({ id: validProfileId, name: 'Updated profile' });
    deleteProfileMock.mockResolvedValue(true);
  });

  it('GET returns 400 for invalid profile id format', async () => {
    const request = new NextRequest('http://localhost:3000/api/v1/b2b/profiles/not-uuid');
    const response = await GET(request, { params: Promise.resolve({ id: 'not-uuid' }) });
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

    const request = new NextRequest(`http://localhost:3000/api/v1/b2b/profiles/${validProfileId}`);
    const response = await GET(request, { params: Promise.resolve({ id: validProfileId }) });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('FORBIDDEN');
  });

  it('PUT returns 403 when profiles:write scope is missing', async () => {
    requireScopeMock.mockImplementation((_client, scope) => {
      if (scope === 'profiles:write') {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN' }, meta: { traceId: 'trace-1', timestamp: '2026-01-01T00:00:00.000Z' } },
          { status: 403 }
        );
      }

      return null;
    });

    const request = new NextRequest(`http://localhost:3000/api/v1/b2b/profiles/${validProfileId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'Blocked update' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await PUT(request, { params: Promise.resolve({ id: validProfileId }) });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('FORBIDDEN');
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it('DELETE returns 403 when profiles:write scope is missing', async () => {
    requireScopeMock.mockImplementation((_client, scope) => {
      if (scope === 'profiles:write') {
        return NextResponse.json(
          { error: { code: 'FORBIDDEN' }, meta: { traceId: 'trace-1', timestamp: '2026-01-01T00:00:00.000Z' } },
          { status: 403 }
        );
      }

      return null;
    });

    const request = new NextRequest(`http://localhost:3000/api/v1/b2b/profiles/${validProfileId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: validProfileId }) });
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('FORBIDDEN');
    expect(deleteProfileMock).not.toHaveBeenCalled();
  });

  it('GET returns 404 when profile is not found', async () => {
    getProfileByIdForApiKeyMock.mockResolvedValue(null);

    const request = new NextRequest(`http://localhost:3000/api/v1/b2b/profiles/${validProfileId}`);
    const response = await GET(request, { params: Promise.resolve({ id: validProfileId }) });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('NOT_FOUND');
  });

  it('PUT returns 422 when governance validation fails', async () => {
    governanceValidateMock.mockReturnValue({ valid: false, errors: ['confidence too low'] });

    const request = new NextRequest(`http://localhost:3000/api/v1/b2b/profiles/${validProfileId}`, {
      method: 'PUT',
      body: JSON.stringify({
        confidenceMin: 0.4,
        edgeMin: 0.01,
        maxDriftScore: 0.9,
      }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await PUT(request, { params: Promise.resolve({ id: validProfileId }) });
    const payload = await response.json();

    expect(response.status).toBe(422);
    expect(payload.error.code).toBe('GOVERNANCE_VIOLATION');
  });

  it('PUT updates profile on valid payload', async () => {
    const request = new NextRequest(`http://localhost:3000/api/v1/b2b/profiles/${validProfileId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Updated profile',
        confidenceMin: 0.72,
        edgeMin: 0.1,
        maxDriftScore: 0.2,
        reason: 'tuning',
      }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await PUT(request, { params: Promise.resolve({ id: validProfileId }) });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.id).toBe(validProfileId);
    expect(updateProfileMock).toHaveBeenCalledTimes(1);
  });

  it('DELETE returns 204 on successful delete', async () => {
    const request = new NextRequest(`http://localhost:3000/api/v1/b2b/profiles/${validProfileId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason: 'cleanup' }),
      headers: { 'content-type': 'application/json' },
    });

    const response = await DELETE(request, { params: Promise.resolve({ id: validProfileId }) });

    expect(response.status).toBe(204);
    expect(deleteProfileMock).toHaveBeenCalledTimes(1);
  });
});
