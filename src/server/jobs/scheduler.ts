/**
 * Daily Run Scheduler
 * 
 * Manages scheduled and manual triggering of daily decision production runs.
 * Story 2.8: Implement daily production run pipeline
 * 
 * Architecture:
 * - Cron-based scheduling (via external cron service or Next.js API route)
 * - Manual trigger endpoint for ad-hoc runs
 * - Health check endpoint for monitoring
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/server/db/client';
import { executeDailyRunPipeline } from './daily-run-orchestrator';
import { runContinuousLearningCycle } from '@/server/ml/automation/continuous-learning-service';

export interface SchedulerConfig {
  /** Cron expression for scheduling (e.g., "0 10 * * *" for 10:00 UTC daily) */
  cronExpression: string;
  /** Timezone for scheduling */
  timezone: string;
  /** Whether the scheduler is enabled */
  enabled: boolean;
  /** Default triggered by source */
  defaultTriggerSource: string;
}

export interface SchedulerHealth {
  /** Whether the scheduler is healthy */
  healthy: boolean;
  /** Last successful run timestamp */
  lastSuccessfulRun?: Date;
  /** Last failed run timestamp */
  lastFailedRun?: Date;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Scheduler status message */
  message: string;
}

/** Default scheduler configuration */
export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  cronExpression: process.env.DAILY_RUN_CRON || '0 10 * * *', // Default: 10:00 UTC daily
  timezone: 'UTC',
  enabled: process.env.DAILY_RUN_ENABLED !== 'false',
  defaultTriggerSource: 'system',
};

/**
 * Create a new daily run record
 */
export async function createDailyRun(triggeredBy: string = 'system'): Promise<{
  id: string;
  traceId: string;
  runDate: Date;
}> {
  const runDate = new Date();
  runDate.setHours(0, 0, 0, 0); // Normalize to start of day
  
  const traceId = `run-${runDate.toISOString().split('T')[0]}-${uuidv4().slice(0, 8)}`;
  
  const run = await prisma.dailyRun.create({
    data: {
      runDate,
      status: 'PENDING',
      triggeredBy,
      traceId,
      startedAt: null,
      completedAt: null,
      totalMatches: 0,
      predictionsCount: 0,
      picksCount: 0,
      noBetCount: 0,
      hardStopCount: 0,
    },
  });
  
  return {
    id: run.id,
    traceId: run.traceId,
    runDate: run.runDate,
  };
}

/**
 * Trigger a daily run manually or via scheduler
 * 
 * This is the main entry point for running the daily production pipeline.
 * 
 * @param options - Run trigger options
 * @returns Run execution result
 */
export interface TriggerOptions {
  /** Source of trigger (e.g., 'cron', 'manual', 'api') */
  triggeredBy?: string;
  /** Whether to skip ingestion (for testing) */
  skipIngestion?: boolean;
  /** Whether to skip ML inference (for testing) */
  skipMLInference?: boolean;
}

export interface TriggerResult {
  success: boolean;
  runId: string;
  traceId: string;
  status: 'completed' | 'failed' | 'partial';
  message: string;
  duration?: number;
  error?: string;
}

/**
 * Trigger a daily run - main entry point for the pipeline
 */
export async function triggerDailyRun(options: TriggerOptions = {}): Promise<TriggerResult> {
  const startTime = Date.now();
  const triggeredBy = options.triggeredBy || 'manual';
  
  console.log(`[Scheduler] Starting daily run triggered by: ${triggeredBy}`);
  
  try {
    // Create run record
    const { id: runId, traceId, runDate } = await createDailyRun(triggeredBy);
    
    console.log(`[Scheduler] Created run: ${runId}, traceId: ${traceId}`);
    
    // Execute the full pipeline
    const result = await executeDailyRunPipeline({
      runId,
      traceId,
      runDate,
      skipIngestion: options.skipIngestion,
      skipMLInference: options.skipMLInference,
    });
    
    const duration = Date.now() - startTime;
    
    // Update run record with final status
    await prisma.dailyRun.update({
      where: { id: runId },
      data: {
        status: result.status === 'completed' ? 'COMPLETED' : 
                result.status === 'failed' ? 'FAILED' : 'COMPLETED', // partial = completed with issues
        completedAt: new Date(),
        predictionsCount: result.predictionsCount,
        picksCount: result.picksCount,
        noBetCount: result.noBetCount,
        hardStopCount: result.hardStopCount,
        dataQualityScore: result.dataQualityScore,
        errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      },
    });
    
    console.log(`[Scheduler] Run ${runId} completed in ${duration}ms with status: ${result.status}`);

    // Daily feedback loop: resolve outcomes, monitor drift/health, optional guarded retraining.
    // This never fails the daily run itself.
    try {
      const learning = await runContinuousLearningCycle();
      console.log('[Scheduler] Continuous learning cycle summary:', {
        runId,
        feedbackExecuted: learning.feedbackExecuted,
        outcomeResolution: learning.outcomeResolution,
        weeklyResolvedCount: learning.weeklyMetrics.resolvedCount,
        weeklyAccuracy: learning.weeklyMetrics.accuracy,
        retraining: learning.retraining,
      });
    } catch (learningError) {
      console.error('[Scheduler] Continuous learning cycle failed:',
        learningError instanceof Error ? learningError.message : String(learningError)
      );
    }
    
    return {
      success: result.status === 'completed',
      runId,
      traceId,
      status: result.status,
      message: result.status === 'completed' 
        ? `Run completed with ${result.predictionsCount} predictions processed`
        : `Run ${result.status} with ${result.predictionsCount} predictions, ${result.errors.length} errors`,
      duration,
      ...(result.status !== 'completed' && result.errors.length > 0 ? { error: result.errors[0] } : {}),
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    console.error(`[Scheduler] Run failed: ${errorMessage}`);
    
    return {
      success: false,
      runId: '',
      traceId: '',
      status: 'failed',
      message: 'Run failed',
      duration,
      error: errorMessage,
    };
  }
}

/**
 * Get scheduler health status
 */
export async function getSchedulerHealth(): Promise<SchedulerHealth> {
  try {
    // Get last successful run
    const lastSuccessful = await prisma.dailyRun.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    });
    
    // Get last failed run
    const lastFailed = await prisma.dailyRun.findFirst({
      where: { status: 'FAILED' },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    });
    
    // Count consecutive failures
    const recentRuns = await prisma.dailyRun.findMany({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    
    let consecutiveFailures = 0;
    for (const run of recentRuns) {
      if (run.status === 'FAILED') {
        consecutiveFailures++;
      } else {
        break;
      }
    }
    
    return {
      healthy: consecutiveFailures < 3,
      lastSuccessfulRun: lastSuccessful?.completedAt,
      lastFailedRun: lastFailed?.completedAt,
      consecutiveFailures,
      message: consecutiveFailures >= 3 
        ? 'Scheduler unhealthy: too many consecutive failures'
        : 'Scheduler healthy',
    };
  } catch (error) {
    return {
      healthy: false,
      consecutiveFailures: 0,
      message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Get scheduler configuration
 */
export function getSchedulerConfig(): SchedulerConfig {
  return {
    ...DEFAULT_SCHEDULER_CONFIG,
    cronExpression: process.env.DAILY_RUN_CRON || DEFAULT_SCHEDULER_CONFIG.cronExpression,
    enabled: process.env.DAILY_RUN_ENABLED !== 'false',
  };
}
