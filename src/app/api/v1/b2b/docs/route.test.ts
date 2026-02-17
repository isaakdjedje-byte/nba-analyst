import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /api/v1/b2b/docs', () => {
  it('returns swagger UI HTML page', async () => {
    const response = await GET();
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('SwaggerUIBundle');
    expect(html).toContain('/api/v1/b2b/openapi');
  });
});
