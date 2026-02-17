/**
 * Unit Tests for B2B Profile Validator
 * 
 * Tests for governance validation of B2B policy profiles.
 * 
 * Story 6.3: Creer le systeme de profils policy configurables B2B
 * Framework: Vitest (unit tests for pure functions)
 */

import { describe, it, expect } from 'vitest';
import { 
  validateProfileConfig, 
  isConfigSafe, 
  getSafeBounds,
  sanitizeConfig,
  HARD_STOP_BOUNDARIES 
} from '@/server/policy/b2b-profile-validator';

describe('B2B Profile Validator', () => {
  
  describe('validateProfileConfig', () => {
    
    describe('confidenceMin validation', () => {
      
      it('should accept confidenceMin at platform minimum (0.65)', () => {
        const result = validateProfileConfig({ confidenceMin: 0.65 });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
      
      it('should accept confidenceMin above platform minimum', () => {
        const result = validateProfileConfig({ confidenceMin: 0.80 });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
      
      it('should reject confidenceMin below platform minimum', () => {
        const result = validateProfileConfig({ confidenceMin: 0.50 });
        expect(result.valid).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].field).toBe('confidenceMin');
        expect(result.errors[0].code).toBe('BELOW_MINIMUM');
        expect(result.errors[0].platformMinimum).toBe(0.65);
      });
      
      it('should reject confidenceMin above platform maximum', () => {
        const result = validateProfileConfig({ confidenceMin: 1.0 });
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('ABOVE_MAXIMUM');
      });
      
      it('should warn when confidenceMin above platform default', () => {
        const result = validateProfileConfig({ confidenceMin: 0.70 });
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
      });
    });
    
    describe('edgeMin validation', () => {
      
      it('should accept edgeMin at platform minimum (0.05)', () => {
        const result = validateProfileConfig({ edgeMin: 0.05 });
        expect(result.valid).toBe(true);
      });
      
      it('should accept edgeMin above platform minimum', () => {
        const result = validateProfileConfig({ edgeMin: 0.15 });
        expect(result.valid).toBe(true);
      });
      
      it('should reject edgeMin below platform minimum', () => {
        const result = validateProfileConfig({ edgeMin: 0.01 });
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('edgeMin');
        expect(result.errors[0].code).toBe('BELOW_MINIMUM');
        expect(result.errors[0].platformMinimum).toBe(0.05);
      });
      
      it('should reject edgeMin above platform maximum', () => {
        const result = validateProfileConfig({ edgeMin: 0.60 });
        expect(result.valid).toBe(false);
        expect(result.errors[0].code).toBe('ABOVE_MAXIMUM');
        expect(result.errors[0].platformMaximum).toBe(0.50);
      });
    });
    
    describe('maxDriftScore validation', () => {
      
      it('should accept maxDriftScore at minimum (0.0)', () => {
        const result = validateProfileConfig({ maxDriftScore: 0.0 });
        expect(result.valid).toBe(true);
      });
      
      it('should accept maxDriftScore below platform maximum', () => {
        const result = validateProfileConfig({ maxDriftScore: 0.20 });
        expect(result.valid).toBe(true);
      });
      
      it('should reject maxDriftScore above platform maximum', () => {
        const result = validateProfileConfig({ maxDriftScore: 0.50 });
        expect(result.valid).toBe(false);
        expect(result.errors[0].field).toBe('maxDriftScore');
        expect(result.errors[0].code).toBe('ABOVE_MAXIMUM');
        expect(result.errors[0].platformMaximum).toBe(0.30);
      });
    });
    
    describe('combined validation', () => {
      
      it('should accept valid configuration with all fields', () => {
        const result = validateProfileConfig({
          confidenceMin: 0.75,
          edgeMin: 0.10,
          maxDriftScore: 0.20,
        });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
      
      it('should reject configuration with multiple violations', () => {
        const result = validateProfileConfig({
          confidenceMin: 0.50,
          edgeMin: 0.01,
          maxDriftScore: 0.50,
        });
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBe(3);
      });
    });
  });
  
  describe('isConfigSafe', () => {
    
    it('should return true for valid configuration', () => {
      expect(isConfigSafe({ confidenceMin: 0.70 })).toBe(true);
    });
    
    it('should return false for invalid configuration', () => {
      expect(isConfigSafe({ confidenceMin: 0.50 })).toBe(false);
    });
    
    it('should return true for empty configuration', () => {
      expect(isConfigSafe({})).toBe(true);
    });
  });
  
  describe('getSafeBounds', () => {
    
    it('should return correct safe bounds', () => {
      const bounds = getSafeBounds();
      
      expect(bounds.confidence.min).toBe(0.65);
      expect(bounds.confidence.max).toBe(0.95);
      expect(bounds.edge.min).toBe(0.05);
      expect(bounds.edge.max).toBe(0.50);
      expect(bounds.drift.min).toBe(0.0);
      expect(bounds.drift.max).toBe(0.30);
    });
    
    it('should include platform defaults', () => {
      const bounds = getSafeBounds();
      
      expect(bounds.confidence.platformDefault).toBe(0.65);
      expect(bounds.edge.platformDefault).toBe(0.05);
      expect(bounds.drift.platformDefault).toBe(0.15);
    });
  });
  
  describe('sanitizeConfig', () => {
    
    it('should clamp values to safe bounds', () => {
      const result = sanitizeConfig({
        confidenceMin: 0.50,
        edgeMin: 0.01,
        maxDriftScore: 0.50,
      });
      
      expect(result.confidenceMin).toBe(0.65); // Clamped to minimum
      expect(result.edgeMin).toBe(0.05); // Clamped to minimum
      expect(result.maxDriftScore).toBe(0.30); // Clamped to maximum
    });
    
    it('should preserve valid values', () => {
      const result = sanitizeConfig({
        confidenceMin: 0.75,
        edgeMin: 0.15,
        maxDriftScore: 0.20,
      });
      
      expect(result.confidenceMin).toBe(0.75);
      expect(result.edgeMin).toBe(0.15);
      expect(result.maxDriftScore).toBe(0.20);
    });
    
    it('should handle partial configurations', () => {
      const result = sanitizeConfig({ confidenceMin: 0.50 });
      
      expect(result.confidenceMin).toBe(0.65);
      expect(result.edgeMin).toBeUndefined();
      expect(result.maxDriftScore).toBeUndefined();
    });
  });
  
  describe('HARD_STOP_BOUNDARIES', () => {
    
    it('should have correct confidence boundaries', () => {
      expect(HARD_STOP_BOUNDARIES.confidence.min).toBe(0.65);
      expect(HARD_STOP_BOUNDARIES.confidence.max).toBe(0.95);
    });
    
    it('should have correct edge boundaries', () => {
      expect(HARD_STOP_BOUNDARIES.edge.min).toBe(0.05);
      expect(HARD_STOP_BOUNDARIES.edge.max).toBe(0.50);
    });
    
    it('should have correct drift boundaries', () => {
      expect(HARD_STOP_BOUNDARIES.drift.min).toBe(0.0);
      expect(HARD_STOP_BOUNDARIES.drift.max).toBe(0.30);
    });
  });
});
