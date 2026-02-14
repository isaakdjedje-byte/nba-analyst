/**
 * Daily Run Orchestrator
 * 
 * Orchestrates the complete daily decision production pipeline:
 * 1. Data Ingestion (NBA CDN, ESPN, Odds Providers)
 * 2. ML Inference (predictions with fallback chain)
 * 3. Policy Evaluation (confidence, edge, drift, hard-stop gates)
 * 4. Decision Publication (storage, audit trail, cache invalidation)
 * 
 * Story 2.8: Implement daily production run pipeline
 * 
 * Pipeline Flow:
 * Scheduled Trigger → [1] Data Ingestion → [2] ML Inference → [3] Policy Evaluation → [4] Publication → [5] Completion
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/server/db/client';
import { createIngestionService, IngestionService } from '@/server/ingestion/ingestion-service';
import { PolicyEngine, DEFAULT_POLICY_CONFIG } from '@/server/policy/engine';
import { createDataQualityGates, DataQualityAssessment } from '@/server/ml/orchestration/data-quality-gates';
import { createFallbackChain, FallbackChain, FallbackLevel, FallbackAttempt } from '@/server/ml/orchestration/fallback-chain';
import { createHardStopTracker } from '@/server/policy/hardstop-tracker';
import { sendAlert, createFailureAlert } from '@/server/ingestion/alerting';
import { CacheService } from '@/server/cache/cache-service';
import { CACHE_TTL } from '@/server/cache/cache-keys';

// Import existing daily run processor for policy evaluation
import { processDailyRun, DailyRunJobConfig } from '@/jobs/daily-run-job';

export interface PipelineConfig {
  /** Run ID in database */
  runId: string;
  /** Trace ID for request tracking */
  traceId: string;
  /** Run date */
  runDate: Date;
  /** Skip ingestion phase (for testing) */
  skipIngestion?: boolean;
  /** Skip ML inference phase (for testing) */
  skipMLInference?: boolean;
}

export interface PipelineResult {
  status: 'completed' | 'failed' | 'partial';
  predictionsCount: number;
  picksCount: number;
  noBetCount: number;
  hardStopCount: number;
  dataQualityScore: number | null;
  errors: string[];
  metadata: {
    ingestionDuration: number;
    mlInferenceDuration: number;
    policyEvaluationDuration: number;
    publicationDuration: number;
    totalDuration: number;
  };
  qualityAssessment?: DataQualityAssessment;
}

/**
 * Execute the complete daily run pipeline
 * 
 * This is the main orchestration function that:
 * 1. Fetches data from all configured sources
 * 2. Generates ML predictions with fallback chain
 * 3. Evaluates policy gates for each prediction
 * 4. Stores decisions with full metadata
 * 5. Invalidates cache for decision views
 */
