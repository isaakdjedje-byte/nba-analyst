/**
 * B2B Policy Profile Repository
 * 
 * Database operations for B2B policy profiles.
 * 
 * Story 6.3: Creer le systeme de profils policy configurables B2B
 */

import { prisma } from '@/server/db/client';
import { 
  B2BProfileResponse, 
  B2BProfileHistoryEntry 
} from '@/app/api/v1/b2b/schemas';

/**
 * Transform database profile to API response format
 */
function transformProfile(profile: {
  id: string;
  name: string;
  description: string | null;
  confidenceMin: number;
  edgeMin: number;
  maxDriftScore: number;
  isActive: boolean;
  isDefault: boolean;
  apiKeyId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
}): B2BProfileResponse {
  return {
    id: profile.id,
    name: profile.name,
    description: profile.description,
    confidenceMin: profile.confidenceMin,
    edgeMin: profile.edgeMin,
    maxDriftScore: profile.maxDriftScore,
    isActive: profile.isActive,
    isDefault: profile.isDefault,
    apiKeyId: profile.apiKeyId,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    createdBy: profile.createdBy,
  };
}

/**
 * Transform database history entry to API response format
 */
function transformHistoryEntry(entry: {
  id: string;
  profileId: string;
  action: string;
  changedBy: string | null;
  reason: string | null;
  oldValue: unknown;
  newValue: unknown;
  traceId: string;
  createdAt: Date;
}): B2BProfileHistoryEntry {
  return {
    id: entry.id,
    profileId: entry.profileId,
    action: entry.action,
    changedBy: entry.changedBy,
    reason: entry.reason,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    traceId: entry.traceId,
    createdAt: entry.createdAt.toISOString(),
  };
}

/**
 * Get all profiles for an API key (tenant)
 */
export async function getProfilesByApiKeyId(
  apiKeyId: string,
  options?: { page?: number; limit?: number; includeInactive?: boolean }
): Promise<{ profiles: B2BProfileResponse[]; total: number }> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  const includeInactive = options?.includeInactive ?? false;
  
  const where = {
    apiKeyId,
    ...(includeInactive ? {} : { isActive: true }),
  };
  
  const [profiles, total] = await Promise.all([
    prisma.b2BPolicyProfile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.b2BPolicyProfile.count({ where }),
  ]);
  
  return {
    profiles: profiles.map(transformProfile),
    total,
  };
}

/**
 * Get a single profile by ID
 */
export async function getProfileById(profileId: string): Promise<B2BProfileResponse | null> {
  const profile = await prisma.b2BPolicyProfile.findUnique({
    where: { id: profileId },
  });
  
  return profile ? transformProfile(profile) : null;
}

/**
 * Get a single profile by ID for a specific API key
 */
export async function getProfileByIdForApiKey(
  profileId: string,
  apiKeyId: string
): Promise<B2BProfileResponse | null> {
  const profile = await prisma.b2BPolicyProfile.findFirst({
    where: { id: profileId, apiKeyId },
  });
  
  return profile ? transformProfile(profile) : null;
}

/**
 * Create a new profile
 */
export async function createProfile(
  apiKeyId: string,
  data: {
    name: string;
    description?: string;
    confidenceMin: number;
    edgeMin: number;
    maxDriftScore: number;
    isDefault: boolean;
    createdBy?: string;
  },
  traceId: string
): Promise<B2BProfileResponse> {
  // If this is set as default, unset any existing default
  if (data.isDefault) {
    await prisma.b2BPolicyProfile.updateMany({
      where: { apiKeyId, isDefault: true },
      data: { isDefault: false },
    });
  }
  
  // Create the profile
  const profile = await prisma.b2BPolicyProfile.create({
    data: {
      name: data.name,
      description: data.description,
      confidenceMin: data.confidenceMin,
      edgeMin: data.edgeMin,
      maxDriftScore: data.maxDriftScore,
      isDefault: data.isDefault,
      isActive: true,
      apiKeyId,
      createdBy: data.createdBy,
    },
  });
  
  // Create audit history entry
  await prisma.b2BPolicyProfileHistory.create({
    data: {
      profileId: profile.id,
      action: 'created',
      changedBy: data.createdBy,
      newValue: {
        name: data.name,
        description: data.description,
        confidenceMin: data.confidenceMin,
        edgeMin: data.edgeMin,
        maxDriftScore: data.maxDriftScore,
        isDefault: data.isDefault,
      },
      traceId,
    },
  });
  
  return transformProfile(profile);
}

