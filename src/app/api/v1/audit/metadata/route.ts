/**
 * Audit Metadata Query API
 * 
 * Story 4.5: Implémenter les métadonnées d'audit exploitables
 * API endpoint for querying audit metadata with filters and pagination.
 * 
 * Per architecture:
 * - API Response Format: { "data": ..., "meta": { "traceId": "...", "timestamp": "..." } }
 * - Error Format: { "error": { "code": "...", "message": "...", "details": ... }, "meta": {...} }
 * - DB/API Naming: snake_case DB, camelCase API
 * - Date/Time: ISO 8601 UTC
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/auth-options';
import { prisma } from '@/server/db/client';
import { generateTraceId } from '@/server/auth/rbac';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import type { AuditMetadataResponse, AuditMetadataResult } from '@/server/audit/types';
import { DataSourceFingerprintsSchema } from '@/server/audit/types';

function parseDateParam(value?: string): Date | null {
  if (!value) return null;
  const asDate = new Date(value);
  return Number.isNaN(asDate.getTime()) ? null : asDate;
}

/**
 * Query parameters schema
 */
const querySchema = z.object({
  traceId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  status: z.enum(['PICK', 'NO_BET', 'HARD_STOP']).optional(),
  userId: z.string().optional(),
  source: z.string().optional(),
  includeSynthetic: z.enum(['true', 'false']).optional().default('false'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * GET /api/v1/audit/metadata
 * Query audit metadata with filters
 */
export async function GET(request: NextRequest) {
  const traceId = generateTraceId();
  const timestamp = new Date().toISOString();
  
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
        meta: { traceId, timestamp },
      }, { status: 401 });
    }
    
    // Check authorization - require support, ops, or admin role
    const userRole = session.user.role || 'user';
    const allowedRoles = ['support', 'ops', 'admin'];
    
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions. Support, Ops, or Admin role required.',
        },
        meta: { traceId, timestamp },
      }, { status: 403 });
    }
    
    // Parse and validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const parseResult = querySchema.safeParse({
      traceId: searchParams.get('traceId'),
      fromDate: searchParams.get('fromDate'),
      toDate: searchParams.get('toDate'),
      status: searchParams.get('status'),
      userId: searchParams.get('userId'),
      source: searchParams.get('source'),
      page: searchParams.get('page'),
      limit: searchParams.get('limit'),
    });
    
    if (!parseResult.success) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: parseResult.error.errors,
        },
        meta: { traceId, timestamp },
      }, { status: 400 });
    }
    
    const { traceId: queryTraceId, fromDate, toDate, status, userId, source, includeSynthetic, page, limit } = parseResult.data;

    const parsedFromDate = parseDateParam(fromDate);
    const parsedToDate = parseDateParam(toDate);

    if ((fromDate && !parsedFromDate) || (toDate && !parsedToDate)) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid date format for fromDate or toDate',
        },
        meta: { traceId, timestamp },
      }, { status: 400 });
    }
    
    // Build where clause
    const where: Prisma.PolicyDecisionWhereInput = {};
    
    if (queryTraceId) {
      where.traceId = queryTraceId;
    }
    
    if (parsedFromDate || parsedToDate) {
      where.executedAt = {};
      if (parsedFromDate) {
        where.executedAt.gte = parsedFromDate;
      }
      if (parsedToDate) {
        where.executedAt.lte = parsedToDate;
      }
    }
    
    if (status) {
      where.status = status;
    }
    
    if (userId) {
      where.userId = userId;
    }
    
    // Note: source filtering on JSON field uses PostgreSQL's JSONB containment operator
    // This performs filtering at the database level instead of in-memory
    if (source) {
      // Use JSONB containment to filter: data must contain an element where sourceName matches
      where.dataSourceFingerprints = {
        path: '$',
        array_contains: [{ sourceName: source }] as unknown as Prisma.JsonArray,
      } as Prisma.JsonFilter;
    }

    if (includeSynthetic !== 'true') {
      where.NOT = [
        {
          modelVersion: {
            startsWith: 'season-end-',
          },
        },
      ];
    }
    
    // Execute query with proper pagination
    const [results, total] = await Promise.all([
      prisma.policyDecision.findMany({
        where,
        orderBy: { executedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.policyDecision.count({ where }),
    ]);
    
    // Transform to audit metadata response
    const data: AuditMetadataResponse[] = results.map((decision) => {
      const parsedFingerprints = DataSourceFingerprintsSchema.safeParse(decision.dataSourceFingerprints || []);
      const normalizedFingerprints = parsedFingerprints.success ? parsedFingerprints.data : [];

      return {
        id: decision.id,
        traceId: decision.traceId,
        executedAt: decision.executedAt.toISOString(),
        modelVersion: decision.modelVersion,
        dataSourceFingerprints: normalizedFingerprints as unknown as AuditMetadataResponse['dataSourceFingerprints'],
        status: decision.status,
        matchId: decision.matchId,
        homeTeam: decision.homeTeam,
        awayTeam: decision.awayTeam,
        confidence: decision.confidence,
        rationale: decision.rationale,
      };
    });
    
    const response: AuditMetadataResult = {
      data,
      meta: {
        traceId,
        timestamp,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
    
    return NextResponse.json({
      data: response.data,
      meta: response.meta,
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Audit API] Error querying metadata: ${errorMessage}`);
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to query audit metadata',
        details: errorMessage,
      },
      meta: { traceId, timestamp },
    }, { status: 500 });
  }
}
