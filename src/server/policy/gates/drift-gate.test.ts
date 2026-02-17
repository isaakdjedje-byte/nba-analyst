/**
 * Drift Gate Unit Tests
 * 
 * Story 2.5: Policy Engine - Single Source of Truth
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DriftGate } from './drift-gate';
import { DriftConfig } from '../types';

describe('DriftGate', () => {
  let gate: DriftGate;
  const defaultConfig: DriftConfig = { maxDriftScore: 0.15 };

  beforeEach(() => {
    gate = new DriftGate(defaultConfig);
  });

  describe('evaluate', () => {
    it('should pass when drift equals max threshold', () => {
      const result = gate.evaluate({ driftScore: 0.15 });
      
      expect(result.passed).toBe(true);
      expect(result.gateName).toBe('drift');
      expect(result.severity).toBe('warning');
    });

    it('should pass when drift is below max threshold', () => {
      const result = gate.evaluate({ driftScore: 0.08 });
      
      expect(result.passed).toBe(true);
      expect(result.score).toBe(0.08);
    });

    it('should fail when drift exceeds max threshold', () => {
      const result = gate.evaluate({ driftScore: 0.20 });
      
      expect(result.passed).toBe(false);
      expect(result.severity).toBe('warning');
    });

    it('should fail when drift is exactly at max + 0.01', () => {
      const result = gate.evaluate({ driftScore: 0.16 });
      
      expect(result.passed).toBe(false);
    });

    it('should pass when drift is exactly at max - 0.01', () => {
      const result = gate.evaluate({ driftScore: 0.14 });
      
      expect(result.passed).toBe(true);
    });

    it('should handle missing driftScore as 0 (perfect)', () => {
      const result = gate.evaluate({});
      
      expect(result.passed).toBe(true);
      expect(result.score).toBe(0);
    });

    it('should return correct message when passing', () => {
      const result = gate.evaluate({ driftScore: 0.05 });
      
      expect(result.message).toContain('within maximum threshold');
    });

    it('should return correct message when failing', () => {
      const result = gate.evaluate({ driftScore: 0.25 });
      
      expect(result.message).toContain('exceeds maximum threshold');
    });
  });

  describe('edge cases', () => {
    it('should handle threshold of 0 (any drift fails)', () => {
      const zeroGate = new DriftGate({ maxDriftScore: 0 });
      const result = zeroGate.evaluate({ driftScore: 0 });
      
      expect(result.passed).toBe(true);
    });

    it('should handle threshold of 1 (always passes)', () => {
      const maxGate = new DriftGate({ maxDriftScore: 1 });
      const result = maxGate.evaluate({ driftScore: 0.99 });
      
      expect(result.passed).toBe(true);
    });
  });
});
