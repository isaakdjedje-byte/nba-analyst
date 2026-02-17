/**
 * Story 2.5: Policy Engine - Configuration Endpoints Tests
 * AC1: Configuration management
 * 
 * P0: Get/Update policy configuration
 * P1: Admin authorization
 * P2: Config validation
 */

import { test, expect } from '@playwright/test';
import { PolicyFactory } from '../factories/policy-factory';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

test.describe('Story 2.5: Policy Engine - Configuration Endpoints @P0 @P1 @story-2.5', () => {
  
  test.describe.configure({ mode: 'serial' });

  // P0: AC1 - Get current policy configuration
  test.skip('P0: GET /api/v1/policy/config - Returns current policy configuration', async ({ request }) => {
    // When: Request current policy configuration
    const response = await request.get(`${API_BASE_URL}/api/v1/policy/config`);
    
    // Then: Response status is 200
    expect(response.status()).toBe(200);
    
    const config = await response.json();
    
    // And: Response contains all required thresholds
    expect(config).toHaveProperty('edge_threshold');
    expect(config).toHaveProperty('confidence_threshold');
    expect(config).toHaveProperty('drift_threshold');
    expect(config).toHaveProperty('hard_stop_enabled');
    expect(config).toHaveProperty('version');
    
    // And: Threshold values are numbers
    expect(typeof config.edge_threshold).toBe('number');
    expect(typeof config.confidence_threshold).toBe('number');
    expect(typeof config.drift_threshold).toBe('number');
    
    // And: Hard-stop enabled is boolean
    expect(typeof config.hard_stop_enabled).toBe('boolean');
    
    // And: Version is string
    expect(typeof config.version).toBe('string');
  });

  // P0: AC1 - Policy thresholds are configurable
  test.skip('P0: GET /api/v1/policy/config - Returns valid threshold values', async ({ request }) => {
    // When: Request policy configuration
    const response = await request.get(`${API_BASE_URL}/api/v1/policy/config`);
    const config = await response.json();
    
    // Then: Thresholds are within expected ranges
    expect(config.edge_threshold).toBeGreaterThanOrEqual(0);
    expect(config.edge_threshold).toBeLessThanOrEqual(1);
    expect(config.confidence_threshold).toBeGreaterThanOrEqual(0);
    expect(config.confidence_threshold).toBeLessThanOrEqual(1);
    expect(config.drift_threshold).toBeGreaterThanOrEqual(0);
    expect(config.drift_threshold).toBeLessThanOrEqual(1);
  });

  // P0: AC1 - Update policy configuration (admin only)
  test.skip('P0: PUT /api/v1/policy/config - Updates policy configuration', async ({ request }) => {
    // Given: New policy configuration
    const newConfig = PolicyFactory.createPolicyConfig({
      edge_threshold: 0.06,
      confidence_threshold: 0.80,
      drift_threshold: 0.12,
      hard_stop_enabled: true,
      version: '2.5.1'
    });
    
    // When: Update policy configuration with admin token
    const response = await request.put(`${API_BASE_URL}/api/v1/policy/config`, {
      data: newConfig,
      headers: {
        'Authorization': 'Bearer admin-token',
        'Content-Type': 'application/json'
      }
    });
    
    // Then: Response status is 200
    expect(response.status()).toBe(200);
    
    const updatedConfig = await response.json();
    
    // And: Configuration is updated
    expect(updatedConfig.edge_threshold).toBe(0.06);
    expect(updatedConfig.confidence_threshold).toBe(0.80);
    expect(updatedConfig.drift_threshold).toBe(0.12);
    expect(updatedConfig.hard_stop_enabled).toBe(true);
  });

  // P1: Authorization - Non-admin cannot update config
  test.skip('P1: PUT /api/v1/policy/config - Returns 403 for non-admin users', async ({ request }) => {
    // Given: New policy configuration
    const newConfig = PolicyFactory.createPolicyConfig();
    
    // When: Update without admin token
    const response = await request.put(`${API_BASE_URL}/api/v1/policy/config`, {
      data: newConfig,
      headers: {
        'Authorization': 'Bearer user-token'
      }
    });
    
    // Then: Response status is 403 Forbidden
    expect(response.status()).toBe(403);
  });

  // P1: Authorization - No token returns 401
  test.skip('P1: PUT /api/v1/policy/config - Returns 401 without token', async ({ request }) => {
    // Given: New policy configuration
    const newConfig = PolicyFactory.createPolicyConfig();
    
    // When: Update without any token
    const response = await request.put(`${API_BASE_URL}/api/v1/policy/config`, {
      data: newConfig
    });
    
    // Then: Response status is 401 Unauthorized
    expect(response.status()).toBe(401);
  });

  // P1: Ops role can update config
  test.skip('P1: PUT /api/v1/policy/config - Allows ops role to update', async ({ request }) => {
    // Given: New policy configuration
    const newConfig = PolicyFactory.createPolicyConfig();
    
    // When: Update with ops token
    const response = await request.put(`${API_BASE_URL}/api/v1/policy/config`, {
      data: newConfig,
      headers: {
        'Authorization': 'Bearer ops-token'
      }
    });
    
    // Then: Response status is 200
    expect(response.status()).toBe(200);
  });

  // P2: Config validation - Invalid thresholds
  test.skip('P2: PUT /api/v1/policy/config - Returns 400 for invalid threshold values', async ({ request }) => {
    // Given: Invalid policy configuration (negative threshold)
    const invalidConfig = PolicyFactory.createPolicyConfig({
      edge_threshold: -0.1,
      confidence_threshold: 1.5, // Above 1
      drift_threshold: -0.5
    });
    
    // When: Update with invalid config
    const response = await request.put(`${API_BASE_URL}/api/v1/policy/config`, {
      data: invalidConfig,
      headers: {
        'Authorization': 'Bearer admin-token'
      }
    });
    
    // Then: Response status is 400
    expect(response.status()).toBe(400);
    
    const error = await response.json();
    expect(error).toHaveProperty('message');
    expect(error.message).toContain('threshold');
  });

  // P2: Config validation - Missing required fields
  test.skip('P2: PUT /api/v1/policy/config - Returns 400 for missing required fields', async ({ request }) => {
    // Given: Incomplete configuration
    const incompleteConfig = {
      edge_threshold: 0.05
      // Missing other required fields
    };
    
    // When: Update with incomplete config
    const response = await request.put(`${API_BASE_URL}/api/v1/policy/config`, {
      data: incompleteConfig,
      headers: {
        'Authorization': 'Bearer admin-token'
      }
    });
    
    // Then: Response status is 400
    expect(response.status()).toBe(400);
  });

  // P2: Config persistence - Changes persist
  test.skip('P2: GET /api/v1/policy/config - Returns updated config after PUT', async ({ request }) => {
    // Given: Updated configuration
    const newConfig = PolicyFactory.createPolicyConfig({
      edge_threshold: 0.07,
      confidence_threshold: 0.78,
      drift_threshold: 0.10
    });
    
    // When: Update configuration
    await request.put(`${API_BASE_URL}/api/v1/policy/config`, {
      data: newConfig,
      headers: {
        'Authorization': 'Bearer admin-token'
      }
    });
    
    // And: Get configuration
    const response = await request.get(`${API_BASE_URL}/api/v1/policy/config`);
    const retrievedConfig = await response.json();
    
    // Then: Retrieved config matches updated values
    expect(retrievedConfig.edge_threshold).toBe(0.07);
    expect(retrievedConfig.confidence_threshold).toBe(0.78);
    expect(retrievedConfig.drift_threshold).toBe(0.10);
  });
});
