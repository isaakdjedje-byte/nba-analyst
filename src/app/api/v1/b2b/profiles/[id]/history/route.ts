/**
 * B2B API - GET /profiles/:id/history
 * 
 * Story 6.3: Creer le systeme de profils policy configurables B2B
 * Subtask 3.3: Implementer l'endpoint GET /profiles/:id/history
 */

import { NextRequest, NextResponse } from 'next/server';
import { withB2BAuth, createErrorResponse, requireScope } from '../../../_base';
import { validateProfilePagination } from '../../../schemas';
import { getProfileHistory, getProfileByIdForApiKey } from '@/server/db/repositories/b2b-profiles-repository';

/**
 * UUID v4 regex pattern
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate UUID format
 */
function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

/**
 * Extract profile ID from URL and validate
 */
function getProfileId(params: { id?: string }): string | null {
  const id = params.id ?? null;
  if (id && !isValidUUID(id)) {
    return null; // Invalid UUID format
  }
  return id;
}

/**
 * GET /api/v1/b2b/profiles/:id/history
 * Get audit history for a specific profile
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  return withB2BAuth(request, async (client, traceId, timestamp) => {
    const scopeError = requireScope(client, 'profiles:read', traceId, timestamp);
    if (scopeError) return scopeError;

    const resolvedParams = await params;
    const profileId = getProfileId(resolvedParams);
    
    if (!profileId) {
      return NextResponse.json(
        createErrorResponse(
          'VALIDATION_ERROR',
          resolvedParams.id ? 'Invalid profile ID format - must be a valid UUID' : 'Profile ID is required',
          traceId,
          timestamp
        ),
        { status: 400 }
      );
    }
    
    // First verify the profile exists and belongs to this client
    const profile = await getProfileByIdForApiKey(profileId, client.id);
    
    if (!profile) {
      return NextResponse.json(
        createErrorResponse(
          'NOT_FOUND',
          'Profile not found',
          traceId,
          timestamp
        ),
        { status: 404 }
      );
    }
    
    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryParams: Record<string, string | string[] | null> = {};
    
    for (const [key, value] of searchParams.entries()) {
      queryParams[key] = value;
    }
    
    let pagination;
    try {
      pagination = validateProfilePagination(queryParams);
    } catch (error: unknown) {
      return NextResponse.json(
        createErrorResponse(
          'VALIDATION_ERROR',
          'Invalid query parameters',
          traceId,
          timestamp,
          error instanceof Error ? error.message : undefined
        ),
        { status: 400 }
      );
    }
    
    // Get profile history for this API key (tenant)
    const { history, total } = await getProfileHistory(
      profileId,
      client.id,
      {
        page: pagination.page,
        limit: pagination.limit,
      }
    );
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(total / pagination.limit);
    
    return NextResponse.json({
      data: history,
      meta: {
        traceId,
        timestamp,
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
        count: history.length,
      },
    });
  });
}
