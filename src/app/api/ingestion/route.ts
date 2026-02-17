import { NextRequest, NextResponse } from 'next/server';
import { createIngestionService } from '@/server/ingestion';

/**
 * POST /api/ingestion
 * Trigger data ingestion from providers
 */
export async function POST(request: NextRequest) {
  const traceId = `ingestion-api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    const body = await request.json();
    const { provider, all = false } = body;

    const service = createIngestionService();

    if (all) {
      // Ingest from all enabled providers
      const result = await service.ingestFromAll();
      
      return NextResponse.json(
        {
          success: result.success,
          data: result.data,
          summary: result.summary,
          byProvider: result.byProvider,
          traceId,
          duration: Date.now() - startTime,
        },
        {
          status: result.success ? 200 : 207, // Multi-status if some failed
          headers: {
            'X-Trace-Id': traceId,
          },
        }
      );
    } else if (provider) {
      // Ingest from specific provider
      const result = await service.ingestFromProvider(provider);

      return NextResponse.json(
        {
          success: result.success,
          data: result.data,
          errors: result.errors,
          metadata: result.metadata,
          traceId,
        },
        {
          status: result.success ? 200 : 500,
          headers: {
            'X-Trace-Id': traceId,
          },
        }
      );
    } else {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Must specify either "provider" or "all: true"',
          traceId,
        },
        {
          status: 400,
          headers: {
            'X-Trace-Id': traceId,
          },
        }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message,
        traceId,
      },
      {
        status: 500,
        headers: {
          'X-Trace-Id': traceId,
        },
      }
    );
  }
}

/**
 * GET /api/ingestion
 * Get ingestion configuration and status
 */
export async function GET() {
  const traceId = `ingestion-api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    const service = createIngestionService();
    const health = await service.getHealthStatus();
    
    return NextResponse.json(
      {
        status: 'ok',
        providers: health,
        traceId,
      },
      {
        headers: {
          'X-Trace-Id': traceId,
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message,
        traceId,
      },
      {
        status: 500,
        headers: {
          'X-Trace-Id': traceId,
        },
      }
    );
  }
}
