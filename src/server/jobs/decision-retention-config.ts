/**
 * Data Retention Configuration
 * 
 * Story 2.9: Implement data retention policies
 * Configuration for decision history retention
 * 
 * Based on FR29 (Data Retention) from architecture
 */

export interface RetentionPolicy {
  decisionRetentionDays: number;    // Keep full decisions for N days
  archiveAfterDays: number;         // Archive to cold storage after N days
  deleteAfterDays: number;          // Delete completely after N days
  preserveAuditForever: boolean;    // Always keep audit trail
}

export const DEFAULT_RETENTION: RetentionPolicy = {
  decisionRetentionDays: 90,
  archiveAfterDays: 90,
  deleteAfterDays: 365,
  preserveAuditForever: true,
};

function addDaysUtc(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

// Get retention policy from environment or use defaults
export function getRetentionPolicy(): RetentionPolicy {
  return {
    decisionRetentionDays: parseInt(process.env.DECISION_RETENTION_DAYS || '90', 10),
    archiveAfterDays: parseInt(process.env.DECISION_ARCHIVE_AFTER_DAYS || '90', 10),
    deleteAfterDays: parseInt(process.env.DECISION_DELETE_AFTER_DAYS || '365', 10),
    preserveAuditForever: process.env.PRESERVE_AUDIT_FOREVER !== 'false',
  };
}

// Calculate retention dates for a decision
export function calculateRetentionDates(
  publishedAt: Date,
  policy: RetentionPolicy = getRetentionPolicy()
): {
  retentionExpires: Date;
  archiveDate: Date;
  deleteDate: Date;
  preserveAudit: boolean;
} {
  const retentionExpires = addDaysUtc(publishedAt, policy.decisionRetentionDays);
  const archiveDate = addDaysUtc(publishedAt, policy.archiveAfterDays);
  const deleteDate = addDaysUtc(publishedAt, policy.deleteAfterDays);

  return {
    retentionExpires,
    archiveDate,
    deleteDate,
    preserveAudit: policy.preserveAuditForever,
  };
}

// Determine action based on retention phase
export type RetentionAction = 'keep' | 'archive' | 'delete';

export function getRetentionAction(
  publishedAt: Date,
  policy: RetentionPolicy = getRetentionPolicy()
): RetentionAction {
  const { archiveDate, deleteDate } = calculateRetentionDates(publishedAt, policy);
  const now = new Date();

  if (now >= deleteDate) {
    return 'delete';
  } else if (now >= archiveDate) {
    return 'archive';
  }
  return 'keep';
}
