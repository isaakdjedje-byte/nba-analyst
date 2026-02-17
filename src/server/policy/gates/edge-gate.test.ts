/**
 * Edge Gate Unit Tests
 * 
 * Story 2.5: Policy Engine - Single Source of Truth
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { EdgeGate } from './edge-gate';
import { EdgeConfig } from '../types';

describe('EdgeGate', () => {
  let gate: EdgeGate;
  const defaultConfig: EdgeConfig = { minThreshold: 0.05 };

  beforeEach(() => {
    gate = new EdgeGate(defaultConfig);
  });

  describe('evaluate', () => {
    it('should pass when edge equals threshold', () => {
      const result = gate.evaluate({ edge: 0.05 });
      
      expect(result.passed).toBe(true);
      expect(result.gateName).toBe('edge');
      expect(result.severity).toBe('warning');
    });

    it('should pass when edge exceeds threshold', () => {
      const result = gate.evaluate({ edge: 0.10 });
      
      expect(result.passed).toBe(true);
      expect(result.score).toBe(0.10);
    });

    it('should fail when edge is below threshold', () => {
      const result = gate.evaluate({ edge: 0.02 });
      
      expect(result.passed).toBe(false);
      expect(result.severity).toBe('warning');
    });

    it('should handle missing edge as 0', () => {
      const result = gate.evaluate({});
      
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
    });

    it('should return correct message when passing', () => {
      const result = gate.evaluate({ edge: 0.08 });
      
      expect(result.message).toContain('meets minimum threshold');
    });

    it('should return correct message when failing', () => {
      const result = gate.evaluate({ edge: 0.02 });
      
      expect(result.message).toContain('below minimum threshold');
    });
  });
});
