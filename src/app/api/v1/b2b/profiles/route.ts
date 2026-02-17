/**
 * B2B API - GET /profiles (List) & POST /profiles (Create)
 * 
 * Story 6.3: Creer le systeme de profils policy configurables B2B
 * Subtask 1.2: Implementer GET /profiles - liste des profils
 * Subtask 1.3: Implementer POST /profiles - creer un profil
 */

import { NextRequest, NextResponse } from 'next/server';
import { withB2BAuth, createErrorResponse, requireScope } from '../_base';
import { 
  validateProfilePagination, 
  validateCreateProfileRequest
} from '../schemas';
import { 
  getProfilesByApiKeyId, 
  createProfile 
} from '@/server/db/repositories/b2b-profiles-repository';
import { validateProfileConfig as governanceValidate } from '@/server/policy/b2b-profile-validator';

/**
 * GET /api/v1/b2b/profiles
 * List all profiles for the authenticated B2B client
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  return withB2BAuth(request, async (client, traceId, timestamp) => {
    const scopeError = requireScope(client, 'profiles:read', traceId, timestamp);
    if (scopeError) return scopeError;

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
    
    // Get profiles for this API key (tenant)
    const { profiles, total } = await getProfilesByApiKeyId(
      client.id,
      {
        page: pagination.page,
        limit: pagination.limit,
        includeInactive: false,
      }
    );
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(total / pagination.limit);
    
    return NextResponse.json({
      data: profiles,
      meta: {
        traceId,
        timestamp,
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
        count: profiles.length,
      },
    });
  });
}

/**
 * POST /api/v1/b2b/profiles
 * Create a new profile for the authenticated B2B client
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  return withB2BAuth(request, async (client, traceId, timestamp) => {
    const scopeError = requireScope(client, 'profiles:write', traceId, timestamp);
    if (scopeError) return scopeError;

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        createErrorResponse(
          'VALIDATION_ERROR',
          'Invalid JSON body',
          traceId,
          timestamp
        ),
        { status: 400 }
      );
    }
    
    // Validate request
    let profileData;
    try {
      profileData = validateCreateProfileRequest(body);
    } catch (error: unknown) {
      return NextResponse.json(
        createErrorResponse(
          'VALIDATION_ERROR',
          'Invalid profile data',
          traceId,
          timestamp,
          error instanceof Error ? error.message : undefined
        ),
        { status: 400 }
      );
    }
    
    // Validate against governance rules (hard-stop boundaries)
    const governanceValidation = governanceValidate({
      confidenceMin: profileData.confidenceMin,
      edgeMin: profileData.edgeMin,
      maxDriftScore: profileData.maxDriftScore,
    });
    
    if (!governanceValidation.valid) {
      return NextResponse.json(
        createErrorResponse(
          'GOVERNANCE_VIOLATION',
          'Profile configuration violates platform hard-stop boundaries',
          traceId,
          timestamp,
          {
            errors: governanceValidation.errors,
            boundaries: {
              confidence: { min: 0.65, max: 0.95 },
              edge: { min: 0.05, max: 0.50 },
              drift: { min: 0.0, max: 0.30 },
            },
          }
        ),
        { status: 422 }
      );
    }
    
    // Create the profile
    try {
      const profile = await createProfile(
        client.id,
        {
          name: profileData.name,
          description: profileData.description,
          confidenceMin: profileData.confidenceMin,
          edgeMin: profileData.edgeMin,
          maxDriftScore: profileData.maxDriftScore,
          isDefault: profileData.isDefault,
        },
        traceId
      );
      
      return NextResponse.json({
        data: profile,
        meta: {
          traceId,
          timestamp,
        },
      }, { status: 201 });
    } catch (error: unknown) {
      console.error('[B2B Profiles] Error creating profile:', error);
      
      return NextResponse.json(
        createErrorResponse(
          'INTERNAL_ERROR',
          'Failed to create profile',
          traceId,
          timestamp,
          error instanceof Error ? error.message : undefined
        ),
        { status: 500 }
      );
    }
  });
}
