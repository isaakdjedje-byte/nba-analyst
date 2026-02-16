/**
 * OpenAPI Documentation E2E Tests
 * 
 * Tests for Story 6.4: Implementer la documentation API OpenAPI et exemples
 * Tests the documentation endpoints themselves
 * 
 * @story 6.4
 */

import { test, expect } from '@playwright/test';

test.describe('OpenAPI Documentation Endpoints', () => {
  
  test.describe('GET /api/v1/b2b/openapi', () => {
    
    test('should return valid OpenAPI JSON', async ({ request }) => {
      const response = await request.get('/api/v1/b2b/openapi');
      
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('application/json');
      
      const json = await response.json();
      
      // Verify OpenAPI spec structure
      expect(json.openapi).toBeDefined();
      expect(json.info).toBeDefined();
      expect(json.paths).toBeDefined();
      expect(json.components).toBeDefined();
    });
    
    test('should return OpenAPI 3.1.0 spec', async ({ request }) => {
      const response = await request.get('/api/v1/b2b/openapi');
      const json = await response.json();
      
      expect(json.openapi).toBe('3.1.0');
    });
    
    test('should have proper cache headers', async ({ request }) => {
      const response = await request.get('/api/v1/b2b/openapi');
      
      expect(response.headers()['cache-control']).toContain('public');
      expect(response.headers()['cache-control']).toContain('max-age');
    });
    
    test('should document all required endpoints', async ({ request }) => {
      const response = await request.get('/api/v1/b2b/openapi');
      const json = await response.json();
      
      const paths = Object.keys(json.paths);
      
      // Decisions endpoints
      expect(paths).toContain('/api/v1/b2b/decisions');
      expect(paths).toContain('/api/v1/b2b/decisions/{id}');
      expect(paths).toContain('/api/v1/b2b/decisions/{id}/explain');
      
      // Profiles endpoints
      expect(paths).toContain('/api/v1/b2b/profiles');
      expect(paths).toContain('/api/v1/b2b/profiles/{id}');
      expect(paths).toContain('/api/v1/b2b/profiles/{id}/history');
      
      // Runs endpoints
      expect(paths).toContain('/api/v1/b2b/runs');
    });
    
    test('should have error response examples', async ({ request }) => {
      const response = await request.get('/api/v1/b2b/openapi');
      const json = await response.json();
      
      // Check that error responses have examples
      const decisionsEndpoint = json.paths['/api/v1/b2b/decisions']?.get;
      const errorResponses = ['400', '401', '429', '500'];
      
      errorResponses.forEach(status => {
        const response = decisionsEndpoint?.responses?.[status];
        expect(response).toBeDefined();
        expect(response.content).toBeDefined();
        expect(response.content['application/json'].example).toBeDefined();
      });
    });
    
    test('should have API key security scheme', async ({ request }) => {
      const response = await request.get('/api/v1/b2b/openapi');
      const json = await response.json();
      
      expect(json.components?.securitySchemes?.ApiKeyAuth).toBeDefined();
      expect(json.components.securitySchemes.ApiKeyAuth.type).toBe('apiKey');
      expect(json.components.securitySchemes.ApiKeyAuth.in).toBe('header');
      expect(json.components.securitySchemes.ApiKeyAuth.name).toBe('X-API-Key');
    });
  });
  
  test.describe('GET /api/v1/b2b/docs', () => {
    
    test('should return HTML with Swagger UI', async ({ request }) => {
      const response = await request.get('/api/v1/b2b/docs');
      
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('text/html');
      
      const text = await response.text();
      
      // Check for Swagger UI elements
      expect(text).toContain('swagger-ui');
      expect(text).toContain('SwaggerUIBundle');
      expect(text).toContain('/api/v1/b2b/openapi');
    });
    
    test('should have proper cache headers for docs', async ({ request }) => {
      const response = await request.get('/api/v1/b2b/docs');
      
      // Docs should not be cached (development)
      expect(response.headers()['cache-control']).toContain('no-cache');
    });
    
    test('should include API key input functionality', async ({ request }) => {
      const response = await request.get('/api/v1/b2b/docs');
      const text = await response.text();
      
      // Check for API key handling in Swagger UI
      expect(text).toContain('X-API-Key');
    });
    
    test('should reference correct OpenAPI spec URL', async ({ request }) => {
      const response = await request.get('/api/v1/b2b/docs');
      const text = await response.text();
      
      expect(text).toContain("url: '/api/v1/b2b/openapi'");
    });
  });
});
