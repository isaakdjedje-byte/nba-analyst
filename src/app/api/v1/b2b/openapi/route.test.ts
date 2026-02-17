import { describe, expect, it, vi } from 'vitest';

const { generateOpenAPISpecMock } = vi.hoisted(() => ({
  generateOpenAPISpecMock: vi.fn(),
}));

vi.mock('@/server/docs/openapi-generator', () => ({
  generateOpenAPISpec: generateOpenAPISpecMock,
}));

import { GET } from './route';

describe('GET /api/v1/b2b/openapi', () => {
  it('returns generated OpenAPI spec', async () => {
    generateOpenAPISpecMock.mockReturnValue({ openapi: '3.0.3', info: { title: 'B2B API' } });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.openapi).toBe('3.0.3');
  });

  it('returns 500 when generation fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    generateOpenAPISpecMock.mockImplementation(() => {
      throw new Error('generation failed');
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error.code).toBe('INTERNAL_ERROR');

    errorSpy.mockRestore();
  });
});
