/**
 * OpenAPI JSON Endpoint
 * 
 * Serves the OpenAPI specification as JSON.
 * GET /api/v1/b2b/openapi
 * 
 * Story 6.4: Implementer la documentation API OpenAPI et exemples
 */

import { NextResponse } from 'next/server';
import { generateOpenAPISpec } from '@/server/docs/openapi-generator';

/**
 * GET /api/v1/b2b/openapi
 * 
 * Returns the OpenAPI specification in JSON format.
 * No authentication required - this is public documentation.
 */
export async function GET() {
  try {
    const spec = generateOpenAPISpec();
    
    return NextResponse.json(spec, {
      headers: {
        'Content-Type': 'application/vnd.openapi+json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch (error) {
    console.error('[B2B OpenAPI] Error generating spec:', error);
    
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to generate OpenAPI specification',
        },
        meta: {
          traceId: `openapi-${Date.now()}`,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
