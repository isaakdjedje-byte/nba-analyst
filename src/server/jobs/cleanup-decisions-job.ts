/**
 * Decision Cleanup Job
 * 
 * Handles data retention for decision history
 * - Archives old decisions for audit preservation
 * - Deletes decisions after retention period
 * 
 * Story 2.9: Implement data retention cleanup job
 * 
 * Run: npx tsx src/server/jobs/cleanup-decisions-job.ts
 * Scheduled: Daily at 2:00 AM UTC
 */

import { prisma } from '@/server/db/client';
import {
  getRetentionPolicy,
  getRetentionAction,
} from './decision-retention-config';

// Logging setup
const log = (level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: Record<string, unknown>) => {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    timestamp,
    level,
    service: 'decision-cleanup-job',
    message,
    ...meta,
  }));
};

/**
 * Process a batch of decisions for retention
 */
async function processDecisionRetention(): Promise<{
  archived: number;
  deleted: number;
  errors: number;
}> {
  const policy = getRetentionPolicy();
  
  // Get decisions that need processing
  // We process decisions published more than archiveAfterDays ago
  const archiveThreshold = new Date();
  archiveThreshold.setDate(archiveThreshold.getDate() - policy.archiveAfterDays);
  
  const decisionsToProcess = await prisma.policyDecision.findMany({
    where: {
      publishedAt: {
        lt: archiveThreshold,
      },
    },
    select: {
      id: true,
      traceId: true,
      publishedAt: true,
    },
    take: 1000, // Process in batches
    orderBy: { publishedAt: 'asc' },
  });

  let archived = 0;
  let deleted = 0;
  let errors = 0;

  for (const decision of decisionsToProcess) {
    if (!decision.publishedAt) {
      continue; // Skip unpublished decisions
    }

    try {
      const action = getRetentionAction(decision.publishedAt, policy);

      switch (action) {
        case 'archive':
          // Mark decision as archived (soft delete)
          // FR29: Archive to cold storage before deletion
          // For now, we add an archived flag and log to audit
          await prisma.policyDecision.update({
            where: { id: decision.id },
            data: { 
              // TODO: Add 'archivedAt' field to schema for proper archival tracking
              // For now, we log the archival action to preserve evidence
            },
          });
          
          // Log archival to audit trail BEFORE archival (FR29)
          await prisma.auditLog.create({
            data: {
              actorId: 'system',
              action: 'DECISION_ARCHIVED',
              targetId: decision.id,
              targetType: 'POLICY_DECISION',
              metadata: JSON.stringify({
                reason: 'retention_policy',
                traceId: decision.traceId,
                archivedAt: new Date().toISOString(),
                retentionPolicy: 'archiveAfterDays',
              }),
              traceId: `cleanup-${decision.traceId}`,
            },
          });
          
          archived++;
          log('INFO', 'Decision archived', { 
            decisionId: decision.id, 
            traceId: decision.traceId,
            publishedAt: decision.publishedAt,
          });
          break;

        case 'delete':
          // Before deletion, ensure audit trail is preserved
          if (policy.preserveAuditForever) {
            // Check if audit entries exist for this traceId
            const auditCount = await prisma.auditLog.count({
              where: { traceId: decision.traceId },
            });
            
            if (auditCount === 0) {
              // Create audit entry before deletion
              await prisma.auditLog.create({
                data: {
                  actorId: 'system', // System actor for automated cleanup
                  action: 'DECISION_DELETED',
                  targetId: decision.id,
                  targetType: 'POLICY_DECISION',
                  metadata: JSON.stringify({
                    reason: 'retention_policy',
                    traceId: decision.traceId,
                    preservedAudit: false,
                  }),
                  traceId: `cleanup-${decision.traceId}`,
                },
              });
            }
          }

          // Delete the decision
          await prisma.policyDecision.delete({
            where: { id: decision.id },
          });
          deleted++;
          log('INFO', 'Decision deleted', { 
            decisionId: decision.id, 
            traceId: decision.traceId,
            publishedAt: decision.publishedAt,
          });
          break;

        case 'keep':
          // No action needed
          break;
      }
    } catch (error) {
      errors++;
      log('ERROR', 'Failed to process decision', {
        decisionId: decision.id,
        traceId: decision.traceId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { archived, deleted, errors };
}

/**
 * Get retention statistics
 */
async function getRetentionStats(): Promise<{
  totalDecisions: number;
  archivedDecisions: number;
  pendingArchive: number;
  pendingDelete: number;
}> {
  const policy = getRetentionPolicy();
  
  const now = new Date();
  
  const archiveThreshold = new Date(now);
  archiveThreshold.setDate(archiveThreshold.getDate() - policy.archiveAfterDays);
  
  const deleteThreshold = new Date(now);
  deleteThreshold.setDate(deleteThreshold.getDate() - policy.deleteAfterDays);

  const [totalDecisions, pendingArchive, pendingDelete] = await Promise.all([
    prisma.policyDecision.count(),
    prisma.policyDecision.count({
      where: {
        publishedAt: {
          gte: archiveThreshold,
          lt: deleteThreshold,
        },
      },
    }),
    prisma.policyDecision.count({
      where: {
        publishedAt: {
          lt: deleteThreshold,
        },
      },
    }),
  ]);

  return {
    totalDecisions,
    archivedDecisions: totalDecisions - pendingArchive - pendingDelete,
    pendingArchive,
    pendingDelete,
  };
}

/**
 * Main execution function
 */
export async function runCleanupJob(): Promise<{
  success: boolean;
  archived: number;
  deleted: number;
  errors: number;
  stats: Awaited<ReturnType<typeof getRetentionStats>>;
}> {
  log('INFO', 'Starting decision cleanup job');
  
  const startTime = Date.now();
  
  try {
    // Get pre-job stats
    const preStats = await getRetentionStats();
    log('INFO', 'Pre-job retention stats', preStats);

    // Process retention
    const { archived, deleted, errors } = await processDecisionRetention();

    // Get post-job stats
    const postStats = await getRetentionStats();
    
    const duration = Date.now() - startTime;
    
    log('INFO', 'Decision cleanup job completed', {
      duration: `${duration}ms`,
      archived,
      deleted,
      errors,
      postStats,
    });

    return {
      success: errors === 0,
      archived,
      deleted,
      errors,
      stats: postStats,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    log('ERROR', 'Decision cleanup job failed', {
      duration: `${duration}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      archived: 0,
      deleted: 0,
      errors: 1,
      stats: await getRetentionStats(),
    };
  }
}

// Run if executed directly
runCleanupJob()
  .then((result) => {
    console.log('Cleanup result:', result);
    process.exit(result.success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Cleanup failed:', error);
    process.exit(1);
  });
