/**
 * B2B API Key Authentication
 * 
 * Provides API key-based authentication for B2B clients.
 * Keys are stored as SHA-256 hashes in the database.
 * 
 * Story 6.1: B2B REST API v1
 */

import { prisma } from '@/server/db/client';
import { createHash, randomBytes } from 'crypto';

// Type for authenticated B2B client
export interface B2BClient {
  id: string;
  name: string;
  scopes: string[];
  rateLimit: number;
  isActive: boolean;
}

/**
 * Hash an API key using SHA-256
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Get the prefix of an API key (first 8 characters for identification)
 */
export function getApiKeyPrefix(apiKey: string): string {
  return apiKey.substring(0, 8);
}

/**
 * Authenticate a B2B API key from request headers
 * 
 * @param apiKey - The API key from X-API-Key header
 * @returns B2BClient if valid, null if invalid
 */
export async function authenticateB2BApiKey(apiKey: string | null): Promise<B2BClient | null> {
  if (!apiKey) {
    return null;
  }

  const keyHash = hashApiKey(apiKey);

  const apiKeyRecord = await prisma.b2BApiKey.findUnique({
    where: { keyHash },
  });

  if (!apiKeyRecord) {
    return null;
  }

  // Check if key is active
  if (!apiKeyRecord.isActive) {
    return null;
  }

  // Check if key has expired
  if (apiKeyRecord.expiresAt && new Date() > apiKeyRecord.expiresAt) {
    return null;
  }

  // Update last used timestamp
  await prisma.b2BApiKey.update({
    where: { id: apiKeyRecord.id },
    data: { lastUsedAt: new Date() },
  });

  // Parse scopes from JSON
  let scopes: string[] = [];
  try {
    scopes = JSON.parse(apiKeyRecord.scopes);
  } catch {
    scopes = [];
  }

  return {
    id: apiKeyRecord.id,
    name: apiKeyRecord.name,
    scopes,
    rateLimit: apiKeyRecord.rateLimit,
    isActive: apiKeyRecord.isActive,
  };
}

/**
 * Check if a B2B client has a specific scope
 */
export function hasScope(client: B2BClient | null, requiredScope: string): boolean {
  if (!client) {
    return false;
  }
  
  // If no specific scopes required, allow all
  if (client.scopes.length === 0) {
    return true;
  }
  
  return client.scopes.includes(requiredScope);
}

/**
 * Generate a new API key (for admin use)
 */
export function generateApiKey(): string {
  return `b2b_${randomBytes(24).toString('base64url')}`;
}
