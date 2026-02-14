/**
 * E2E Test Helpers - Run Daily Pipeline
 * Pipeline trigger helper for daily run E2E tests
 *
 * Story: 2.10 - Implementer les tests E2E du pipeline daily run
 */

import { PrismaClient } from '@prisma/client';
import { APIRequestContext } from '@playwright/test';

export interface DailyRunResult {
  runId: string;
  traceId: string;
  status: 'completed' | 'failed' | 'partial';
  decisionsCreated: number;
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
}

export interface PipelineStageResult {
  stage: string;
  status: 'success' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

/**
 * Trigger daily run pipeline via API
 * Note: Requires authentication - use authenticated request context
 */
export async function triggerDailyRun(
  request: APIRequestContext,
  baseUrl: string,
  options: {
    date?: string;
    force?: boolean;
    dryRun?: boolean;
  } = {}
): Promise<DailyRunResult> {
  const date = options.date || new Date().toISOString().split('T')[0];
  
  // FIXED: Use correct API v1 endpoint path
  const response = await request.post(`${baseUrl}/api/v1/runs/trigger`, {
    data: {
      date,
      force: options.force || false,
      dryRun: options.dryRun || false,
    },
  });

  if (!response.ok()) {
    const error = await response.text();
    throw new Error(`Failed to trigger daily run: ${response.status()} - ${error}`);
  }

  const result = await response.json();
  
  return {
    runId: result.runId,
    traceId: result.traceId,
    status: result.status,
    // FIXED: Calculate total decisions from available fields
    decisionsCreated: (result.picksCount || 0) + (result.noBetCount || 0) + (result.hardStopCount || 0),
    errors: result.errors || [],
    startedAt: new Date(result.startedAt),
    completedAt: result.completedAt ? new Date(result.completedAt) : undefined,
  };
}

/**
 * Wait for daily run to complete
 * Polls the run status endpoint until completion or timeout
 */
export async function waitForDailyRun(
  request: APIRequestContext,
  baseUrl: string,
  runId: string,
  options: {
    timeout?: number;
    pollInterval?: number;
  } = {}
): Promise<DailyRunResult> {
  const timeout = options.timeout || 30000; // 30 seconds
  const pollInterval = options.pollInterval || 1000; // 1 second
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // FIXED: Use correct API v1 endpoint
    const response = await request.get(`${baseUrl}/api/v1/runs/${runId}`);
    
    if (!response.ok()) {
      throw new Error(`Failed to get run status: ${response.status()}`);
    }

    const result = await response.json();
    
    if (result.status === 'completed' || result.status === 'failed') {
      return {
        runId: result.id,
        traceId: result.traceId,
        status: result.status,
        // FIXED: Calculate total from available fields
        decisionsCreated: (result.picksCount || 0) + (result.noBetCount || 0) + (result.hardStopCount || 0),
        errors: result.errors || [],
        startedAt: new Date(result.startedAt),
        completedAt: result.completedAt ? new Date(result.completedAt) : undefined,
      };
    }

    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  throw new Error(`Daily run ${runId} did not complete within ${timeout}ms`);
}

/**
 * Get pipeline stages status
 * NOTE: This endpoint may not exist - returns empty array if 404
 */
export async function getPipelineStages(
  request: APIRequestContext,
  baseUrl: string,
  runId: string
): Promise<PipelineStageResult[]> {
  // FIXED: Try v1 endpoint first, fallback to empty array if not available
  const response = await request.get(`${baseUrl}/api/v1/runs/${runId}/stages`);
  
  if (response.status() === 404) {
    // Endpoint not implemented - derive stages from run status
    return [];
  }
  
  if (!response.ok()) {
    throw new Error(`Failed to get pipeline stages: ${response.status()}`);
  }

  const result = await response.json();
  return result.stages || [];
}

/**
 * Validate pipeline stages completed successfully
 */
export function validatePipelineStages(
  stages: PipelineStageResult[],
  expectedStages: string[]
): { isValid: boolean; missingStages: string[]; failedStages: string[] } {
  const stageNames = stages.map(s => s.stage);
  const missingStages = expectedStages.filter(s => !stageNames.includes(s));
  const failedStages = stages
    .filter(s => s.status === 'failed')
    .map(s => s.stage);

  return {
    isValid: missingStages.length === 0 && failedStages.length === 0,
    missingStages,
    failedStages,
  };
}

/**
 * Expected pipeline stages in order
 */
export const EXPECTED_PIPELINE_STAGES = [
  'ingestion',
  'validation',
  'ml_inference',
  'policy_evaluation',
  'decision_publication',
  'history_storage',
];

/**
 * Validate traceId propagation through pipeline
 */
export async function validateTracePropagation(
  prisma: PrismaClient,
  runId: string,
  expectedTraceId: string
): Promise<{
  isValid: boolean;
  runTraceId: string | null;
  decisionTraceIds: string[];
  errors: string[];
}> {
  const errors: string[] = [];
  
  // Get run traceId
  const run = await prisma.dailyRun?.findUnique?.({
    where: { id: runId },
    select: { traceId: true },
  });

  const runTraceId = run?.traceId || null;
  
  if (runTraceId !== expectedTraceId) {
    errors.push(`Run traceId mismatch: expected ${expectedTraceId}, got ${runTraceId}`);
  }

  // Get decision traceIds from PolicyDecision model
  const decisions = await prisma.policyDecision?.findMany?.({
    where: { runId },
    select: { traceId: true },
  }) || [];

  const decisionTraceIds = decisions.map(d => d.traceId);
  
  // Validate all decisions have the same traceId
  const mismatchedTraces = decisionTraceIds.filter(t => t !== expectedTraceId);
  if (mismatchedTraces.length > 0) {
    errors.push(`${mismatchedTraces.length} decisions have mismatched traceId`);
  }

  return {
    isValid: errors.length === 0,
    runTraceId,
    decisionTraceIds,
    errors,
  };
}

/**
 * Complete pipeline execution helper
 * Triggers run and waits for completion
 */
export async function executeDailyRun(
  request: APIRequestContext,
  baseUrl: string,
  prisma: PrismaClient,
  options: {
    date?: string;
    force?: boolean;
    timeout?: number;
  } = {}
): Promise<{
  result: DailyRunResult;
  stages: PipelineStageResult[];
  traceValidation: {
    isValid: boolean;
    runTraceId: string | null;
    decisionTraceIds: string[];
    errors: string[];
  };
}> {
  // Trigger the run
  const result = await triggerDailyRun(request, baseUrl, {
    date: options.date,
    force: options.force,
  });

  // Wait for completion
  const completedResult = await waitForDailyRun(request, baseUrl, result.runId, {
    timeout: options.timeout,
  });

  // Get pipeline stages
  const stages = await getPipelineStages(request, baseUrl, result.runId);

  // Validate trace propagation
  const traceValidation = await validateTracePropagation(
    prisma,
    result.runId,
    result.traceId
  );

  return {
    result: completedResult,
    stages,
    traceValidation,
  };
}
