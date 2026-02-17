/**
 * B2B API - GET /profiles/:id, PUT /profiles/:id, DELETE /profiles/:id
 * 
 * Story 6.3: Creer le systeme de profils policy configurables B2B
 * Subtask 1.4: Implementer PUT /profiles/:id - modifier un profil
 * Subtask 1.5: Implementer DELETE /profiles/:id - supprimer un profil
 */

import { NextRequest, NextResponse } from 'next/server';
import { withB2BAuth, createErrorResponse, requireScope } from '../../_base';
import { validateUpdateProfileRequest } from '../../schemas';
import { 
  getProfileByIdForApiKey, 
  updateProfile,
  deleteProfile 
} from '@/server/db/repositories/b2b-profiles-repository';
import { validateProfileConfig as governanceValidate } from '@/server/policy/b2b-profile-validator';

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
 * GET /api/v1/b2b/profiles/:id
 * Get a specific profile by ID
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
    
    // Get profile for this API key (tenant)
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
    
    return NextResponse.json({
      data: profile,
      meta: {
        traceId,
        timestamp,
      },
    });
  });
}

/**
 * PUT /api/v1/b2b/profiles/:id
 * Update a specific profile
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  return withB2BAuth(request, async (client, traceId, timestamp) => {
    const scopeError = requireScope(client, 'profiles:write', traceId, timestamp);
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
    
    // Validate request - accept optional reason for audit
    const { reason, ...profileData } = body;
    let profileDataValid;
    try {
      profileDataValid = validateUpdateProfileRequest(profileData);
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
    
    // If any threshold values are being updated, validate against governance rules
    const hasThresholdChanges = 
      profileData.confidenceMin !== undefined ||
      profileData.edgeMin !== undefined ||
      profileData.maxDriftScore !== undefined;
    
    if (hasThresholdChanges) {
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
    }
    
    // Update the profile
    try {
      const profile = await updateProfile(
        profileId,
        client.id,
        {
          name: profileDataValid.name,
          description: profileDataValid.description,
          confidenceMin: profileDataValid.confidenceMin,
          edgeMin: profileDataValid.edgeMin,
          maxDriftScore: profileDataValid.maxDriftScore,
          isDefault: profileDataValid.isDefault,
          isActive: profileDataValid.isActive,
          changedBy: client.name || client.id, // Use client name or ID for audit
          reason: reason || undefined, // Optional reason for audit trail
        },
        traceId
      );
      
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
      
      return NextResponse.json({
        data: profile,
        meta: {
          traceId,
          timestamp,
        },
      });
    } catch (error: unknown) {
      console.error('[B2B Profiles] Error updating profile:', error);
      
      return NextResponse.json(
        createErrorResponse(
          'INTERNAL_ERROR',
          'Failed to update profile',
          traceId,
          timestamp,
          error instanceof Error ? error.message : undefined
        ),
        { status: 500 }
      );
    }
  });
}

/**
 * DELETE /api/v1/b2b/profiles/:id
 * Delete (soft delete) a specific profile
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  return withB2BAuth(request, async (client, traceId, timestamp) => {
    const scopeError = requireScope(client, 'profiles:write', traceId, timestamp);
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
    
    // Parse request body for optional reason
    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body?.reason;
    } catch {
      // Body is optional for DELETE
    }
    
    // Delete the profile (soft delete)
    try {
      const deleted = await deleteProfile(
        profileId,
        client.id,
        client.name || client.id, // Use client name or ID for audit
        traceId,
        reason
      );
      
      if (!deleted) {
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
      
      // Return 204 No Content on successful deletion
      return new NextResponse(null, {
        status: 204,
      });
    } catch (error: unknown) {
      console.error('[B2B Profiles] Error deleting profile:', error);
      
      return NextResponse.json(
        createErrorResponse(
          'INTERNAL_ERROR',
          'Failed to delete profile',
          traceId,
          timestamp,
          error instanceof Error ? error.message : undefined
        ),
        { status: 500 }
      );
    }
  });
}
