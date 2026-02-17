import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { getServerSessionMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
}));

vi.mock('next-auth', () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock('@/server/auth/auth-options', () => ({
  authOptions: {},
}));

import { GET } from './route';

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    getServerSessionMock.mockReset();
  });

  it('returns 401 when no session exists', async () => {
    getServerSessionMock.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/auth/me');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({ error: 'Unauthorized' });
  });

  it('returns user payload when session exists', async () => {
    getServerSessionMock.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'user',
      },
    });

    const request = new NextRequest('http://localhost:3000/api/auth/me');
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      role: 'user',
    });
  });
});