/**
 * Update an existing profile
 */
export async function updateProfile(
  profileId: string,
  apiKeyId: string,
  data: {
    name?: string;
    description?: string;
    confidenceMin?: number;
    edgeMin?: number;
    maxDriftScore?: number;
    isDefault?: boolean;
    isActive?: boolean;
    changedBy?: string;
    reason?: string;
  },
  traceId: string
): Promise<B2BProfileResponse | null> {
  // Get current profile to compare
  const currentProfile = await prisma.b2BPolicyProfile.findFirst({
    where: { id: profileId, apiKeyId },
  });
  
  if (!currentProfile) {
    return null;
  }
  
  // If setting as default, unset any existing default
  if (data.isDefault) {
    await prisma.b2BPolicyProfile.updateMany({
      where: { apiKeyId, isDefault: true, NOT: { id: profileId } },
      data: { isDefault: false },
    });
  }
  
  // Build update data
  const updateData: Parameters<typeof prisma.b2BPolicyProfile.update>[0]['data'] = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.confidenceMin !== undefined) updateData.confidenceMin = data.confidenceMin;
  if (data.edgeMin !== undefined) updateData.edgeMin = data.edgeMin;
  if (data.maxDriftScore !== undefined) updateData.maxDriftScore = data.maxDriftScore;
  if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  
  // Update the profile
  const updatedProfile = await prisma.b2BPolicyProfile.update({
    where: { id: profileId },
    data: updateData,
  });
  
  // Create audit history entry
  await prisma.b2BPolicyProfileHistory.create({
    data: {
      profileId,
      action: 'updated',
      changedBy: data.changedBy,
      reason: data.reason || null,
      oldValue: {
        name: currentProfile.name,
        description: currentProfile.description,
        confidenceMin: currentProfile.confidenceMin,
        edgeMin: currentProfile.edgeMin,
        maxDriftScore: currentProfile.maxDriftScore,
        isDefault: currentProfile.isDefault,
        isActive: currentProfile.isActive,
      },
      newValue: {
        name: updatedProfile.name,
        description: updatedProfile.description,
        confidenceMin: updatedProfile.confidenceMin,
        edgeMin: updatedProfile.edgeMin,
        maxDriftScore: updatedProfile.maxDriftScore,
        isDefault: updatedProfile.isDefault,
        isActive: updatedProfile.isActive,
      },
      traceId,
    },
  });
  
  return transformProfile(updatedProfile);
}

/**
 * Delete a profile (soft delete)
 */
export async function deleteProfile(
  profileId: string,
  apiKeyId: string,
  changedBy?: string,
  traceId?: string,
  reason?: string
): Promise<boolean> {
  const profile = await prisma.b2BPolicyProfile.findFirst({
    where: { id: profileId, apiKeyId },
  });
  
  if (!profile) {
    return false;
  }
  
  // Soft delete - just mark as inactive
  await prisma.b2BPolicyProfile.update({
    where: { id: profileId },
    data: { isActive: false },
  });
  
  // Create audit history entry
  if (traceId) {
    await prisma.b2BPolicyProfileHistory.create({
      data: {
        profileId,
        action: 'deleted',
        changedBy,
        reason: reason || null,
        oldValue: {
          name: profile.name,
          isActive: profile.isActive,
        },
        newValue: {
          isActive: false,
        },
        traceId,
      },
    });
  }
  
  return true;
}

/**
 * Get profile history
 */
export async function getProfileHistory(
  profileId: string,
  apiKeyId: string,
  options?: { page?: number; limit?: number }
): Promise<{ history: B2BProfileHistoryEntry[]; total: number }> {
  const page = options?.page ?? 1;
  const limit = options?.limit ?? 20;
  
  // First verify the profile belongs to this API key
  const profile = await prisma.b2BPolicyProfile.findFirst({
    where: { id: profileId, apiKeyId },
  });
  
  if (!profile) {
    return { history: [], total: 0 };
  }
  
  const [history, total] = await Promise.all([
    prisma.b2BPolicyProfileHistory.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.b2BPolicyProfileHistory.count({ where: { profileId } }),
  ]);
  
  return {
    history: history.map(transformHistoryEntry),
    total,
  };
}
