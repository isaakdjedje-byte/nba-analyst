/**
 * Daily Run Job - Hard Stop + Fallback Chain Integration
 * 
 * Processes predictions and generates policy decisions with:
 * - Hard-stop protection (Story 2.6)
 * - Fallback chain for data quality issues (Story 2.7)
 * 
 * CRITICAL: Hard-stop is the highest priority gate - must check BEFORE each decision.
 * CRITICAL: Fallback chain evaluates data quality and can force No-Bet when quality is insufficient.
 */

import { prisma } from '@/server/db/client';
import { PolicyEngine, DEFAULT_POLICY_CONFIG } from '@/server/policy/engine';
import { HardStopTracker, createHardStopTracker } from '@/server/policy/hardstop-tracker';
import { RunContext } from '@/server/policy/types';
import { sendAlert, createHardStopAlert } from '@/server/ingestion/alerting';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'pino';
import { Prisma } from '@prisma/client';

// Fallback chain imports (Story 2.7)
import {
  FallbackChain,
  FallbackChainConfig,
  createDataQualityGates,
  DataQualityAssessment,
  FallbackLevel,
  FallbackAttempt
} from '@/server/ml/orchestration';

// Story 4.5: Import data source fingerprints types
import type { DataSourceFingerprints } from '@/server/audit/types';

interface EvaluatedFallbackResult {
  finalLevel: FallbackLevel;
  wasForcedNoBet: boolean;
  fallbackAttempts?: FallbackAttempt[];
  decision: {
    rationale?: string;
    fallbackContext?: unknown;
  };
}

export interface DailyRunJobConfig {
  // Bankroll settings
  currentBankroll: number;
  
  // Hard-stop config (defaults from policy config)
  dailyLossLimit?: number;
  consecutiveLosses?: number;
  bankrollPercent?: number;
  
  // Stake amount for tracking exposure (used for daily loss calculation)
  // In production, this would come from user preferences or be calculated per-pick
  defaultStakeAmount?: number;
  
  // Story 4.5: Data source fingerprints for audit metadata
  dataSourceFingerprints?: DataSourceFingerprints;
}

export interface DailyRunJobResult {
  runId: string;
  status: 'completed' | 'hard_stop_blocked' | 'failed';
  totalPredictions: number;
  picksCount: number;
  noBetCount: number;
  hardStopCount: number;
  hardStopTriggered: boolean;
  hardStopReason?: string;
  errors: string[];
  // Fallback chain statistics (Story 2.7)
  fallbackStats?: {
    forcedNoBetCount: number;
    fallbackLevels: Record<FallbackLevel, number>;
    qualityAssessments: DataQualityAssessment[];
  };
}

/**
 * Process daily run with hard-stop protection
 * 
 * CRITICAL: Checks hard-stop BEFORE each decision publication.
 * If hard-stop activates mid-run, all pending decisions are blocked.
 */
