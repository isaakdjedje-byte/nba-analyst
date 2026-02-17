/**
 * Hard Stop Gate Unit Tests
 * 
 * CRITICAL: Tests for the blocking gate that enforces 100% hard-stop.
 * Story 2.5: Policy Engine - Single Source of Truth
 * 
 * NFR13: Hard-stop enforcement is 100% - zero exceptions allowed.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HardStopGate } from './hard-stop-gate';
import { HardStopsConfig } from '../types';

describe('HardStopGate', () => {
  let gate: HardStopGate;
  const defaultConfig: HardStopsConfig = {
    dailyLossLimit: 1000,
    consecutiveLosses: 5,
    bankrollPercent: 0.10,
  };

  beforeEach(() => {
    gate = new HardStopGate(defaultConfig);
  });

  describe('evaluate - all conditions pass', () => {
    it('should pass when all conditions are OK', () => {
      const result = gate.evaluate({
        dailyLoss: 100,
        consecutiveLosses: 2,
        bankrollPercent: 0.05,
      });
      
      expect(result.passed).toBe(true);
      expect(result.gateName).toBe('hardStop');
      expect(result.severity).toBe('blocking');
    });

    it('should pass with zero values', () => {
      const result = gate.evaluate({
        dailyLoss: 0,
        consecutiveLosses: 0,
        bankrollPercent: 0,
      });
      
      expect(result.passed).toBe(true);
    });

    it('should pass at exact threshold - 1', () => {
      const result = gate.evaluate({
        dailyLoss: 999,
        consecutiveLosses: 4,
        bankrollPercent: 0.09,
      });
      
      expect(result.passed).toBe(true);
    });
  });

  describe('evaluate - daily loss hard-stop', () => {
    it('should fail when daily loss exceeds limit', () => {
      const result = gate.evaluate({
        dailyLoss: 1001,
        consecutiveLosses: 0,
        bankrollPercent: 0,
      });
      
      expect(result.passed).toBe(false);
      expect(result.severity).toBe('blocking');
      expect(result.message).toContain('HARD-STOP TRIGGERED');
      expect(result.message).toContain('Daily loss');
    });

    it('should fail when daily loss equals limit', () => {
      const result = gate.evaluate({
        dailyLoss: 1000,
        consecutiveLosses: 0,
        bankrollPercent: 0,
      });
      
      expect(result.passed).toBe(false);
    });
  });

  describe('evaluate - consecutive losses hard-stop', () => {
    it('should fail when consecutive losses exceed limit', () => {
      const result = gate.evaluate({
        dailyLoss: 0,
        consecutiveLosses: 6,
        bankrollPercent: 0,
      });
      
      expect(result.passed).toBe(false);
      expect(result.message).toContain('Consecutive losses');
    });

    it('should fail when consecutive losses equal limit', () => {
      const result = gate.evaluate({
        dailyLoss: 0,
        consecutiveLosses: 5,
        bankrollPercent: 0,
      });
      
      expect(result.passed).toBe(false);
    });
  });

  describe('evaluate - bankroll percent hard-stop', () => {
    it('should fail when bankroll percent exceeds limit', () => {
      const result = gate.evaluate({
        dailyLoss: 0,
        consecutiveLosses: 0,
        bankrollPercent: 0.15,
      });
      
      expect(result.passed).toBe(false);
      expect(result.message).toContain('Bankroll');
    });

    it('should fail when bankroll percent equals limit', () => {
      const result = gate.evaluate({
        dailyLoss: 0,
        consecutiveLosses: 0,
        bankrollPercent: 0.10,
      });
      
      expect(result.passed).toBe(false);
    });
  });

  describe('evaluate - multiple conditions fail', () => {
    it('should report all failing conditions', () => {
      const result = gate.evaluate({
        dailyLoss: 1500,
        consecutiveLosses: 10,
        bankrollPercent: 0.25,
      });
      
      expect(result.passed).toBe(false);
      expect(result.message).toContain('Daily loss');
      expect(result.message).toContain('Consecutive losses');
      expect(result.message).toContain('Bankroll');
    });
  });

  describe('getHardStopReason', () => {
    it('should return empty string when all OK', () => {
      const reason = gate.getHardStopReason({
        dailyLoss: 100,
        consecutiveLosses: 2,
        bankrollPercent: 0.05,
      });
      
      expect(reason).toBe('');
    });

    it('should return reason when daily loss fails', () => {
      const reason = gate.getHardStopReason({
        dailyLoss: 1500,
        consecutiveLosses: 0,
        bankrollPercent: 0,
      });
      
      expect(reason).toContain('Daily loss limit exceeded');
    });
  });

  describe('getRecommendedAction', () => {
    it('should return action for daily loss exceeded', () => {
      const action = gate.getRecommendedAction({
        dailyLoss: 1500,
        consecutiveLosses: 0,
        bankrollPercent: 0,
      });
      
      expect(action).toContain('Stop betting for today');
    });

    it('should return action for consecutive losses exceeded', () => {
      const action = gate.getRecommendedAction({
        dailyLoss: 0,
        consecutiveLosses: 10,
        bankrollPercent: 0,
      });
      
      expect(action).toContain('Take a break');
    });

    it('should return action for bankroll exceeded', () => {
      const action = gate.getRecommendedAction({
        dailyLoss: 0,
        consecutiveLosses: 0,
        bankrollPercent: 0.25,
      });
      
      expect(action).toContain('Reduce stake size');
    });

    it('should return no action required when all OK', () => {
      const action = gate.getRecommendedAction({
        dailyLoss: 100,
        consecutiveLosses: 2,
        bankrollPercent: 0.05,
      });
      
      expect(action).toContain('No action required');
    });
  });

  describe('default values', () => {
    it('should treat missing values as 0', () => {
      const result = gate.evaluate({});
      
      // Missing values default to 0, which is OK
      expect(result.passed).toBe(true);
    });
  });
});
