/**
 * Policy Versioning Service Tests
 * Story 5.3: Implementer le versioning et historique des changements policy
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks before import
const { mockCreate, mockFindMany, mockFindUnique, mockCount, mockUpdate, mockAuditCreate, mockTransaction } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockCount: vi.fn(),
  mockUpdate: vi.fn(),
  mockAuditCreate: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock('@/server/db/client', () => ({
  prisma: {
    policyVersionSnapshot: {
      create: mockCreate,
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      count: mockCount,
      update: mockUpdate,
    },
    auditLog: {
      create: mockAuditCreate,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/lib/utils/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/server/auth/rbac', () => ({
  generateTraceId: vi.fn().mockReturnValue('test-trace-id'),
}));

// Now import after mocking
import { 
  createVersionSnapshot,
  getVersionSnapshots,
  getVersionById,
  restoreVersion,
  validateHardStopBounds,
} from '@/server/policy/versioning';

describe('Policy Versioning Service', () => {
  const mockPolicyConfig = {
    confidence: { minThreshold: 0.65 },
    edge: { minThreshold: 0.05 },
    drift: { maxDriftScore: 0.15 },
    hardStops: {
      dailyLossLimit: 1000,
      consecutiveLosses: 5,
      bankrollPercent: 0.10,
    },
  };

  const mockUserId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    mockTransaction.mockImplementation(async (callback: (tx: { policyVersionSnapshot: { count: typeof mockCount } }) => Promise<number>) => {
      return callback({
        policyVersionSnapshot: {
          count: mockCount,
        },
      });
    });
  });

  describe('validateHardStopBounds', () => {
    it('should allow restoring to a more restrictive config', () => {
      const newHardStops = {
        dailyLossLimit: 500, // More restrictive
        consecutiveLosses: 3,
        bankrollPercent: 0.05,
      };

      const currentHardStops = {
        dailyLossLimit: 1000,
        consecutiveLosses: 5,
        bankrollPercent: 0.10,
      };

      const result = validateHardStopBounds(newHardStops, currentHardStops);

      expect(result.valid).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should reject restoring to a config that weakens hard-stops', () => {
      const newHardStops = {
        dailyLossLimit: 2000, // Less restrictive - WEAKER
        consecutiveLosses: 10,
        bankrollPercent: 0.25,
      };

      const currentHardStops = {
        dailyLossLimit: 1000,
        consecutiveLosses: 5,
        bankrollPercent: 0.10,
      };

      const result = validateHardStopBounds(newHardStops, currentHardStops);

      expect(result.valid).toBe(false);
      expect(result.violations).toContain('dailyLossLimit');
      expect(result.violations).toContain('consecutiveLosses');
      expect(result.violations).toContain('bankrollPercent');
    });

    it('should allow equal hard-stop values', () => {
      const newHardStops = {
        dailyLossLimit: 1000,
        consecutiveLosses: 5,
        bankrollPercent: 0.10,
      };

      const currentHardStops = {
        dailyLossLimit: 1000,
        consecutiveLosses: 5,
        bankrollPercent: 0.10,
      };

      const result = validateHardStopBounds(newHardStops, currentHardStops);

      expect(result.valid).toBe(true);
    });

    it('should reject only weakening dailyLossLimit', () => {
      const newHardStops = {
        dailyLossLimit: 1500, // Higher = weaker
        consecutiveLosses: 3, // Lower = more restrictive
        bankrollPercent: 0.05, // Lower = more restrictive
      };

      const currentHardStops = {
        dailyLossLimit: 1000,
        consecutiveLosses: 5,
        bankrollPercent: 0.10,
      };

      const result = validateHardStopBounds(newHardStops, currentHardStops);

      expect(result.valid).toBe(false);
      expect(result.violations).toContain('dailyLossLimit');
      expect(result.violations).not.toContain('consecutiveLosses');
      expect(result.violations).not.toContain('bankrollPercent');
    });
  });

  describe('createVersionSnapshot', () => {
    it('should create a version snapshot with correct metadata', async () => {
      mockCount.mockResolvedValue(0);
      mockCreate.mockResolvedValue({
        id: 'version-1',
        version: 1,
        createdAt: new Date('2026-02-16T10:00:00Z'),
        createdBy: mockUserId,
        configJson: mockPolicyConfig,
        changeReason: 'Initial configuration',
        isRestore: false,
        previousVersionId: null,
      });

      const result = await createVersionSnapshot({
        config: mockPolicyConfig,
        createdBy: mockUserId,
        changeReason: 'Initial configuration',
      });

      expect(result).toBeDefined();
      expect(result.version).toBe(1);
      expect(result.createdBy).toBe(mockUserId);
      expect(result.changeReason).toBe('Initial configuration');
      expect(result.isRestore).toBe(false);
      expect(mockCreate).toHaveBeenCalled();
    });

    it('should increment version number for each new snapshot', async () => {
      mockCount.mockResolvedValue(5);
      mockCreate.mockResolvedValue({
        id: 'version-6',
        version: 6,
        createdAt: new Date(),
        createdBy: mockUserId,
        configJson: mockPolicyConfig,
        changeReason: 'Updated config',
        isRestore: false,
        previousVersionId: null,
      });

      const result = await createVersionSnapshot({
        config: mockPolicyConfig,
        createdBy: mockUserId,
        changeReason: 'Updated config',
      });

      expect(result.version).toBe(6);
    });
  });

  describe('getVersionSnapshots', () => {
    it('should return paginated version snapshots', async () => {
      const mockSnapshots = [
        {
          id: 'version-2',
          version: 2,
          createdAt: new Date('2026-02-16T11:00:00Z'),
          createdBy: mockUserId,
          configJson: mockPolicyConfig,
          changeReason: 'Update 2',
          isRestore: false,
          previousVersionId: null,
        },
        {
          id: 'version-1',
          version: 1,
          createdAt: new Date('2026-02-16T10:00:00Z'),
          createdBy: mockUserId,
          configJson: mockPolicyConfig,
          changeReason: 'Initial',
          isRestore: false,
          previousVersionId: null,
        },
      ];

      mockFindMany.mockResolvedValue(mockSnapshots);
      mockCount.mockResolvedValue(2);

      const result = await getVersionSnapshots({ limit: 10, offset: 0 });

      expect(result.snapshots).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.snapshots[0].version).toBe(2); // Most recent first
    });
  });

  describe('getVersionById', () => {
    it('should return a specific version by ID', async () => {
      const mockSnapshot = {
        id: 'version-1',
        version: 1,
        createdAt: new Date(),
        createdBy: mockUserId,
        configJson: mockPolicyConfig,
        changeReason: 'Initial',
        isRestore: false,
        previousVersionId: null,
      };

      mockFindUnique.mockResolvedValue(mockSnapshot);

      const result = await getVersionById('version-1');

      expect(result).toBeDefined();
      expect(result?.id).toBe('version-1');
      expect(result?.version).toBe(1);
    });

    it('should return null for non-existent version', async () => {
      mockFindUnique.mockResolvedValue(null);

      const result = await getVersionById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('restoreVersion', () => {
    it('should restore a version and create new snapshot when valid', async () => {
      const oldVersion = {
        id: 'version-1',
        version: 1,
        createdAt: new Date('2026-02-16T10:00:00Z'),
        createdBy: mockUserId,
        configJson: {
          ...mockPolicyConfig,
          hardStops: {
            dailyLossLimit: 500, // More restrictive
            consecutiveLosses: 3,
            bankrollPercent: 0.05,
          },
        },
        changeReason: 'Initial',
        isRestore: false,
        previousVersionId: null,
      };

      // Mock finding the version to restore
      mockFindUnique.mockResolvedValue(oldVersion);
      
      // Mock counting to get next version
      mockCount.mockResolvedValue(2);

      // Mock creating new version snapshot
      mockCreate.mockResolvedValue({
        id: 'version-3',
        version: 3,
        createdAt: new Date(),
        createdBy: mockUserId,
        configJson: oldVersion.configJson,
        changeReason: 'Restored from version 1',
        isRestore: true,
        previousVersionId: 'version-1',
      });

      const result = await restoreVersion({
        versionId: 'version-1',
        restoredBy: mockUserId,
        currentConfig: mockPolicyConfig,
      });

      expect(result).toBeDefined();
      expect(result.isRestore).toBe(true);
      expect(result.previousVersionId).toBe('version-1');
    });

    it('should reject restore that weakens hard-stops', async () => {
      const oldVersion = {
        id: 'version-1',
        version: 1,
        createdAt: new Date(),
        createdBy: mockUserId,
        configJson: {
          ...mockPolicyConfig,
          hardStops: {
            dailyLossLimit: 2000, // Less restrictive - WEAKER
            consecutiveLosses: 10,
            bankrollPercent: 0.25,
          },
        },
        changeReason: 'Initial',
        isRestore: false,
        previousVersionId: null,
      };

      mockFindUnique.mockResolvedValue(oldVersion);

      await expect(
        restoreVersion({
          versionId: 'version-1',
          restoredBy: mockUserId,
          currentConfig: mockPolicyConfig,
        })
      ).rejects.toThrow('Cannot restore: would weaken hard-stop protections');
    });
  });
});
