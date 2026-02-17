/**
 * B2B API Base Route Handler
 * 
 * Provides common functionality for all B2B API endpoints:
 * - API key authentication
 * - Response formatting with traceId
 * - Error handling
 * 
 * Story 6.1: B2B REST API v1
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateB2BApiKey, B2BClient } from '@/server/auth/b2b/api-key-auth';

/**
 * Generate a unique traceId for request tracking
 */
export function generateTraceId(): string {
  return `b2b-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get current timestamp in ISO 8601 UTC
 */
export function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Type for API response metadata
 */
export interface ApiResponseMeta {
  traceId: string;
  timestamp: string;
}

/**
 * Type for success API response
 */
export interface ApiSuccessResponse<T> {
  data: T;
  meta: ApiResponseMeta;
}

/**
 * Type for error response
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: ApiResponseMeta;
}

/**
 * Create a success response with proper format
 */
export function createSuccessResponse<T>(data: T, traceId: string, timestamp: string): ApiSuccessResponse<T> {
  return {
    data,
    meta: {
      traceId,
      timestamp,
    },
  };
}

/**
 * Create an error response with proper format
 */
export function createErrorResponse(
  code: string,
  message: string,
  traceId: string,
  timestamp: string,
  details?: unknown
): ApiErrorResponse {
  return {
    error: {
      code,
      message,
      details,
    },
    meta: {
      traceId,
      timestamp,
    },
  };
}

/**
 * Middleware for B2B API authentication
 * Use this in route handlers to protect endpoints
 */
export async function withB2BAuth(
  request: NextRequest,
  handler: (client: B2BClient, traceId: string, timestamp: string) => Promise<NextResponse>
): Promise<NextResponse> {
  const traceId = generateTraceId();
  const timestamp = getTimestamp();

  // Get API key from header
  const apiKey = request.headers.get('x-api-key');
  
  // Development mode: accept test key
  let client: B2BClient | null = null;
  
  const devApiKey = process.env.B2B_DEV_API_KEY;

  if (process.env.NODE_ENV === 'development' && devApiKey && apiKey === devApiKey) {
    // Allow test key in development
    client = {
      id: 'dev-client',
      name: 'Development Client',
      scopes: ['decisions:read', 'runs:read'],
      rateLimit: 1000,
      isActive: true,
    };
  } else {
    // Production: authenticate against database
    client = await authenticateB2BApiKey(apiKey);
  }

  // Check authentication
  if (!client) {
    return NextResponse.json(
      createErrorResponse('UNAUTHORIZED', 'Invalid or missing API key', traceId, timestamp),
      { status: 401 }
    );
  }

  // Check if client is active
  if (!client.isActive) {
    return NextResponse.json(
      createErrorResponse('UNAUTHORIZED', 'API key is inactive', traceId, timestamp),
      { status: 401 }
    );
  }

  // Execute the handler
  try {
    return await handler(client, traceId, timestamp);
  } catch (error) {
    console.error('[B2B API] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      createErrorResponse('INTERNAL_ERROR', 'An internal error occurred', traceId, timestamp, { error: errorMessage }),
      { status: 500 }
    );
  }
}

/**
 * Validate required scope for endpoint
 */
export function requireScope(client: B2BClient, scope: string, traceId: string, timestamp: string): NextResponse | null {
  // If no scopes configured, allow all
  if (client.scopes.length === 0) {
    return null;
  }
  
  if (!client.scopes.includes(scope)) {
    return NextResponse.json(
      createErrorResponse('FORBIDDEN', `Missing required scope: ${scope}`, traceId, timestamp),
      { status: 403 }
    );
  }
  
  return null;
}
