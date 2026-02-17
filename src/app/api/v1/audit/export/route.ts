/**
 * Audit Export API
 * 
 * Story 4.5: Implémenter les métadonnées d'audit exploitables
 * API endpoint for exporting audit metadata in CSV or JSON format.
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
import { logAuditEvent } from '@/lib/utils/audit';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import type { AuditMetadataResponse } from '@/server/audit/types';

/**
 * Export parameters schema
 */
const exportSchema = z.object({
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional(),
  status: z.enum(['PICK', 'NO_BET', 'HARD_STOP']).optional(),
  userId: z.string().optional(),
  source: z.string().optional(),
  format: z.enum(['csv', 'json']).default('json'),
});

/**
 * GET /api/v1/audit/export
 * Export audit metadata in CSV or JSON format
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
    const parseResult = exportSchema.safeParse({
      fromDate: searchParams.get('fromDate'),
      toDate: searchParams.get('toDate'),
      status: searchParams.get('status'),
      userId: searchParams.get('userId'),
      source: searchParams.get('source'),
      format: searchParams.get('format') || 'json',
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
    
    const { fromDate, toDate, status, userId, source, format } = parseResult.data;
    
    // Build where clause
    const where: Prisma.PolicyDecisionWhereInput = {};
    
    if (fromDate || toDate) {
      where.executedAt = {};
      if (fromDate) {
        where.executedAt.gte = new Date(fromDate);
      }
      if (toDate) {
        where.executedAt.lte = new Date(toDate);
      }
    }
    
    if (status) {
      where.status = status;
    }
    
    if (userId) {
      where.userId = userId;
    }
    
    // Use PostgreSQL's JSONB containment operator for source filtering at DB level
    if (source) {
      where.dataSourceFingerprints = {
        path: '$',
        array_contains: [{ sourceName: source }] as unknown as Prisma.JsonArray,
      } as Prisma.JsonFilter;
    }
    
    // Get all matching results (no pagination for export)
    const results = await prisma.policyDecision.findMany({
      where,
      orderBy: { executedAt: 'desc' },
    });
    
    // Log the export action for audit (NFR10)
    // Get IP address from request headers
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : request.headers.get('x-real-ip') || undefined;
    
    await logAuditEvent({
      actorId: session.user.id,
      action: 'AUDIT_METADATA_EXPORTED',
      targetId: 'audit-export',
      targetType: 'REPORT',
      ipAddress,
      metadata: {
        format,
        recordCount: results.length,
        filters: { fromDate, toDate, status, userId, source },
      },
    }, traceId);
    
    // Transform to audit metadata response
    const data: AuditMetadataResponse[] = results.map((decision) => ({
      id: decision.id,
      traceId: decision.traceId,
      executedAt: decision.executedAt.toISOString(),
      modelVersion: decision.modelVersion,
      dataSourceFingerprints:
        (decision.dataSourceFingerprints || []) as unknown as AuditMetadataResponse['dataSourceFingerprints'],
      status: decision.status,
      matchId: decision.matchId,
      homeTeam: decision.homeTeam,
      awayTeam: decision.awayTeam,
      confidence: decision.confidence,
      rationale: decision.rationale,
    }));
    
    // Generate export based on format
    if (format === 'csv') {
      return generateCsvExport(data, traceId, timestamp);
    }
    
    // Default to JSON
    return NextResponse.json({
      data,
      meta: {
        traceId,
        timestamp,
        export: {
          format: 'json',
          recordCount: data.length,
          fromDate: fromDate || null,
          toDate: toDate || null,
        },
      },
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Audit API] Error exporting metadata: ${errorMessage}`);
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to export audit metadata',
        details: errorMessage,
      },
      meta: { traceId, timestamp },
    }, { status: 500 });
  }
}

/**
 * Generate CSV export
 */
function generateCsvExport(data: AuditMetadataResponse[], traceId: string, timestamp: string) {
  // CSV headers
  const headers = [
    'id',
    'traceId',
    'executedAt',
    'modelVersion',
    'status',
    'matchId',
    'homeTeam',
    'awayTeam',
    'confidence',
    'rationale',
    'dataSources',
    'sourceVersions',
    'sourceQualityScores',
  ];
  
  // CSV rows
  const rows = data.map(decision => [
    decision.id,
    decision.traceId,
    decision.executedAt,
    decision.modelVersion,
    decision.status,
    decision.matchId,
    decision.homeTeam,
    decision.awayTeam,
    decision.confidence.toString(),
    decision.rationale.replace(/,/g, ';'), // Escape commas
    decision.dataSourceFingerprints.map(f => f.sourceName).join(';'),
    decision.dataSourceFingerprints.map(f => f.sourceVersion).join(';'),
    decision.dataSourceFingerprints.map(f => f.qualityScore.toString()).join(';'),
  ]);
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(',')),
  ].join('\n');
  
  // Return as downloadable file
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-metadata-${timestamp.split('T')[0]}.csv"`,
      'X-Trace-Id': traceId,
    },
  });
}
