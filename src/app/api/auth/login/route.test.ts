import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

describe('POST /api/auth/login', () => {
  it('returns 410 because endpoint is deprecated', async () => {
    const request = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', password: 'secret' }),
      headers: {
        'content-type': 'application/json',
      },
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload).toEqual({
      error: 'Deprecated endpoint. Use NextAuth credentials flow.',
    });
  });
});
