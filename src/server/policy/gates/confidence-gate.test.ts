/**
 * Confidence Gate Unit Tests
 * 
 * Story 2.5: Policy Engine - Single Source of Truth
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConfidenceGate } from './confidence-gate';
import { ConfidenceConfig } from '../types';

describe('ConfidenceGate', () => {
  let gate: ConfidenceGate;
  const defaultConfig: ConfidenceConfig = { minThreshold: 0.65 };

  beforeEach(() => {
    gate = new ConfidenceGate(defaultConfig);
  });

  describe('evaluate', () => {
    it('should pass when confidence equals threshold', () => {
      const result = gate.evaluate({ confidence: 0.65 });
      
      expect(result.passed).toBe(true);
      expect(result.gateName).toBe('confidence');
      expect(result.severity).toBe('warning');
    });

    it('should pass when confidence exceeds threshold', () => {
      const result = gate.evaluate({ confidence: 0.80 });
      
      expect(result.passed).toBe(true);
      expect(result.score).toBe(0.80);
    });

    it('should fail when confidence is below threshold', () => {
      const result = gate.evaluate({ confidence: 0.50 });
      
      expect(result.passed).toBe(false);
      expect(result.severity).toBe('warning');
    });

    it('should fail when confidence is exactly at threshold - 0.01', () => {
      const result = gate.evaluate({ confidence: 0.64 });
      
      expect(result.passed).toBe(false);
    });

    it('should pass when confidence is exactly at threshold + 0.01', () => {
      const result = gate.evaluate({ confidence: 0.66 });
      
      expect(result.passed).toBe(true);
    });

    it('should handle missing confidence as 0', () => {
      const result = gate.evaluate({});
      
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should handle null confidence as 0', () => {
      const result = gate.evaluate({ confidence: null as unknown as never });
      
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should handle undefined confidence as 0', () => {
      const result = gate.evaluate({ confidence: undefined });
      
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should return correct message when passing', () => {
      const result = gate.evaluate({ confidence: 0.75 });
      
      expect(result.message).toContain('meets minimum threshold');
    });

    it('should return correct message when failing', () => {
      const result = gate.evaluate({ confidence: 0.50 });
      
      expect(result.message).toContain('below minimum threshold');
    });

    it('should use severity warning (non-blocking)', () => {
      const result = gate.evaluate({ confidence: 0.50 });
      
      expect(result.severity).toBe('warning');
    });
  });

  describe('edge cases', () => {
    it('should handle threshold of 0', () => {
      const zeroGate = new ConfidenceGate({ minThreshold: 0 });
      const result = zeroGate.evaluate({ confidence: 0 });
      
      expect(result.passed).toBe(true);
    });

    it('should handle threshold of 1', () => {
      const maxGate = new ConfidenceGate({ minThreshold: 1 });
      const result = maxGate.evaluate({ confidence: 1 });
      
      expect(result.passed).toBe(true);
    });

    it('should handle confidence above 1', () => {
      const result = gate.evaluate({ confidence: 1.5 });
      
      // Should still pass since 1.5 >= 0.65
      expect(result.passed).toBe(true);
    });

    it('should handle negative confidence', () => {
      const result = gate.evaluate({ confidence: -0.5 });
      
      expect(result.passed).toBe(false);
    });
  });
});
