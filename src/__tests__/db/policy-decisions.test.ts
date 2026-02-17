import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the prisma client - hoisted, so no top-level variables
vi.mock('../../server/db/client', () => ({
  prisma: {
    policyDecision: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      createManyAndReturn: vi.fn(),
    },
  },
}));

import { prisma } from '../../server/db/client';
import {
  createPolicyDecision,
  getPolicyDecisionById,
  getPolicyDecisionByPredictionId,
  getPolicyDecisionsByRunId,
  getPolicyDecisionsByStatus,
  getPolicyDecisionsByMatchId,
  updatePolicyDecision,
  deletePolicyDecision,
  countPolicyDecisionsByRunId,
  getDecisionStatsByRunId,
  getPolicyDecisionWithPrediction,
  // Story 2.9: New exports
  getDecisionHistory,
  getPolicyDecisionByTraceId,
  createManyPolicyDecisions,
  publishPolicyDecision,
  getDecisionsForRetention,
  countDecisionsByStatus,
  type PolicyDecisionCreateInput,
  type DecisionStatus,
  type DecisionHistoryQueryParams,
} from '../../server/db/repositories/policy-decisions-repository';

describe('Policy Decisions Repository - Type Validation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Type Structure Validation', () => {
    it('should validate PolicyDecisionCreateInput type structure', () => {
      const input: PolicyDecisionCreateInput = {
        predictionId: 'pred-123',
        matchId: 'match-456',
        userId: 'user-789',
        runId: 'run-abc',
        status: 'PICK',
        rationale: 'High confidence prediction with good edge',
        confidenceGate: true,
        edgeGate: true,
        driftGate: true,
        hardStopGate: false,
        // Story 2.9: Decision History fields
        matchDate: new Date('2026-02-14'),
        homeTeam: 'Lakers',
        awayTeam: 'Celtics',
        confidence: 0.85,
        modelVersion: 'model-v2',
        traceId: 'trace-xyz',
        executedAt: new Date('2026-02-13T10:00:00Z'),
      };

      expect(input.predictionId).toBe('pred-123');
      expect(input.status).toBe('PICK');
      expect(input.rationale).toBe('High confidence prediction with good edge');
      expect(input.confidenceGate).toBe(true);
      expect(input.edgeGate).toBe(true);
      expect(input.driftGate).toBe(true);
      expect(input.hardStopGate).toBe(false);
      // Story 2.9 fields
      expect(input.homeTeam).toBe('Lakers');
      expect(input.awayTeam).toBe('Celtics');
      expect(input.confidence).toBe(0.85);
    });

    it('should handle HARD_STOP status with reason', () => {
      const input: PolicyDecisionCreateInput = {
        predictionId: 'pred-456',
        matchId: 'match-789',
        userId: 'user-abc',
        runId: 'run-def',
        status: 'HARD_STOP',
        rationale: 'Model drift detected above threshold',
        confidenceGate: true,
        edgeGate: false,
        driftGate: false,
        hardStopGate: true,
        hardStopReason: 'Feature drift > 0.15',
        recommendedAction: 'Retrain model before next run',
        // Story 2.9: Decision History fields
        matchDate: new Date('2026-02-14'),
        homeTeam: 'Warriors',
        awayTeam: 'Bulls',
        confidence: 0.72,
        modelVersion: 'model-v2',
        traceId: 'trace-123',
        executedAt: new Date(),
      };

      expect(input.status).toBe('HARD_STOP');
      expect(input.hardStopReason).toBe('Feature drift > 0.15');
      expect(input.recommendedAction).toBe('Retrain model before next run');
    });

    it('should validate all DecisionStatus enum values', () => {
      const statuses: DecisionStatus[] = ['PICK', 'NO_BET', 'HARD_STOP'];
      
      statuses.forEach((status) => {
        const input: PolicyDecisionCreateInput = {
          predictionId: `pred-${status}`,
          matchId: 'match-123',
          userId: 'user-456',
          runId: 'run-789',
          status,
          rationale: `Test for ${status}`,
          confidenceGate: true,
          edgeGate: true,
          driftGate: true,
          hardStopGate: false,
          // Story 2.9: Decision History fields
          matchDate: new Date('2026-02-14'),
          homeTeam: 'TeamA',
          awayTeam: 'TeamB',
          confidence: 0.80,
          modelVersion: 'model-v2',
          traceId: 'trace-test',
          executedAt: new Date(),
        };
        
        expect(input.status).toBe(status);
      });
    });
  });

  describe('Repository Function Exports', () => {
    it('should export createPolicyDecision function', () => {
      expect(typeof createPolicyDecision).toBe('function');
    });

    it('should export getPolicyDecisionById function', () => {
      expect(typeof getPolicyDecisionById).toBe('function');
    });

    it('should export getPolicyDecisionByPredictionId function', () => {
      expect(typeof getPolicyDecisionByPredictionId).toBe('function');
    });

    it('should export getPolicyDecisionsByRunId function', () => {
      expect(typeof getPolicyDecisionsByRunId).toBe('function');
    });

    it('should export getPolicyDecisionsByStatus function', () => {
      expect(typeof getPolicyDecisionsByStatus).toBe('function');
    });

    it('should export getPolicyDecisionsByMatchId function', () => {
      expect(typeof getPolicyDecisionsByMatchId).toBe('function');
    });

    it('should export updatePolicyDecision function', () => {
      expect(typeof updatePolicyDecision).toBe('function');
    });

    it('should export deletePolicyDecision function', () => {
      expect(typeof deletePolicyDecision).toBe('function');
    });

    it('should export countPolicyDecisionsByRunId function', () => {
      expect(typeof countPolicyDecisionsByRunId).toBe('function');
    });

    it('should export getDecisionStatsByRunId function', () => {
      expect(typeof getDecisionStatsByRunId).toBe('function');
    });

    it('should export getPolicyDecisionWithPrediction function', () => {
      expect(typeof getPolicyDecisionWithPrediction).toBe('function');
    });
  });

  describe('Gate Outcomes Validation', () => {
    it('should include all Story 2.4 gate outcome fields', () => {
      const input: PolicyDecisionCreateInput = {
        predictionId: 'pred-test',
        matchId: 'match-test',
        userId: 'user-test',
        runId: 'run-test',
        status: 'PICK',
        rationale: 'All gates passed',
        confidenceGate: true,
        edgeGate: true,
        driftGate: true,
        hardStopGate: false,
        // Story 2.9: Decision History fields
        matchDate: new Date('2026-02-14'),
        homeTeam: 'Heat',
        awayTeam: 'Nets',
        confidence: 0.88,
        modelVersion: 'model-v2',
        traceId: 'trace-test',
        executedAt: new Date(),
      };

      expect(input).toHaveProperty('confidenceGate');
      expect(input).toHaveProperty('edgeGate');
      expect(input).toHaveProperty('driftGate');
      expect(input).toHaveProperty('hardStopGate');
      // Story 2.9 fields
      expect(input).toHaveProperty('matchDate');
      expect(input).toHaveProperty('homeTeam');
      expect(input).toHaveProperty('awayTeam');
      expect(input).toHaveProperty('confidence');
    });

    it('should handle gate failures correctly', () => {
      const input: PolicyDecisionCreateInput = {
        predictionId: 'pred-fail',
        matchId: 'match-fail',
        userId: 'user-fail',
        runId: 'run-fail',
        status: 'NO_BET',
        rationale: 'Edge gate failed',
        confidenceGate: true,
        edgeGate: false,  // Failed
        driftGate: true,
        hardStopGate: false,
        // Story 2.9: Decision History fields
        matchDate: new Date('2026-02-14'),
        homeTeam: 'Knicks',
        awayTeam: 'Raptors',
        confidence: 0.65,
        modelVersion: 'model-v2',
        traceId: 'trace-fail',
        executedAt: new Date(),
      };

      expect(input.edgeGate).toBe(false);
      expect(input.status).toBe('NO_BET');
    });
  });

  describe('Repository Operations', () => {
    it('should call prisma.policyDecision.create with correct data', async () => {
      const mockCreate = vi.mocked(prisma.policyDecision.create);
      mockCreate.mockResolvedValue({
        id: 'dec-123',
        predictionId: 'pred-123',
        matchId: 'match-123',
        userId: 'user-123',
        runId: 'run-123',
        status: 'PICK',
        rationale: 'Test rationale',
        confidenceGate: true,
        edgeGate: true,
        driftGate: true,
        hardStopGate: false,
        // Story 2.9: Decision History fields
        matchDate: new Date('2026-02-14'),
        homeTeam: 'Lakers',
        awayTeam: 'Celtics',
        confidence: 0.85,
        edge: 0.12,
        modelVersion: 'model-v2',
        recommendedPick: 'Lakers',
        predictionInputs: {},
        publishedAt: new Date(),
        traceId: 'trace-123',
        executedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as unknown as never);

      const input: PolicyDecisionCreateInput = {
        predictionId: 'pred-123',
        matchId: 'match-123',
        userId: 'user-123',
        runId: 'run-123',
        status: 'PICK',
        rationale: 'Test rationale',
        confidenceGate: true,
        edgeGate: true,
        driftGate: true,
        hardStopGate: false,
        // Story 2.9: Decision History fields
        matchDate: new Date('2026-02-14'),
        homeTeam: 'Lakers',
        awayTeam: 'Celtics',
        confidence: 0.85,
        modelVersion: 'model-v2',
        traceId: 'trace-123',
        executedAt: new Date(),
      };

      const result = await createPolicyDecision(input);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
      expect(result.predictionId).toBe('pred-123');
      expect(result.status).toBe('PICK');
      // Story 2.9 validation
      expect(result.homeTeam).toBe('Lakers');
      expect(result.confidence).toBe(0.85);
    });

    it('should call prisma.policyDecision.findUnique for getById', async () => {
      const mockFindUnique = vi.mocked(prisma.policyDecision.findUnique);
      mockFindUnique.mockResolvedValue({
        id: 'dec-123',
        predictionId: 'pred-123',
        status: 'PICK',
        rationale: 'Test',
      } as unknown as never);

      const result = await getPolicyDecisionById('dec-123');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { id: 'dec-123' },
        select: expect.any(Object),
      });
      expect(result).toBeDefined();
    });

    it('should get decision statistics correctly', async () => {
      const mockCount = vi.mocked(prisma.policyDecision.count);
      mockCount.mockResolvedValueOnce(10);  // total
      mockCount.mockResolvedValueOnce(5);   // picks
      mockCount.mockResolvedValueOnce(3);   // noBets
      mockCount.mockResolvedValueOnce(2);   // hardStops

      const result = await getDecisionStatsByRunId('run-123');

      expect(result).toEqual({
        total: 10,
        picks: 5,
        noBets: 3,
        hardStops: 2,
      });
    });

    it('should get decision by prediction ID', async () => {
      const mockFindUnique = vi.mocked(prisma.policyDecision.findUnique);
      mockFindUnique.mockResolvedValue({
        id: 'dec-456',
        predictionId: 'pred-789',
        status: 'HARD_STOP',
        rationale: 'Drift detected',
      } as unknown as never);

      const result = await getPolicyDecisionByPredictionId('pred-789');

      expect(mockFindUnique).toHaveBeenCalledWith({
        where: { predictionId: 'pred-789' },
        select: expect.any(Object),
      });
      expect(result?.status).toBe('HARD_STOP');
    });
  });

  // Story 2.9: Decision History Tests
  describe('Decision History Functions', () => {
    it('should export getDecisionHistory function', () => {
      expect(typeof getDecisionHistory).toBe('function');
    });

    it('should export getPolicyDecisionByTraceId function', () => {
      expect(typeof getPolicyDecisionByTraceId).toBe('function');
    });

    it('should export createManyPolicyDecisions function', () => {
      expect(typeof createManyPolicyDecisions).toBe('function');
    });

    it('should export publishPolicyDecision function', () => {
      expect(typeof publishPolicyDecision).toBe('function');
    });

    it('should export getDecisionsForRetention function', () => {
      expect(typeof getDecisionsForRetention).toBe('function');
    });

    it('should export countDecisionsByStatus function', () => {
      expect(typeof countDecisionsByStatus).toBe('function');
    });

    it('should validate DecisionHistoryQueryParams type', () => {
      const params: DecisionHistoryQueryParams = {
        fromDate: new Date('2026-01-01'),
        toDate: new Date('2026-02-14'),
        status: 'PICK',
        matchId: 'match-123',
        page: 1,
        limit: 20,
      };

      expect(params.status).toBe('PICK');
      expect(params.page).toBe(1);
      expect(params.limit).toBe(20);
    });
  });
});
