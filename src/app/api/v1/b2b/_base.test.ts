import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const { authenticateB2BApiKeyMock } = vi.hoisted(() => ({
  authenticateB2BApiKeyMock: vi.fn(),
}));

vi.mock('@/server/auth/b2b/api-key-auth', () => ({
  authenticateB2BApiKey: authenticateB2BApiKeyMock,
}));

import {
  createErrorResponse,
  createSuccessResponse,
  requireScope,
  withB2BAuth,
} from './_base';

describe('B2B base helpers', () => {
  const originalEnv = {
    nodeEnv: process.env.NODE_ENV,
    devApiKey: process.env.B2B_DEV_API_KEY,
    allowDevBypass: process.env.B2B_ALLOW_DEV_API_KEY_BYPASS,
  };

  beforeEach(() => {
    authenticateB2BApiKeyMock.mockReset();
    vi.stubEnv('NODE_ENV', originalEnv.nodeEnv ?? 'test');
    vi.stubEnv('B2B_DEV_API_KEY', originalEnv.devApiKey ?? '');
    vi.stubEnv('B2B_ALLOW_DEV_API_KEY_BYPASS', originalEnv.allowDevBypass ?? '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('createSuccessResponse returns normalized payload', () => {
    const payload = createSuccessResponse({ ok: true }, 'trace-1', '2026-01-01T00:00:00.000Z');

    expect(payload).toEqual({
      data: { ok: true },
      meta: {
        traceId: 'trace-1',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    });
  });

  it('createErrorResponse returns normalized payload', () => {
    const payload = createErrorResponse(
      'FORBIDDEN',
      'missing scope',
      'trace-1',
      '2026-01-01T00:00:00.000Z',
      { scope: 'decisions:read' }
    );

    expect(payload).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'missing scope',
        details: { scope: 'decisions:read' },
      },
      meta: {
        traceId: 'trace-1',
        timestamp: '2026-01-01T00:00:00.000Z',
      },
    });
  });

  it('requireScope allows clients with no configured scopes', async () => {
    const result = requireScope(
      {
        id: 'client-1',
        name: 'Client',
        scopes: [],
        rateLimit: 100,
        isActive: true,
      },
      'decisions:read',
      'trace-1',
      '2026-01-01T00:00:00.000Z'
    );

    expect(result).toBeNull();
  });

  it('requireScope returns 403 when required scope is missing', async () => {
    const result = requireScope(
      {
        id: 'client-1',
        name: 'Client',
        scopes: ['runs:read'],
        rateLimit: 100,
        isActive: true,
      },
      'decisions:read',
      'trace-1',
      '2026-01-01T00:00:00.000Z'
    );

    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    const payload = await response.json();
    expect(response.status).toBe(403);
    expect(payload.error.code).toBe('FORBIDDEN');
  });

  it('withB2BAuth returns 401 when api key is missing/invalid', async () => {
    authenticateB2BApiKeyMock.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions');
    const response = await withB2BAuth(request, async () => NextResponse.json({ ok: true }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe('UNAUTHORIZED');
  });

  it('withB2BAuth returns 401 when api key is inactive', async () => {
    authenticateB2BApiKeyMock.mockResolvedValue({
      id: 'client-1',
      name: 'Client 1',
      scopes: ['decisions:read'],
      rateLimit: 100,
      isActive: false,
    });

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions', {
      headers: { 'x-api-key': 'bad-key' },
    });
    const response = await withB2BAuth(request, async () => NextResponse.json({ ok: true }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe('UNAUTHORIZED');
  });

  it('withB2BAuth allows configured dev api key only in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('B2B_DEV_API_KEY', 'dev-key');
    vi.stubEnv('B2B_ALLOW_DEV_API_KEY_BYPASS', 'true');

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions', {
      headers: { 'x-api-key': 'dev-key' },
    });

    const response = await withB2BAuth(request, async (client) =>
      NextResponse.json({
        ok: true,
        clientId: client.id,
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.clientId).toBe('dev-client');
    expect(authenticateB2BApiKeyMock).not.toHaveBeenCalled();
  });

  it('withB2BAuth does not accept dev api key in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('B2B_DEV_API_KEY', 'dev-key');
    authenticateB2BApiKeyMock.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions', {
      headers: { 'x-api-key': 'dev-key' },
    });

    const response = await withB2BAuth(request, async () => NextResponse.json({ ok: true }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error.code).toBe('UNAUTHORIZED');
    expect(authenticateB2BApiKeyMock).toHaveBeenCalledTimes(1);
  });

  it('withB2BAuth returns 500 when handler throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    authenticateB2BApiKeyMock.mockResolvedValue({
      id: 'client-1',
      name: 'Client 1',
      scopes: ['decisions:read'],
      rateLimit: 100,
      isActive: true,
    });

    const request = new NextRequest('http://localhost:3000/api/v1/b2b/decisions', {
      headers: { 'x-api-key': 'valid-key' },
    });
    const response = await withB2BAuth(request, async () => {
      throw new Error('boom');
    });
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe('INTERNAL_ERROR');

    errorSpy.mockRestore();
  });
});
