/**
 * Hard-Stop Flow Integration Tests
 * 
 * Tests the complete hard-stop flow in the daily run pipeline.
 * Story 2.6: Integration tests for hard-stop in daily run.
 * 
 * CRITICAL: Verifies 100% hard-stop enforcement (NFR13).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { processDailyRun, getHardStopStatus, resetHardStop } from '@/jobs/daily-run-job';

// Mock dependencies
const mockPrisma = {
  hardStopState: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  dailyRun: {
    update: vi.fn(),
    findUnique: vi.fn(),
  },
  prediction: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  policyDecision: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(mockPrisma)),
};

// Mock the db client
vi.mock('@/server/db/client', () => ({
  prisma: mockPrisma,
}));

// Mock policy engine
vi.mock('@/server/policy/engine', () => ({
  PolicyEngine: {
    create: vi.fn().mockImplementation(() => ({
      evaluate: vi.fn().mockResolvedValue({
        decisionId: 'test-decision-id',
        predictionId: 'test-prediction-id',
        status: 'PICK',
        rationale: 'All gates passed',
        confidenceGate: true,
        edgeGate: true,
        driftGate: true,
        hardStopGate: true,
        hardStopReason: null,
        recommendedAction: 'Proceed with bet',
        traceId: 'test-trace',
        executedAt: new Date(),
        gateOutcomes: {},
      }),
    })),
  },
  DEFAULT_POLICY_CONFIG: {
    hardStops: {
      dailyLossLimit: 1000,
      consecutiveLosses: 5,
      bankrollPercent: 0.10,
    },
  },
}));

// Mock hardstop-tracker
vi.mock('@/server/policy/hardstop-tracker', () => ({
  createHardStopTracker: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    isActive: vi.fn().mockResolvedValue(false),
    getState: vi.fn().mockResolvedValue({
      isActive: false,
      dailyLoss: 0,
      consecutiveLosses: 0,
      bankrollPercent: 0,
      lastResetAt: new Date(),
    }),
    getApiResponse: vi.fn().mockResolvedValue({
      isActive: false,
      currentState: {
        dailyLoss: 0,
        consecutiveLosses: 0,
        bankrollPercent: 0,
      },
      limits: {
        dailyLossLimit: 1000,
        consecutiveLosses: 5,
        bankrollPercent: 0.10,
      },
      recommendedAction: 'Continue betting',
    }),
    updateDailyLoss: vi.fn().mockResolvedValue(undefined),
    reset: vi.fn().mockResolvedValue(undefined),
    activate: vi.fn().mockResolvedValue(undefined),
    getRecommendedAction: vi.fn().mockReturnValue('Contact ops'),
  })),
  HardStopTracker: class {},
}));

describe('Hard-Stop Flow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock setup
    mockPrisma.hardStopState.findFirst.mockResolvedValue(null);
    mockPrisma.hardStopState.create.mockResolvedValue({
      id: 'test-id',
      isActive: false,
      dailyLoss: 0,
      consecutiveLosses: 0,
      bankrollPercent: 0,
      lastResetAt: new Date(),
      triggeredAt: null,
      triggerReason: null,
    });
    mockPrisma.hardStopState.update.mockResolvedValue({});
    mockPrisma.dailyRun.update.mockResolvedValue({});
    mockPrisma.dailyRun.findUnique.mockResolvedValue({
      id: 'run-1',
      runDate: new Date(),
      status: 'RUNNING',
    });
  });

  describe('processDailyRun()', () => {
    it('should process predictions when hard-stop is not active', async () => {
      const mockPredictions = [
        {
          id: 'pred-1',
          matchId: 'match-1',
          runId: 'run-1',
          userId: 'user-1',
          confidence: 0.8,
          edge: 0.1,
          winnerPrediction: 'HOME',
          modelVersion: 'v1',
          status: 'pending',
          createdAt: new Date(),
        },
      ];
      
      mockPrisma.prediction.findMany.mockResolvedValue(mockPredictions);
      mockPrisma.policyDecision.create.mockResolvedValue({ id: 'decision-1' });
      mockPrisma.prediction.update.mockResolvedValue({});
      
      const result = await processDailyRun('run-1', {
        currentBankroll: 10000,
      });
      
      expect(result.status).toBe('completed');
      expect(mockPrisma.policyDecision.create).toHaveBeenCalled();
    });

    it('should block run when hard-stop is already active', async () => {
      // Setup mock to return active hard-stop
      const { createHardStopTracker } = await import('@/server/policy/hardstop-tracker');
      const mockTracker = {
        initialize: vi.fn().mockResolvedValue(undefined),
        isActive: vi.fn().mockResolvedValue(true),
        getState: vi.fn().mockResolvedValue({
          isActive: true,
          triggeredAt: new Date(),
          triggerReason: 'Daily loss exceeded',
        }),
      };
      (createHardStopTracker as any).mockReturnValue(mockTracker);
      
      const result = await processDailyRun('run-1', {
        currentBankroll: 10000,
      });
      
      expect(result.status).toBe('hard_stop_blocked');
      expect(result.hardStopTriggered).toBe(true);
      expect(mockPrisma.dailyRun.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'failed',
          }),
        })
      );
    });

    it('should handle empty prediction list', async () => {
      mockPrisma.prediction.findMany.mockResolvedValue([]);
      
      const result = await processDailyRun('run-1', {
        currentBankroll: 10000,
      });
      
      expect(result.status).toBe('completed');
      expect(result.totalPredictions).toBe(0);
    });

    it('should track decision counts correctly', async () => {
      const mockPredictions = [
        { id: 'pred-1', matchId: 'm1', runId: 'r1', userId: 'u1', confidence: 0.8, edge: 0.1, modelVersion: 'v1', status: 'pending', createdAt: new Date() },
        { id: 'pred-2', matchId: 'm2', runId: 'r1', userId: 'u1', confidence: 0.8, edge: 0.1, modelVersion: 'v1', status: 'pending', createdAt: new Date() },
        { id: 'pred-3', matchId: 'm3', runId: 'r1', userId: 'u1', confidence: 0.8, edge: 0.1, modelVersion: 'v1', status: 'pending', createdAt: new Date() },
      ];
      
      mockPrisma.prediction.findMany.mockResolvedValue(mockPredictions);
      
      // First two are PICK, third is NO_BET
      let callCount = 0;
      mockPrisma.policyDecision.create.mockImplementation(() => {
        callCount++;
        const status = callCount <= 2 ? 'PICK' : 'NO_BET';
        return Promise.resolve({ id: `d-${callCount}`, status });
      });
      mockPrisma.prediction.update.mockResolvedValue({});
      
      const { PolicyEngine } = await import('@/server/policy/engine');
      const mockEngine = {
        evaluate: vi.fn().mockImplementation((input, ctx) => {
          // Return different statuses based on prediction
          if (input.id === 'pred-1' || input.id === 'pred-2') {
            return Promise.resolve({
              decisionId: `d-${input.id}`,
              predictionId: input.id,
              status: 'PICK',
              rationale: 'All gates passed',
              confidenceGate: true,
              edgeGate: true,
              driftGate: true,
              hardStopGate: true,
              hardStopReason: null,
              recommendedAction: 'Proceed',
              traceId: 'trace',
              executedAt: new Date(),
              gateOutcomes: {},
            });
          } else {
            return Promise.resolve({
              decisionId: `d-${input.id}`,
              predictionId: input.id,
              status: 'NO_BET',
              rationale: 'Confidence gate failed',
              confidenceGate: false,
              edgeGate: true,
              driftGate: true,
              hardStopGate: true,
              hardStopReason: null,
              recommendedAction: 'Wait',
              traceId: 'trace',
              executedAt: new Date(),
              gateOutcomes: {},
            });
          }
        }),
      };
      (PolicyEngine as any).create.mockReturnValue(mockEngine);
      
      const result = await processDailyRun('run-1', {
        currentBankroll: 10000,
      });
      
      expect(result.picksCount).toBe(2);
      expect(result.noBetCount).toBe(1);
    });
  });

  describe('getHardStopStatus()', () => {
    it('should return current hard-stop status', async () => {
      const status = await getHardStopStatus();
      
      expect(status).toHaveProperty('isActive');
      expect(status).toHaveProperty('currentState');
      expect(status).toHaveProperty('limits');
      expect(status).toHaveProperty('recommendedAction');
    });
  });

  describe('resetHardStop()', () => {
    it('should reset hard-stop when active', async () => {
      const { createHardStopTracker } = await import('@/server/policy/hardstop-tracker');
      const mockTracker = {
        initialize: vi.fn().mockResolvedValue(undefined),
        isActive: vi.fn().mockResolvedValue(true),
        getState: vi.fn().mockResolvedValue({
          isActive: true,
          triggerReason: 'Daily loss exceeded',
        }),
        reset: vi.fn().mockResolvedValue(undefined),
      };
      (createHardStopTracker as any).mockReturnValue(mockTracker);
      
      const result = await resetHardStop('Admin review complete', 'admin-id');
      
      expect(result.success).toBe(true);
      expect(mockTracker.reset).toHaveBeenCalledWith('Admin review complete', 'admin-id');
    });

    it('should fail gracefully when hard-stop not active', async () => {
      const { createHardStopTracker } = await import('@/server/policy/hardstop-tracker');
      const mockTracker = {
        initialize: vi.fn().mockResolvedValue(undefined),
        isActive: vi.fn().mockResolvedValue(false),
        getState: vi.fn().mockResolvedValue({
          isActive: false,
        }),
      };
      (createHardStopTracker as any).mockReturnValue(mockTracker);
      
      const result = await resetHardStop('Test reason', 'admin-id');
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('not active');
    });
  });
});
