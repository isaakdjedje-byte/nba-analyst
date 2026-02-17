/**
 * Rate Limiting Middleware
 * Middleware function to apply rate limiting to Next.js API routes
 * 
 * Integration point: Next.js API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimitWithBoth, getRateLimitHeaders, getEndpointConfig } from './rate-limiter';

/**
 * Rate limiting middleware for Next.js API routes
 * 
 * Usage in API routes:
 * ```typescript
 * import { rateLimitMiddleware } from '@/server/cache/rate-limiter-middleware';
 * 
 * export async function GET(req: NextRequest) {
 *   const rateLimitResponse = await rateLimitMiddleware(req);
 *   if (rateLimitResponse) return rateLimitResponse;
 *   
 *   // ... your handler code
 * }
 * ```
 * 
 * Or use as Next.js middleware in middleware.ts:
 * ```typescript
 * import { rateLimitMiddleware } from '@/server/cache/rate-limiter-middleware';
 * 
 * export async function middleware(req: NextRequest) {
 *   // ... auth checks
 *   
 *   const rateLimitResponse = await rateLimitMiddleware(req);
 *   if (rateLimitResponse) return rateLimitResponse;
 * }
 * ```
 */
export async function rateLimitMiddleware(
  req: NextRequest
): Promise<NextResponse | null> {
  // Get endpoint from the request
  const endpoint = req.nextUrl.pathname;
  
  // Skip rate limiting for non-API routes
  if (!endpoint.startsWith('/api/')) {
    return null;
  }

  // Skip health checks and other internal endpoints
  if (endpoint.includes('/health') || endpoint.includes('/_next')) {
    return null;
  }

  // Extract user ID from session (if authenticated)
  // Note: This depends on your auth implementation
  const userId = req.headers.get('x-user-id') || undefined;
  
  // Extract client IP
  const ip = getClientIP(req);
  
  // Get rate limit configuration for this endpoint
  getEndpointConfig(endpoint);
  
  // Check rate limit
  const result = await checkRateLimitWithBoth(endpoint, userId, ip);
  
  // If rate limit exceeded, return 429 response
  if (!result.success) {
    const headers = getRateLimitHeaders(result);
    const response = NextResponse.json(
      {
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
        code: 'RATE_LIMIT_EXCEEDED',
      },
      {
        status: 429,
        headers: {
          ...headers,
          'Retry-After': String(result.retryAfter || 60),
        },
      }
    );
    return response;
  }

  // Rate limit passed - return headers for the handler to use
  return null;
}

/**
 * Get client IP address from request
 * Handles proxies and load balancers
 */
export function getClientIP(req: NextRequest): string {
  // Check for forwarded header (when behind proxy)
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  // Check for real IP header
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  
  // Fallback to remote address
  return 'unknown';
}
