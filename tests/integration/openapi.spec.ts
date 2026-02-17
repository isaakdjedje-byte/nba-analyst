/**
 * OpenAPI Documentation Integration Tests
 * 
 * Tests for Story 6.4: Implementer la documentation API OpenAPI et exemples
 * 
 * @story 6.4
 */

import { describe, it, expect } from 'vitest';
import { generateOpenAPISpec } from '@/server/docs/openapi-generator';

describe('OpenAPI Specification', () => {
  it('should generate valid OpenAPI 3.0 spec', () => {
    const spec = generateOpenAPISpec();
    
    // Verify basic structure
    expect(spec.openapi).toBe('3.1.0');
    expect(spec.info).toBeDefined();
    expect(spec.info.title).toBe('NBA Analyst B2B API');
    expect(spec.info.version).toBe('1.0.0');
    expect(spec.servers).toBeDefined();
    expect(spec.components).toBeDefined();
    expect(spec.paths).toBeDefined();
  });
  
  it('should have all required endpoints documented', () => {
    const spec = generateOpenAPISpec();
    const paths = Object.keys(spec.paths);
    
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
  
  it('should have all schemas defined', () => {
    const spec = generateOpenAPISpec();
    const schemas = spec.components?.schemas;
    
    // Common schemas
    expect(schemas?.Meta).toBeDefined();
    expect(schemas?.ErrorResponse).toBeDefined();
    expect(schemas?.PaginationMeta).toBeDefined();
    
    // Decision schemas
    expect(schemas?.Decision).toBeDefined();
    expect(schemas?.DecisionStatus).toBeDefined();
    expect(schemas?.DecisionListResponse).toBeDefined();
    expect(schemas?.DecisionResponse).toBeDefined();
    expect(schemas?.DecisionExplanation).toBeDefined();
    expect(schemas?.ExplainResponse).toBeDefined();
    
    // Profile schemas
    expect(schemas?.ProfileResponse).toBeDefined();
    expect(schemas?.CreateProfileRequest).toBeDefined();
    expect(schemas?.UpdateProfileRequest).toBeDefined();
    expect(schemas?.ProfileHistoryEntry).toBeDefined();
    
    // Runs schemas
    expect(schemas?.DailyRun).toBeDefined();
    expect(schemas?.RunsListResponse).toBeDefined();
  });
  
  it('should have API key security scheme defined', () => {
    const spec = generateOpenAPISpec();
    const securitySchemes = spec.components?.securitySchemes;
    
    expect(securitySchemes?.ApiKeyAuth).toBeDefined();
    expect(securitySchemes?.ApiKeyAuth.type).toBe('apiKey');
    expect(securitySchemes?.ApiKeyAuth.in).toBe('header');
    expect(securitySchemes?.ApiKeyAuth.name).toBe('X-API-Key');
  });
  
  it('should have error responses documented', () => {
    const spec = generateOpenAPISpec();
    
    // Check decisions endpoint has error responses
    const decisionsEndpoint = spec.paths['/api/v1/b2b/decisions']?.get;
    expect(decisionsEndpoint?.responses?.['400']).toBeDefined();
    expect(decisionsEndpoint?.responses?.['401']).toBeDefined();
    expect(decisionsEndpoint?.responses?.['429']).toBeDefined();
    expect(decisionsEndpoint?.responses?.['500']).toBeDefined();
  });
  
  it('should have examples in schemas', () => {
    const spec = generateOpenAPISpec();
    const decisionSchema = spec.components?.schemas?.Decision;
    
    // Check that schemas have examples
    expect(decisionSchema?.properties?.id?.example).toBeDefined();
    expect(decisionSchema?.properties?.matchId?.example).toBeDefined();
    expect(decisionSchema?.properties?.confidence?.example).toBeDefined();
    expect(decisionSchema?.properties?.edge?.example).toBeDefined();
  });
  
  it('should have tags defined for grouping', () => {
    const spec = generateOpenAPISpec();
    const tags = spec.tags;
    
    expect(tags).toBeDefined();
    expect(tags).toContainEqual(expect.objectContaining({ name: 'Decisions' }));
    expect(tags).toContainEqual(expect.objectContaining({ name: 'Profiles' }));
    expect(tags).toContainEqual(expect.objectContaining({ name: 'Runs' }));
  });
  
  it('should have proper request/response schemas for POST endpoints', () => {
    const spec = generateOpenAPISpec();
    
    // Check POST /profiles has request body
    const createProfileEndpoint = spec.paths['/api/v1/b2b/profiles']?.post;
    expect(createProfileEndpoint?.requestBody).toBeDefined();
    expect(createProfileEndpoint?.requestBody?.content?.['application/json']).toBeDefined();
    
    // Check PUT /profiles/{id} has request body
    const updateProfileEndpoint = spec.paths['/api/v1/b2b/profiles/{id}']?.put;
    expect(updateProfileEndpoint?.requestBody).toBeDefined();
  });
  
  it('should have rate limiting documented in 429 response', () => {
    const spec = generateOpenAPISpec();
    
    const decisionsEndpoint = spec.paths['/api/v1/b2b/decisions']?.get;
    const rateLimitResponse = decisionsEndpoint?.responses?.['429'];
    
    expect(rateLimitResponse).toBeDefined();
    expect(rateLimitResponse?.description).toContain('Rate limit');
  });
});
