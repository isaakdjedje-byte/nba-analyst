/**
 * Redis Health Check API
 * Provides health status for Redis connection
 */

import { NextResponse } from 'next/server';
import { healthCheck } from '../../../../server/cache/redis-client';

export async function GET() {
  const result = await healthCheck();

  const statusCode = result.status === 'healthy' ? 200 : 503;

  return NextResponse.json(
    {
      service: 'redis',
      status: result.status,
      latency: result.latency,
      error: result.error,
      timestamp: new Date().toISOString(),
    },
    {
      status: statusCode,
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
      },
    }
  );
}
