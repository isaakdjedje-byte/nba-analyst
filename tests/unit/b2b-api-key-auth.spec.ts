/**
 * Unit Tests for B2B API Key Authentication
 * 
 * Story 6.1: B2B REST API v1
 * Framework: Vitest (unit tests for pure functions)
 */

import { describe, it, expect, vi } from 'vitest';
import { hashApiKey, getApiKeyPrefix, hasScope, generateApiKey } from '@/server/auth/b2b/api-key-auth';

describe('B2B API Key Authentication', () => {
  
  describe('hashApiKey', () => {
    it('should return consistent hash for same input', () => {
      const apiKey = 'test-api-key';
      const hash1 = hashApiKey(apiKey);
      const hash2 = hashApiKey(apiKey);
      expect(hash1).toBe(hash2);
    });

    it('should return different hash for different inputs', () => {
      const hash1 = hashApiKey('api-key-1');
      const hash2 = hashApiKey('api-key-2');
      expect(hash1).not.toBe(hash2);
    });

    it('should return 64 character hex string', () => {
      const hash = hashApiKey('test-key');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('getApiKeyPrefix', () => {
    it('should return first 8 characters', () => {
      const apiKey = 'b2b_ABCDEFGHIJKLMNOP';
      const prefix = getApiKeyPrefix(apiKey);
      expect(prefix).toBe('b2b_ABCD');
    });

    it('should handle short keys', () => {
      const apiKey = 'short';
      const prefix = getApiKeyPrefix(apiKey);
      expect(prefix).toBe('short');
    });
  });

  describe('hasScope', () => {
    it('should return true when client has required scope', () => {
      const client = {
        id: '1',
        name: 'Test',
        scopes: ['decisions:read', 'runs:read'],
        rateLimit: 100,
        isActive: true,
      };
      expect(hasScope(client, 'decisions:read')).toBe(true);
    });

    it('should return false when client lacks required scope', () => {
      const client = {
        id: '1',
        name: 'Test',
        scopes: ['runs:read'],
        rateLimit: 100,
        isActive: true,
      };
      expect(hasScope(client, 'decisions:read')).toBe(false);
    });

    it('should return true when client has no scopes (allows all)', () => {
      const client = {
        id: '1',
        name: 'Test',
        scopes: [],
        rateLimit: 100,
        isActive: true,
      };
      expect(hasScope(client, 'any:scope')).toBe(true);
    });

    it('should return false for null client', () => {
      expect(hasScope(null, 'decisions:read')).toBe(false);
    });
  });

  describe('generateApiKey', () => {
    it('should generate key with b2b_ prefix', () => {
      const key = generateApiKey();
      expect(key.startsWith('b2b_')).toBe(true);
    });

    it('should generate 36 character key', () => {
      const key = generateApiKey();
      expect(key.length).toBe(36);
    });

    it('should generate unique keys', () => {
      const key1 = generateApiKey();
      const key2 = generateApiKey();
      expect(key1).not.toBe(key2);
    });
  });
});