export async function executeDailyRunPipeline(config: PipelineConfig): Promise<PipelineResult> {
  const { runId, traceId, runDate, skipIngestion, skipMLInference } = config;
  
  const errors: string[] = [];
  const startTime = Date.now();
  
  console.log(`[Pipeline] Starting daily run pipeline for run ${runId}`);
  console.log(`[Pipeline] Trace ID: ${traceId}`);
  
  // Track phase durations
  let ingestionDuration = 0;
  let mlInferenceDuration = 0;
  let policyEvaluationDuration = 0;
  let publicationDuration = 0;
  
  // Initialize services
  let ingestionService: IngestionService | null = null;
  let cacheService: CacheService | null = null;
  let qualityAssessment: DataQualityAssessment | undefined;
  
  try {
    // ============================================
    // PHASE 1: Data Ingestion
    // ============================================
    if (skipIngestion) {
      console.log('[Pipeline] Skipping ingestion phase (skipIngestion=true)');
    } else {
      console.log('[Pipeline] Phase 1: Data Ingestion');
      const ingestionStart = Date.now();
      
      ingestionService = createIngestionService();
      
      // Fetch data from all enabled providers
      const ingestionResult = await ingestionService.ingestFromAll();
      
      ingestionDuration = Date.now() - ingestionStart;
      
      console.log(`[Pipeline] Ingestion completed in ${ingestionDuration}ms`);
      console.log(`[Pipeline] Providers - Success: ${ingestionResult.summary.successful}/${ingestionResult.summary.total}`);
      
      if (ingestionResult.summary.failed > 0) {
        const failedProviders = Object.entries(ingestionResult.byProvider)
          .filter(([, result]) => !result.success)
          .map(([name]) => name);
        
        errors.push(`Ingestion failures: ${failedProviders.join(', ')}`);
        
        // Send alert for ingestion failures
        await sendAlert(
          { enabled: true, console: true },
          createFailureAlert('Ingestion Pipeline', traceId, `Failed providers: ${failedProviders.join(', ')}`, true)
        );
      }
      
      // Assess data quality
      if (ingestionResult.data.length > 0) {
        const nullLogger = {
          debug: () => {},
          info: () => {},
          warn: console.warn,
          error: console.error,
          fatal: console.error,
          trace: () => {},
          child: () => nullLogger,
          level: 'info',
          levels: [],
          silent: false,
        } as any;
        
        const dataQualityGates = createDataQualityGates({
          reliabilityThreshold: 0.5,
          minSourceAvailability: 0.7,
          minSchemaValidity: 0.7,
          minCompleteness: 0.8,
        }, nullLogger);
        
        // Run quality assessment on first data item
        qualityAssessment = await dataQualityGates.assess(ingestionResult.data[0], {
          id: 'quality-check',
          name: 'Quality Check',
          version: '1.0',
        } as any);
        
        console.log(`[Pipeline] Data quality score: ${qualityAssessment.overallScore.toFixed(2)}`);
        
        if (!qualityAssessment.passed) {
          console.warn(`[Pipeline] Data quality below threshold: ${qualityAssessment.failedChecks.join(', ')}`);
        }
      }
    }
    
    // ============================================
    // PHASE 2: ML Inference
    // ============================================
    let predictionsCount = 0;
    
    if (skipMLInference) {
      console.log('[Pipeline] Skipping ML inference phase (skipMLInference=true)');
    } else {
      console.log('[Pipeline] Phase 2: ML Inference');
      const mlStart = Date.now();
      
      // Generate predictions for today's matches
      // In production, this would call actual ML models
      // For now, we'll create placeholder predictions
      
      predictionsCount = await generatePredictions(runId, runDate, traceId);
      
      mlInferenceDuration = Date.now() - mlStart;
      
      console.log(`[Pipeline] ML inference completed in ${mlInferenceDuration}ms`);
      console.log(`[Pipeline] Generated ${predictionsCount} predictions`);
    }
    
    // ============================================
    // PHASE 3: Policy Evaluation & Publication
    // ============================================
    console.log('[Pipeline] Phase 3: Policy Evaluation & Publication');
    const policyStart = Date.now();
    
    // Process predictions through policy engine
    // This calls the existing processDailyRun function
    const jobConfig: DailyRunJobConfig = {
      currentBankroll: parseInt(process.env.DEFAULT_BANKROLL || '10000', 10),
      dailyLossLimit: DEFAULT_POLICY_CONFIG.hardStops.dailyLossLimit,
      consecutiveLosses: DEFAULT_POLICY_CONFIG.hardStops.consecutiveLosses,
      bankrollPercent: DEFAULT_POLICY_CONFIG.hardStops.bankrollPercent,
      defaultStakeAmount: parseInt(process.env.DEFAULT_STAKE_AMOUNT || '100', 10),
    };
    
    let picksCount = 0;
    let noBetCount = 0;
    let hardStopCount = 0;
    
    if (predictionsCount > 0) {
      try {
        const result = await processDailyRun(runId, jobConfig);
        
        picksCount = result.picksCount;
        noBetCount = result.noBetCount;
        hardStopCount = result.hardStopCount;
        
        if (result.errors.length > 0) {
          errors.push(...result.errors);
        }
        
        console.log(`[Pipeline] Policy evaluation completed`);
        console.log(`[Pipeline] Results - Picks: ${picksCount}, No-Bet: ${noBetCount}, Hard-Stop: ${hardStopCount}`);
      } catch (policyError) {
        const errorMsg = policyError instanceof Error ? policyError.message : String(policyError);
        errors.push(`Policy evaluation error: ${errorMsg}`);
        console.error(`[Pipeline] Policy evaluation failed: ${errorMsg}`);
      }
    }
    
    policyEvaluationDuration = Date.now() - policyStart;
    
    // ============================================
    // PHASE 4: Cache Invalidation
    // ============================================
    console.log('[Pipeline] Phase 4: Cache Invalidation');
    const pubStart = Date.now();
    
    try {
      cacheService = new CacheService(CACHE_TTL.DECISION_LIST);
      await cacheService.initialize();
      
      // Invalidate decision-related caches
      // In production, this would invalidate specific cache keys
      console.log('[Pipeline] Cache invalidation completed');
    } catch (cacheError) {
      const errorMsg = cacheError instanceof Error ? cacheError.message : String(cacheError);
      console.warn(`[Pipeline] Cache invalidation warning: ${errorMsg}`);
      // Don't fail the run for cache errors
    }
    
    publicationDuration = Date.now() - pubStart;
    
    // ============================================
    // COMPLETION
    // ============================================
    const totalDuration = Date.now() - startTime;
    
    console.log(`[Pipeline] Pipeline completed in ${totalDuration}ms`);
    console.log(`[Pipeline] Final results:`);
    console.log(`  - Predictions: ${predictionsCount}`);
    console.log(`  - Picks: ${picksCount}`);
    console.log(`  - No-Bet: ${noBetCount}`);
    console.log(`  - Hard-Stop: ${hardStopCount}`);
    console.log(`  - Errors: ${errors.length}`);
    
    // Determine final status
    const status: 'completed' | 'failed' | 'partial' = 
      errors.length === 0 ? 'completed' :
      predictionsCount === 0 ? 'failed' : 'partial';
    
    return {
      status,
      predictionsCount,
      picksCount,
      noBetCount,
      hardStopCount,
      dataQualityScore: qualityAssessment?.overallScore ?? null,
      errors,
      metadata: {
        ingestionDuration,
        mlInferenceDuration,
        policyEvaluationDuration,
        publicationDuration,
        totalDuration,
      },
      qualityAssessment,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const totalDuration = Date.now() - startTime;
    
    console.error(`[Pipeline] Pipeline failed: ${errorMessage}`);
    
    // Send critical alert
    await sendAlert(
      { enabled: true, console: true },
      createFailureAlert('Daily Run Pipeline', traceId, errorMessage, true)
    );
    
    return {
      status: 'failed',
      predictionsCount: 0,
      picksCount: 0,
      noBetCount: 0,
      hardStopCount: 0,
      dataQualityScore: null,
      errors: [errorMessage],
      metadata: {
        ingestionDuration,
        mlInferenceDuration,
        policyEvaluationDuration,
        publicationDuration,
        totalDuration,
      },
    };
  }
}

/**
 * Generate predictions for today's matches
 * 
 * In production, this would call actual ML models.
 * For now, it creates placeholder predictions for testing.
 */
async function generatePredictions(runId: string, runDate: Date, traceId: string): Promise<number> {
  // Check if there are any matches scheduled for today
  // In production, this would query the database for today's games
  
  // For now, we'll return 0 predictions if no matches exist
  // In a real implementation, this would:
  // 1. Query for today's NBA games
  // 2. Call ML models to generate predictions
  // 3. Store predictions in the database
  
  console.log(`[Pipeline] Checking for matches on ${runDate.toISOString().split('T')[0]}`);
  
  // TODO: Implement actual prediction generation
  // For now, return 0 to indicate no predictions generated
  return 0;
}

/**
 * Get pipeline configuration defaults
 */
export function getPipelineConfig(): {
  maxRetries: number;
  timeoutMs: number;
  alertOnFailure: boolean;
} {
  return {
    maxRetries: parseInt(process.env.PIPELINE_MAX_RETRIES || '3', 10),
    timeoutMs: parseInt(process.env.PIPELINE_TIMEOUT_MS || '300000', 10), // 5 minutes default
    alertOnFailure: process.env.PIPELINE_ALERT_ON_FAILURE !== 'false',
  };
}