export async function processDailyRun(
  runId: string,
  config: DailyRunJobConfig
): Promise<DailyRunJobResult> {
  const errors: string[] = [];
  const traceId = uuidv4();
  
  // Initialize hard-stop tracker
  const hardStopConfig = {
    dailyLossLimit: config.dailyLossLimit ?? DEFAULT_POLICY_CONFIG.hardStops.dailyLossLimit,
    consecutiveLosses: config.consecutiveLosses ?? DEFAULT_POLICY_CONFIG.hardStops.consecutiveLosses,
    bankrollPercent: config.bankrollPercent ?? DEFAULT_POLICY_CONFIG.hardStops.bankrollPercent,
  };
  
  const tracker = createHardStopTracker(hardStopConfig, prisma);
  
  // Initialize tracker (loads state from DB or creates initial state)
  await tracker.initialize();
  
  // ============================================
  // Fallback Chain Initialization (Story 2.7)
  // ============================================
  // Create a simple logger for fallback chain
  const logger: Logger = {
    debug: () => {},
    info: () => {},
    warn: console.warn,
    error: console.error,
    fatal: console.error,
    trace: () => {},
    child: () => logger,
    level: 'info',
    levels: [],
    silent: false,
  } as unknown as Logger;

  // Create data quality gates
  const dataQualityGates = createDataQualityGates({
    reliabilityThreshold: 0.5,
    minSourceAvailability: 0.7,
    minSchemaValidity: 0.7,
    minCompleteness: 0.8,
  }, logger);

  // Create mock model registry for fallback chain
  const mockModelRegistry = {
    getModel: async (modelId: string) => {
      const models: Record<string, { id: string; name: string; version: string }> = {
        'model-v2': { id: 'model-v2', name: 'Primary Model', version: '2.0' },
        'model-v1': { id: 'model-v1', name: 'Secondary Model', version: '1.0' },
        'model-baseline': { id: 'model-baseline', name: 'Baseline Model', version: '1.0' },
      };
      return models[modelId] || null;
    },
    listModels: async () => [
      { id: 'model-v2', name: 'Primary Model', version: '2.0' },
      { id: 'model-v1', name: 'Secondary Model', version: '1.0' },
      { id: 'model-baseline', name: 'Baseline Model', version: '1.0' },
    ],
  };

  // Create fallback chain
  const fallbackConfig: FallbackChainConfig = {
    primaryModelId: 'model-v2',
    secondaryModelId: 'model-v1',
    lastValidatedModelId: 'model-baseline',
    reliabilityThreshold: 0.5,
    fallbackLevels: ['primary', 'secondary', 'last_validated', 'force_no_bet'],
  };
  
  const fallbackChain = new FallbackChain(
    fallbackConfig,
    mockModelRegistry as unknown as ConstructorParameters<typeof FallbackChain>[1],
    dataQualityGates,
    logger
  );

  // Track fallback statistics
  let forcedNoBetCount = 0;
  const fallbackLevelsCount: Record<FallbackLevel, number> = {
    primary: 0,
    secondary: 0,
    last_validated: 0,
    force_no_bet: 0,
  };
  const qualityAssessments: DataQualityAssessment[] = [];
  // ============================================
  
  // Check if hard-stop is already active before starting
  if (await tracker.isActive()) {
    const state = await tracker.getState();
    
    // Send critical alert - hard-stop is blocking the run
    const alert = createHardStopAlert(
      state.triggerReason || 'Hard-stop already active',
      {
        dailyLoss: state.dailyLoss,
        consecutiveLosses: state.consecutiveLosses,
        bankrollPercent: state.bankrollPercent,
      },
      traceId
    );
    await sendAlert({ enabled: true, console: true }, alert);
    
    // Update run status to blocked
    await prisma.dailyRun.update({
      where: { id: runId },
      data: {
        status: 'FAILED', // Use 'failed' as proxy for hard_stop_blocked
        errors: JSON.stringify([`Hard-stop already active: ${state.triggerReason}`]),
        completedAt: new Date(),
      },
    });
    
    return {
      runId,
      status: 'hard_stop_blocked',
      totalPredictions: 0,
      picksCount: 0,
      noBetCount: 0,
      hardStopCount: 0,
      hardStopTriggered: true,
      hardStopReason: state.triggerReason,
      errors: [`Hard-stop already active: ${state.triggerReason}`],
    };
  }
  
  // Get predictions for this run
  const predictions = await prisma.prediction.findMany({
    where: { runId, status: 'pending' },
    orderBy: { createdAt: 'asc' },
  });
  
  if (predictions.length === 0) {
    return {
      runId,
      status: 'completed',
      totalPredictions: 0,
      picksCount: 0,
      noBetCount: 0,
      hardStopCount: 0,
      hardStopTriggered: false,
      errors: [],
      fallbackStats: {
        forcedNoBetCount: 0,
        fallbackLevels: { primary: 0, secondary: 0, last_validated: 0, force_no_bet: 0 },
        qualityAssessments: [],
      },
    };
  }
  
  // Initialize policy engine
  const policyEngine = PolicyEngine.create({
    hardStops: hardStopConfig,
  });
  
  // Track counts
  let picksCount = 0;
  let noBetCount = 0;
  let hardStopCount = 0;
  let hardStopTriggered = false;
  let hardStopReason: string | undefined;
  
  // Create run context
  const runContext: RunContext = {
    runId,
    traceId,
    dailyLoss: 0,
    consecutiveLosses: 0,
    currentBankroll: config.currentBankroll,
    executedAt: new Date(),
  };
  
  // C10: Track start time for timeout
  const runStartTime = Date.now();
  const DAILY_RUN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  
  // Process each prediction
  let processedCount = 0;
  for (const prediction of predictions) {
    processedCount++;
    
    // C10: Check timeout every 10 predictions
    if (processedCount % 10 === 0) {
      const elapsed = Date.now() - runStartTime;
      if (elapsed > DAILY_RUN_TIMEOUT_MS) {
        errors.push(`Daily run timeout: exceeded ${DAILY_RUN_TIMEOUT_MS}ms`);
        break;
      }
    }
    
    // CRITICAL: Check hard-stop BEFORE each decision
    if (await tracker.isActive()) {
      // Hard-stop activated during run - mark remaining as HARD_STOP
      const state = await tracker.getState();
      hardStopTriggered = true;
      hardStopReason = state.triggerReason || 'Unknown reason';
      
      // Mark remaining predictions as HARD_STOP
      await markRemainingAsHardStop(
        predictions.slice(predictions.indexOf(prediction)),
        runId,
        hardStopReason,
        tracker
      );
      
      hardStopCount = predictions.length - picksCount - noBetCount;
      
      break;
    }
    
    try {
      // Create prediction input for policy engine
      const predictionInput = {
        id: prediction.id,
        matchId: prediction.matchId,
        runId: prediction.runId,
        userId: prediction.userId,
        confidence: prediction.confidence,
        edge: prediction.edge ?? undefined,
        driftScore: undefined, // Would come from model
        winnerPrediction: prediction.winnerPrediction,
        scorePrediction: prediction.scorePrediction,
        overUnderPrediction: prediction.overUnderPrediction ?? undefined,
        modelVersion: prediction.modelVersion,
      };
      
      // ============================================
      // FALLBACK CHAIN EVALUATION (Story 2.7)
      // Evaluate data quality and determine fallback level
      // ============================================
      let fallbackResult: EvaluatedFallbackResult | null = null;
      
      try {
        fallbackResult = await fallbackChain.evaluate(predictionInput) as EvaluatedFallbackResult;
        
        // Track statistics
        fallbackLevelsCount[fallbackResult.finalLevel]++;
        if (fallbackResult.wasForcedNoBet) {
          forcedNoBetCount++;
        }
        if (fallbackResult.fallbackAttempts?.length > 0) {
          qualityAssessments.push(...fallbackResult.fallbackAttempts.map((a: FallbackAttempt) => ({
            overallScore: a.qualityScore,
            sourceAvailability: a.qualityScore,
            schemaValidity: a.qualityScore,
            freshness: a.qualityScore,
            completeness: a.qualityScore,
            passed: a.passed,
            failedChecks: a.reason ? [a.reason] : [],
          })));
        }
        
        // Use fallback chain decision if it's a forced No-Bet
        if (fallbackResult.wasForcedNoBet) {
          void fallbackResult.decision.fallbackContext;
        }
      } catch (fallbackError) {
        // If fallback chain fails, log and continue with policy engine
        console.error('Fallback chain error:', fallbackError);
      }
      
      // ============================================
      // Evaluate with policy engine
      // ============================================
      const result = await policyEngine.evaluate(predictionInput, runContext);
      
      // If fallback chain forced No-Bet, use that instead
        if (fallbackResult?.wasForcedNoBet) {
          result.status = 'NO_BET';
          result.rationale = fallbackResult.decision?.rationale || result.rationale;
        }
      
      // Create policy decision with fallback context (Story 2.7)
      // Include data source fingerprints for audit (Story 4.5)
      await prisma.policyDecision.create({
        data: {
          predictionId: prediction.id,
          matchId: prediction.matchId,
          userId: prediction.userId,
          status: result.status,
          rationale: result.rationale,
          confidenceGate: result.confidenceGate,
          edgeGate: result.edgeGate,
          driftGate: result.driftGate,
          hardStopGate: result.hardStopGate,
          hardStopReason: result.hardStopReason,
          recommendedAction: result.recommendedAction,
          traceId: result.traceId,
          executedAt: result.executedAt,
          runId,
          // Required fields from schema (Story 2.9)
          matchDate: prediction.matchDate,
          homeTeam: prediction.homeTeam,
          awayTeam: prediction.awayTeam,
          confidence: prediction.confidence,
          edge: prediction.edge,
          modelVersion: prediction.modelVersion,
          recommendedPick: prediction.winnerPrediction,
          // Story 4.5: Add data source fingerprints for audit
          dataSourceFingerprints: config.dataSourceFingerprints as unknown as Prisma.InputJsonValue,
        } as Prisma.PolicyDecisionUncheckedCreateInput,
      });
      
      // Update prediction status
      await prisma.prediction.update({
        where: { id: prediction.id },
        data: { status: 'processed' },
      });
      
      // Update counts
      if (result.status === 'PICK') {
        picksCount++;
      } else if (result.status === 'NO_BET') {
        noBetCount++;
      } else if (result.status === 'HARD_STOP') {
        hardStopCount++;
        hardStopTriggered = true;
        hardStopReason = result.hardStopReason || undefined;
        
        // Activate hard-stop in tracker
        await tracker.activate(result.hardStopReason || 'Unknown reason');
        
        // Send critical alert for hard-stop activation
        const state = await tracker.getState();
        const alert = createHardStopAlert(
          result.hardStopReason || 'Unknown reason',
          {
            dailyLoss: state.dailyLoss,
            consecutiveLosses: state.consecutiveLosses,
            bankrollPercent: state.bankrollPercent,
          },
          traceId
        );
        // Send with console-only config for now (no external webhooks configured)
        await sendAlert({ enabled: true, console: true }, alert);
      }
      
      // Update tracker state based on decision
      // Track stake as exposure for PICK decisions - this is used for daily loss calculation
      // In production, this would come from user betting preferences
      // When game results are known, this should be updated with actual loss amount
      if (result.status === 'PICK') {
        const stakeAmount = config.defaultStakeAmount ?? 100; // Default €100 stake
        await tracker.updateDailyLoss(stakeAmount);
        
        // Also update consecutive losses tracking (assuming outcome unknown = pending)
        // This should be updated when game results are resolved
        await tracker.updateAfterDecision('PICK', undefined, config.currentBankroll);
      } else if (result.status === 'NO_BET') {
        await tracker.updateAfterDecision('NO_BET', undefined, config.currentBankroll);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(`Error processing prediction ${prediction.id}: ${errorMessage}`);
      
      // Mark prediction as failed
      await prisma.prediction.update({
        where: { id: prediction.id },
        data: { status: 'cancelled' },
      });
    }
  }
  
  // Update run status
  const finalStatus: 'COMPLETED' | 'FAILED' = hardStopTriggered ? 'FAILED' : 'COMPLETED';
  await prisma.dailyRun.update({
    where: { id: runId },
    data: {
      status: finalStatus,
      completedAt: new Date(),
      totalMatches: predictions.length,
      predictionsCount: predictions.length,
      picksCount,
      noBetCount,
      hardStopCount,
      errors: errors.length > 0 ? JSON.stringify(errors) : null,
    },
  });
  
  return {
    runId,
    status: hardStopTriggered ? 'hard_stop_blocked' : 'completed',
    totalPredictions: predictions.length,
    picksCount,
    noBetCount,
    hardStopCount,
    hardStopTriggered,
    hardStopReason,
    errors,
    // Fallback chain statistics (Story 2.7)
    fallbackStats: {
      forcedNoBetCount,
      fallbackLevels: fallbackLevelsCount,
      qualityAssessments: qualityAssessments.slice(0, 10), // Limit to first 10 for return size
    },
  };
}

/**
 * Mark remaining predictions as HARD_STOP when hard-stop triggers mid-run
 */
async function markRemainingAsHardStop(
  remainingPredictions: Array<{
    id: string;
    matchId: string;
    userId: string;
    matchDate: Date;
    homeTeam: string;
    awayTeam: string;
    confidence: number;
    edge: number | null;
    modelVersion: string;
  }>,
  runId: string,
  reason: string,
  tracker: HardStopTracker,
  dataSourceFingerprints?: DataSourceFingerprints
): Promise<void> {
  const recommendedAction = tracker.getRecommendedAction();
  
  for (const prediction of remainingPredictions) {
    try {
      // Create HARD_STOP decision
      await prisma.policyDecision.create({
        data: {
          predictionId: prediction.id,
          matchId: prediction.matchId,
          userId: prediction.userId,
          status: 'HARD_STOP',
          rationale: `HARD-STOP: ${reason}`,
          confidenceGate: true, // Not evaluated
          edgeGate: true,      // Not evaluated
          driftGate: true,     // Not evaluated
          hardStopGate: false,
          hardStopReason: reason,
          recommendedAction,
          traceId: `hardstop-${runId}-${Date.now()}`,
          executedAt: new Date(),
          runId,
          // Required fields from schema
          matchDate: prediction.matchDate,
          homeTeam: prediction.homeTeam,
          awayTeam: prediction.awayTeam,
          confidence: prediction.confidence,
          edge: prediction.edge,
          modelVersion: prediction.modelVersion,
          // Story 4.5: Add data source fingerprints for audit
          dataSourceFingerprints: dataSourceFingerprints as unknown as Prisma.InputJsonValue,
        } as Prisma.PolicyDecisionUncheckedCreateInput,
      });
      
      // Mark prediction as cancelled due to hard-stop
      await prisma.prediction.update({
        where: { id: prediction.id },
        data: { status: 'cancelled' },
      });
    } catch (error) {
      console.error(`Error marking prediction ${prediction.id} as HARD_STOP:`, error);
    }
  }
}

/**
 * Get hard-stop status for monitoring
 */
export async function getHardStopStatus(): Promise<{
  isActive: boolean;
  triggeredAt?: string;
  triggerReason?: string;
  currentState: {
    dailyLoss: number;
    consecutiveLosses: number;
    bankrollPercent: number;
  };
  limits: {
    dailyLossLimit: number;
    consecutiveLosses: number;
    bankrollPercent: number;
  };
  recommendedAction: string;
}> {
  const tracker = createHardStopTracker(DEFAULT_POLICY_CONFIG.hardStops, prisma);
  await tracker.initialize();
  return tracker.getApiResponse();
}

/**
 * Reset hard-stop state (admin action)
 */
export async function resetHardStop(
  reason: string,
  actorId: string
): Promise<{
  success: boolean;
  previousState: unknown;
  message: string;
}> {
  const tracker = createHardStopTracker(DEFAULT_POLICY_CONFIG.hardStops, prisma);
  await tracker.initialize();
  
  const previousState = await tracker.getState();
  
  if (!previousState.isActive) {
    return {
      success: false,
      previousState,
      message: 'Hard-stop is not active',
    };
  }
  
  await tracker.reset(reason, actorId);
  
  return {
    success: true,
    previousState,
    message: 'Hard-stop state has been reset',
  };
}
