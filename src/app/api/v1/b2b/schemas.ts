/**
 * B2B API Request Validation Schemas
 * 
 * Zod schemas for validating B2B API requests.
 * 
 * Story 6.1: B2B REST API v1
 */

import { z } from 'zod';

/**
 * Decision status enum
 */
export const decisionStatusSchema = z.enum(['Pick', 'No-Bet', 'Hard-Stop']);

/**
 * Pagination params schema
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Decision list query params schema
 */
export const decisionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: decisionStatusSchema.optional(),
  matchId: z.string().optional(),
}).refine(
  (data) => {
    // If both dates provided, fromDate must be before toDate
    if (data.fromDate && data.toDate) {
      return new Date(data.fromDate) <= new Date(data.toDate);
    }
    return true;
  },
  {
    message: "fromDate must be before or equal to toDate",
  }
);

/**
 * Runs query params schema
 */
export const runsQuerySchema = paginationSchema;

/**
 * Decision ID lookup schema
 */
export const decisionLookupSchema = z.object({
  lookup: z.enum(['id', 'traceId']).optional().default('id'),
});

/**
 * Types inferred from schemas
 */
export type DecisionStatus = z.infer<typeof decisionStatusSchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;
export type DecisionsQuery = z.infer<typeof decisionsQuerySchema>;
export type RunsQuery = z.infer<typeof runsQuerySchema>;
export type DecisionLookup = z.infer<typeof decisionLookupSchema>;

/**
 * Validate decisions query params
 */
export function validateDecisionsQuery(params: unknown): DecisionsQuery {
  return decisionsQuerySchema.parse(params);
}

/**
 * Validate runs query params
 */
export function validateRunsQuery(params: unknown): RunsQuery {
  return runsQuerySchema.parse(params);
}

/**
 * Validate decision lookup
 */
export function validateDecisionLookup(params: unknown): DecisionLookup {
  return decisionLookupSchema.parse(params);
}

// =============================================================================
// Explain Endpoint Schemas (Story 6.2)
// =============================================================================

/**
 * Gate outcome schema
 */
export const gateOutcomeSchema = z.object({
  gateName: z.string(),
  passed: z.boolean(),
  reason: z.string(),
});

/**
 * Data signals schema
 */
export const dataSignalsSchema = z.record(z.unknown());

/**
 * Match info schema
 */
export const matchInfoSchema = z.object({
  homeTeam: z.string(),
  awayTeam: z.string(),
  startTime: z.string(),
});

/**
 * Decision explanation response schema
 */
export const decisionExplanationSchema = z.object({
  id: z.string(),
  traceId: z.string(),
  matchId: z.string(),
  matchInfo: matchInfoSchema,
  status: decisionStatusSchema,
  gateOutcomes: z.array(gateOutcomeSchema),
  confidence: z.number(),
  edge: z.number(),
  dataSignals: dataSignalsSchema,
  explanation: z.string(),
  createdAt: z.string(),
});

/**
 * Success response wrapper for explain endpoint
 */
export const explainSuccessResponseSchema = z.object({
  data: decisionExplanationSchema,
  meta: z.object({
    traceId: z.string(),
    timestamp: z.string(),
  }),
});

/**
 * Error response wrapper for explain endpoint
 */
export const explainErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  meta: z.object({
    traceId: z.string(),
    timestamp: z.string(),
  }),
});

/**
 * Types inferred from explain schemas
 */
export type GateOutcome = z.infer<typeof gateOutcomeSchema>;
export type DataSignals = z.infer<typeof dataSignalsSchema>;
export type MatchInfo = z.infer<typeof matchInfoSchema>;
export type DecisionExplanation = z.infer<typeof decisionExplanationSchema>;
export type ExplainSuccessResponse = z.infer<typeof explainSuccessResponseSchema>;
export type ExplainErrorResponse = z.infer<typeof explainErrorResponseSchema>;

// =============================================================================
// Profile Endpoint Schemas (Story 6.3)
// =============================================================================

/**
 * Policy profile configuration schema
 */
export const b2bProfileConfigSchema = z.object({
  confidenceMin: z.number().min(0).max(1).default(0.65),
  edgeMin: z.number().min(0).max(1).default(0.05),
  maxDriftScore: z.number().min(0).max(1).default(0.15),
});

/**
 * Create profile request schema
 */
export const createProfileSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  confidenceMin: z.number().min(0).max(1).default(0.65),
  edgeMin: z.number().min(0).max(1).default(0.05),
  maxDriftScore: z.number().min(0).max(1).default(0.15),
  isDefault: z.boolean().default(false),
});

/**
 * Update profile request schema
 */
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  confidenceMin: z.number().min(0).max(1).optional(),
  edgeMin: z.number().min(0).max(1).optional(),
  maxDriftScore: z.number().min(0).max(1).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Profile response schema
 */
export const b2bProfileResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  confidenceMin: z.number(),
  edgeMin: z.number(),
  maxDriftScore: z.number(),
  isActive: z.boolean(),
  isDefault: z.boolean(),
  apiKeyId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string().nullable(),
});

/**
 * Profile history entry schema
 */
export const b2bProfileHistorySchema = z.object({
  id: z.string(),
  profileId: z.string(),
  action: z.string(),
  changedBy: z.string().nullable(),
  reason: z.string().nullable(),
  oldValue: z.unknown().nullable(),
  newValue: z.unknown().nullable(),
  traceId: z.string(),
  createdAt: z.string(),
});

/**
 * Pagination for profiles
 */
export const profilePaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Types inferred from profile schemas
 */
export type B2BProfileConfig = z.infer<typeof b2bProfileConfigSchema>;
export type CreateProfileRequest = z.infer<typeof createProfileSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
export type B2BProfileResponse = z.infer<typeof b2bProfileResponseSchema>;
export type B2BProfileHistoryEntry = z.infer<typeof b2bProfileHistorySchema>;
export type ProfilePaginationParams = z.infer<typeof profilePaginationSchema>;

/**
 * Validate create profile request
 */
export function validateCreateProfileRequest(params: unknown): CreateProfileRequest {
  return createProfileSchema.parse(params);
}

/**
 * Validate update profile request
 */
export function validateUpdateProfileRequest(params: unknown): UpdateProfileRequest {
  return updateProfileSchema.parse(params);
}

/**
 * Validate profile pagination
 */
export function validateProfilePagination(params: unknown): ProfilePaginationParams {
  return profilePaginationSchema.parse(params);
}
