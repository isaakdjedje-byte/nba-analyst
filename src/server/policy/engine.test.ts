/**
 * Policy Engine Unit Tests
 * 
 * Story 2.5: Policy Engine - Single Source of Truth
 * 
 * Tests the orchestration of all gates and decision determination.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PolicyEngine } from './engine';
import { PredictionInput, RunContext } from './types';

describe('PolicyEngine', () => {
  let engine: PolicyEngine;

  beforeEach(() => {
    engine = PolicyEngine.createDefault();
  });

  describe('evaluate - decision determination', () => {
    const basePrediction: PredictionInput = {
      id: 'pred-123',
      matchId: 'match-456',
      runId: 'run-789',
      userId: 'user-001',
      confidence: 0.75,
      edge: 0.10,
      driftScore: 0.08,
      modelVersion: 'v1.0',
    };

    const baseContext: RunContext = {
      runId: 'run-789',
      traceId: 'trace-001',
      dailyLoss: 0,
      consecutiveLosses: 0,
      currentBankroll: 10000,
      executedAt: new Date(),
    };

    it('should return PICK when all gates pass', async () => {
      const result = await engine.evaluate(basePrediction, baseContext);
      
      expect(result.status).toBe('PICK');
      expect(result.confidenceGate).toBe(true);
      expect(result.edgeGate).toBe(true);
      expect(result.driftGate).toBe(true);
      expect(result.hardStopGate).toBe(true);
    });

    it('should return NO_BET when confidence fails', async () => {
      const prediction = { ...basePrediction, confidence: 0.50 };
      const result = await engine.evaluate(prediction, baseContext);
      
      expect(result.status).toBe('NO_BET');
      expect(result.confidenceGate).toBe(false);
    });

    it('should return NO_BET when edge fails', async () => {
      const prediction = { ...basePrediction, edge: 0.01 };
      const result = await engine.evaluate(prediction, baseContext);
      
      expect(result.status).toBe('NO_BET');
      expect(result.edgeGate).toBe(false);
    });

    it('should return NO_BET when drift fails', async () => {
      const prediction = { ...basePrediction, driftScore: 0.25 };
      const result = await engine.evaluate(prediction, baseContext);
      
      expect(result.status).toBe('NO_BET');
      expect(result.driftGate).toBe(false);
    });

    it('should return HARD_STOP when hard-stop triggers (ignores other gates)', async () => {
      const context = {
        ...baseContext,
        dailyLoss: 2000, // Exceeds 1000 limit
      };
      const result = await engine.evaluate(basePrediction, context);
      
      expect(result.status).toBe('HARD_STOP');
      expect(result.hardStopGate).toBe(false);
      expect(result.hardStopReason).toContain('Daily loss');
    });

    it('should return HARD_STOP regardless of confidence', async () => {
      const prediction = { ...basePrediction, confidence: 0.99 };
      const context = {
        ...baseContext,
        consecutiveLosses: 10, // Exceeds 5 limit
      };
      const result = await engine.evaluate(prediction, context);
      
      expect(result.status).toBe('HARD_STOP');
      // Even though confidence would pass, hard-stop short-circuits
      expect(result.hardStopGate).toBe(false);
    });

    it('should prioritize hard-stop over NO_BET', async () => {
      const prediction = { ...basePrediction, confidence: 0.50 }; // Would be NO_BET
      const context = {
        ...baseContext,
        dailyLoss: 1500, // But this triggers HARD_STOP
      };
      const result = await engine.evaluate(prediction, context);
      
      expect(result.status).toBe('HARD_STOP');
    });
  });

  describe('evaluate - validation', () => {
    const validContext: RunContext = {
      runId: 'run-789',
      traceId: 'trace-001',
      dailyLoss: 0,
      consecutiveLosses: 0,
      currentBankroll: 10000,
      executedAt: new Date(),
    };

    it('should throw when prediction ID is missing', async () => {
      const prediction = {
        id: '',
        confidence: 0.75,
      } as unknown as PredictionInput;

      await expect(
        engine.evaluate(prediction, validContext)
      ).rejects.toThrow('Prediction ID is required');
    });

    it('should throw when confidence is missing', async () => {
      const prediction = {
        id: 'pred-123',
      } as unknown as PredictionInput;

      await expect(
        engine.evaluate(prediction, validContext)
      ).rejects.toThrow('Prediction confidence is required');
    });

    it('should throw when confidence is out of range', async () => {
      const prediction = {
        id: 'pred-123',
        confidence: 1.5,
      } as unknown as PredictionInput;

      await expect(
        engine.evaluate(prediction, validContext)
      ).rejects.toThrow('Invalid confidence value');
    });
  });

  describe('evaluate - gate outcomes', () => {
    it('should include all gate outcomes in result', async () => {
      const prediction: PredictionInput = {
        id: 'pred-123',
        matchId: 'match-456',
        runId: 'run-789',
        userId: 'user-001',
        confidence: 0.75,
        edge: 0.10,
        driftScore: 0.08,
        modelVersion: 'v1.0',
      };

      const context: RunContext = {
        runId: 'run-789',
        traceId: 'trace-001',
        dailyLoss: 0,
        consecutiveLosses: 0,
        currentBankroll: 10000,
        executedAt: new Date(),
      };

      const result = await engine.evaluate(prediction, context);

      expect(result.gateOutcomes).toHaveProperty('confidence');
      expect(result.gateOutcomes).toHaveProperty('edge');
      expect(result.gateOutcomes).toHaveProperty('drift');
      expect(result.gateOutcomes).toHaveProperty('hardStop');

      // Verify structure
      expect(result.gateOutcomes.confidence).toHaveProperty('passed');
      expect(result.gateOutcomes.confidence).toHaveProperty('score');
      expect(result.gateOutcomes.confidence).toHaveProperty('threshold');
    });

    it('should include rationale in result', async () => {
      const prediction: PredictionInput = {
        id: 'pred-123',
        matchId: 'match-456',
        runId: 'run-789',
        userId: 'user-001',
        confidence: 0.75,
        modelVersion: 'v1.0',
      };

      const context: RunContext = {
        runId: 'run-789',
        traceId: 'trace-001',
        dailyLoss: 0,
        consecutiveLosses: 0,
        currentBankroll: 10000,
        executedAt: new Date(),
      };

      const result = await engine.evaluate(prediction, context);

      expect(result.rationale).toBeTruthy();
      expect(typeof result.rationale).toBe('string');
    });
  });

  describe('evaluate - traceId propagation', () => {
    it('should use provided traceId', async () => {
      const prediction: PredictionInput = {
        id: 'pred-123',
        confidence: 0.75,
        modelVersion: 'v1.0',
      } as unknown as PredictionInput;

      const context: RunContext = {
        runId: 'run-789',
        traceId: 'custom-trace-id',
        dailyLoss: 0,
        consecutiveLosses: 0,
        currentBankroll: 10000,
        executedAt: new Date(),
      };

      const result = await engine.evaluate(prediction, context);

      expect(result.traceId).toBe('custom-trace-id');
    });
  });

  describe('create with custom config', () => {
    it('should use custom configuration', async () => {
      const customEngine = PolicyEngine.create({
        confidence: { minThreshold: 0.80 },
        edge: { minThreshold: 0.15 },
      });

      const prediction: PredictionInput = {
        id: 'pred-123',
        confidence: 0.75, // Below custom 0.80 threshold
        edge: 0.10, // Below custom 0.15 threshold
        modelVersion: 'v1.0',
      } as unknown as PredictionInput;

      const context: RunContext = {
        runId: 'run-789',
        traceId: 'trace-001',
        dailyLoss: 0,
        consecutiveLosses: 0,
        currentBankroll: 10000,
        executedAt: new Date(),
      };

      const result = await customEngine.evaluate(prediction, context);

      // Should fail both gates with custom thresholds
      expect(result.status).toBe('NO_BET');
      expect(result.confidenceGate).toBe(false);
      expect(result.edgeGate).toBe(false);
    });
  });
});
