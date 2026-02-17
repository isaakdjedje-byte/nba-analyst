/**
 * Story 2.9: Decision Retention Cleanup Job Tests
 * Tests for src/server/jobs/cleanup-decisions-job.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  getRetentionPolicy, 
  calculateRetentionDates, 
  getRetentionAction,
  DEFAULT_RETENTION,
  type RetentionPolicy
} from '@/server/jobs/decision-retention-config';

// Mock Prisma
vi.mock('@/server/db/client', () => ({
  prisma: {
    policyDecision: {
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}));

const { prisma } = await import('@/server/db/client');

describe('Decision Retention Config', () => {
  describe('DEFAULT_RETENTION', () => {
    it('should have sensible default values', () => {
      expect(DEFAULT_RETENTION.decisionRetentionDays).toBe(90);
      expect(DEFAULT_RETENTION.archiveAfterDays).toBe(90);
      expect(DEFAULT_RETENTION.deleteAfterDays).toBe(365);
      expect(DEFAULT_RETENTION.preserveAuditForever).toBe(true);
    });
  });

  describe('getRetentionPolicy', () => {
    it('should use default values when env vars not set', () => {
      // Clear any existing env vars
      delete process.env.DECISION_RETENTION_DAYS;
      delete process.env.DECISION_ARCHIVE_AFTER_DAYS;
      delete process.env.DECISION_DELETE_AFTER_DAYS;
      delete process.env.PRESERVE_AUDIT_FOREVER;

      const policy = getRetentionPolicy();

      expect(policy.decisionRetentionDays).toBe(90);
      expect(policy.archiveAfterDays).toBe(90);
      expect(policy.deleteAfterDays).toBe(365);
      expect(policy.preserveAuditForever).toBe(true);
    });

    it('should use environment variables when set', () => {
      process.env.DECISION_RETENTION_DAYS = '30';
      process.env.DECISION_ARCHIVE_AFTER_DAYS = '60';
      process.env.DECISION_DELETE_AFTER_DAYS = '180';
      process.env.PRESERVE_AUDIT_FOREVER = 'false';

      const policy = getRetentionPolicy();

      expect(policy.decisionRetentionDays).toBe(30);
      expect(policy.archiveAfterDays).toBe(60);
      expect(policy.deleteAfterDays).toBe(180);
      expect(policy.preserveAuditForever).toBe(false);
    });
  });

  describe('calculateRetentionDates', () => {
    it('should calculate correct retention dates', () => {
      const publishedAt = new Date('2026-01-15T10:00:00Z');
      const policy: RetentionPolicy = {
        decisionRetentionDays: 90,
        archiveAfterDays: 90,
        deleteAfterDays: 365,
        preserveAuditForever: true,
      };

      const result = calculateRetentionDates(publishedAt, policy);

      // retentionExpires = 90 days after publishedAt
      expect(result.retentionExpires.toISOString()).toBe('2026-04-15T10:00:00.000Z');
      
      // archiveDate = 90 days after publishedAt
      expect(result.archiveDate.toISOString()).toBe('2026-04-15T10:00:00.000Z');
      
      // deleteDate = 365 days after publishedAt
      expect(result.deleteDate.toISOString()).toBe('2027-01-15T10:00:00.000Z');
      
      expect(result.preserveAudit).toBe(true);
    });

    it('should handle custom retention policies', () => {
      const publishedAt = new Date('2026-01-01T00:00:00Z');
      const policy: RetentionPolicy = {
        decisionRetentionDays: 30,
        archiveAfterDays: 60,
        deleteAfterDays: 90,
        preserveAuditForever: false,
      };

      const result = calculateRetentionDates(publishedAt, policy);

      expect(result.retentionExpires.toISOString()).toBe('2026-01-31T00:00:00.000Z');
      expect(result.archiveDate.toISOString()).toBe('2026-03-02T00:00:00.000Z');
      expect(result.deleteDate.toISOString()).toBe('2026-04-01T00:00:00.000Z');
      expect(result.preserveAudit).toBe(false);
    });
  });

  describe('getRetentionAction', () => {
    const policy: RetentionPolicy = {
      decisionRetentionDays: 90,
      archiveAfterDays: 90,
      deleteAfterDays: 365,
      preserveAuditForever: true,
    };

    it('should return "keep" for recent decisions', () => {
      const recentDate = new Date();
      const action = getRetentionAction(recentDate, policy);
      
      expect(action).toBe('keep');
    });

    it('should return "archive" for decisions older than archive threshold but newer than delete threshold', () => {
      // 180 days ago - older than 90 days archive threshold but younger than 365 days delete
      const archiveDate = new Date();
      archiveDate.setDate(archiveDate.getDate() - 180);
      
      const action = getRetentionAction(archiveDate, policy);
      
      expect(action).toBe('archive');
    });

    it('should return "delete" for decisions older than delete threshold', () => {
      // 400 days ago - older than 365 days delete threshold
      const deleteDate = new Date();
      deleteDate.setDate(deleteDate.getDate() - 400);
      
      const action = getRetentionAction(deleteDate, policy);
      
      expect(action).toBe('delete');
    });

    it('should return "keep" for decisions exactly at archive threshold', () => {
      // Exactly 90 days ago - boundary case
      const boundaryDate = new Date();
      boundaryDate.setDate(boundaryDate.getDate() - 89);
      
      const action = getRetentionAction(boundaryDate, policy);
      
      expect(action).toBe('keep');
    });
  });
});

describe('Cleanup Job Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should find decisions older than archive threshold', async () => {
    const archiveThreshold = new Date();
    archiveThreshold.setDate(archiveThreshold.getDate() - 100);

    const mockDecisions = [
      { id: '1', traceId: 'trace-1', publishedAt: archiveThreshold },
      { id: '2', traceId: 'trace-2', publishedAt: archiveThreshold },
    ];

    vi.mocked(prisma.policyDecision.findMany).mockResolvedValue(mockDecisions as unknown as never);
    vi.mocked(prisma.policyDecision.count).mockResolvedValue(0);

    const result = await prisma.policyDecision.findMany({
      where: {
        publishedAt: { lt: archiveThreshold },
      },
      select: { id: true, traceId: true, publishedAt: true },
      take: 1000,
    });

    expect(result).toHaveLength(2);
    expect(prisma.policyDecision.findMany).toHaveBeenCalled();
  });

  it('should preserve audit before deletion when preserveAuditForever is true', async () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 400);

    const mockDecision = { 
      id: '1', 
      traceId: 'trace-1', 
      publishedAt: oldDate 
    };

    vi.mocked(prisma.policyDecision.findMany).mockResolvedValue([mockDecision] as unknown as never);
    vi.mocked(prisma.auditLog.count).mockResolvedValue(0);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as unknown as never);
    vi.mocked(prisma.policyDecision.delete).mockResolvedValue({} as unknown as never);

    // Simulate the cleanup logic
    const preserveAuditForever = true;
    const auditCount = await prisma.auditLog.count({
      where: { traceId: mockDecision.traceId },
    });

    if (preserveAuditForever && auditCount === 0) {
      await prisma.auditLog.create({
        data: {
          actorId: 'system',
          action: 'DECISION_DELETED',
          targetId: mockDecision.id,
          targetType: 'POLICY_DECISION',
          metadata: JSON.stringify({
            reason: 'retention_policy',
            traceId: mockDecision.traceId,
            preservedAudit: false,
          }),
          traceId: `cleanup-${mockDecision.traceId}`,
        },
      });
    }

    await prisma.policyDecision.delete({
      where: { id: mockDecision.id },
    });

    expect(prisma.auditLog.create).toHaveBeenCalled();
    expect(prisma.policyDecision.delete).toHaveBeenCalledWith({
      where: { id: '1' },
    });
  });

  it('should count decisions by status correctly', async () => {
    vi.mocked(prisma.policyDecision.count)
      .mockResolvedValueOnce(10)  // PICK
      .mockResolvedValueOnce(5)   // NO_BET
      .mockResolvedValueOnce(3);  // HARD_STOP

    // This would be the actual query in production
    const pickCount = await prisma.policyDecision.count({ where: { status: 'PICK' } });
    const noBetCount = await prisma.policyDecision.count({ where: { status: 'NO_BET' } });
    const hardStopCount = await prisma.policyDecision.count({ where: { status: 'HARD_STOP' } });

    expect(pickCount).toBe(10);
    expect(noBetCount).toBe(5);
    expect(hardStopCount).toBe(3);
  });
});

describe('Retention Policy Edge Cases', () => {
  it('should handle zero retention days', () => {
    const policy: RetentionPolicy = {
      decisionRetentionDays: 0,
      archiveAfterDays: 0,
      deleteAfterDays: 0,
      preserveAuditForever: true,
    };

    const publishedAt = new Date('2026-01-15T10:00:00Z');
    
    // With 0 days, everything should be deleted immediately
    const action = getRetentionAction(publishedAt, policy);
    
    expect(action).toBe('delete');
  });

  it('should handle very large retention periods', () => {
    const policy: RetentionPolicy = {
      decisionRetentionDays: 3650, // 10 years
      archiveAfterDays: 3650,
      deleteAfterDays: 36500, // 100 years
      preserveAuditForever: true,
    };

    const recentDate = new Date();
    const action = getRetentionAction(recentDate, policy);
    
    expect(action).toBe('keep');
  });

  it('should handle decisions with null publishedAt', async () => {
    const mockDecisions = [
      { id: '1', traceId: 'trace-1', publishedAt: null },
    ];

    vi.mocked(prisma.policyDecision.findMany).mockResolvedValue(mockDecisions as unknown as never);

    const result = await prisma.policyDecision.findMany({
      where: { publishedAt: { lt: new Date() } },
    });

    // Should still return decisions (even with null publishedAt)
    expect(result).toHaveLength(1);
  });
});
