import { NextResponse } from 'next/server';
import { createIngestionService } from '@/server/ingestion';

/**
 * GET /api/ingestion/health
 * Get health status of all data providers
 */
export async function GET() {
  const traceId = `health-api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    const service = createIngestionService();
    const health = await service.getHealthStatus();
    
    // Determine overall status
    const healthyCount = health.filter(h => h.healthy).length;
    const totalCount = health.length;
    
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalCount) {
      status = 'healthy';
    } else if (healthyCount === 0) {
      status = 'unhealthy';
    } else {
      status = 'degraded';
    }

    const httpStatus = status === 'unhealthy' ? 503 : 200;

    return NextResponse.json(
      {
        status,
        providers: health.reduce((acc, h) => {
          acc[h.name] = {
            healthy: h.healthy,
            latency: h.latency,
          };
          return acc;
        }, {} as Record<string, { healthy: boolean; latency: number }>),
        summary: {
          total: totalCount,
          healthy: healthyCount,
          degraded: totalCount - healthyCount,
        },
        traceId,
        duration: Date.now() - startTime,
      },
      {
        status: httpStatus,
        headers: {
          'X-Trace-Id': traceId,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: message,
        traceId,
      },
      {
        status: 503,
        headers: {
          'X-Trace-Id': traceId,
        },
      }
    );
  }
}
