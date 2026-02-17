/**
 * Policy Config Service Unit Tests
 * Story 5.2: Interface admin de gestion des paramètres policy
 */

import { describe, it, expect } from 'vitest';

import {
  transformConfigToParameters,
  validateParameter,
} from './policy-config-service';

// Mock the config response
const mockConfigResponse = {
  config: {
    confidence: {
      minThreshold: 0.65,
    },
    edge: {
      minThreshold: 0.05,
    },
    drift: {
      maxDriftScore: 0.15,
    },
    hardStops: {
      dailyLossLimit: 500,
      consecutiveLosses: 5,
      bankrollPercent: 0.1,
    },
  },
};

describe('policy-config-service', () => {
  describe('transformConfigToParameters', () => {
    it('should transform confidence config to parameter', () => {
      const params = transformConfigToParameters(mockConfigResponse.config);
      
      const confidenceParam = params.find(p => p.key === 'confidence.minThreshold');
      expect(confidenceParam).toBeDefined();
      expect(confidenceParam?.name).toBe('Seuil de confiance minimum');
      expect(confidenceParam?.currentValue).toBe(0.65);
      expect(confidenceParam?.category).toBe('confidence');
      expect(confidenceParam?.unit).toBe('%');
    });

    it('should transform edge config to parameter', () => {
      const params = transformConfigToParameters(mockConfigResponse.config);
      
      const edgeParam = params.find(p => p.key === 'edge.minThreshold');
      expect(edgeParam).toBeDefined();
      expect(edgeParam?.name).toBe('Seuil de valeur minimum');
      expect(edgeParam?.currentValue).toBe(0.05);
      expect(edgeParam?.category).toBe('edge');
    });

    it('should transform drift config to parameter', () => {
      const params = transformConfigToParameters(mockConfigResponse.config);
      
      const driftParam = params.find(p => p.key === 'drift.maxDriftScore');
      expect(driftParam).toBeDefined();
      expect(driftParam?.name).toBe('Score de dérive maximum');
      expect(driftParam?.currentValue).toBe(0.15);
      expect(driftParam?.category).toBe('data_quality');
    });

    it('should transform hard stop configs to parameters', () => {
      const params = transformConfigToParameters(mockConfigResponse.config);
      
      const dailyLoss = params.find(p => p.key === 'hardStops.dailyLossLimit');
      expect(dailyLoss).toBeDefined();
      expect(dailyLoss?.currentValue).toBe(500);
      expect(dailyLoss?.category).toBe('hard_stop');
      expect(dailyLoss?.unit).toBe('€');

      const consecutiveLosses = params.find(p => p.key === 'hardStops.consecutiveLosses');
      expect(consecutiveLosses).toBeDefined();
      expect(consecutiveLosses?.currentValue).toBe(5);

      const bankrollPercent = params.find(p => p.key === 'hardStops.bankrollPercent');
      expect(bankrollPercent).toBeDefined();
      expect(bankrollPercent?.currentValue).toBe(0.1);
    });

    it('should set correct min/max bounds for each parameter', () => {
      const params = transformConfigToParameters(mockConfigResponse.config);
      
      // Confidence should be 0-1 (as percentage: 0-100)
      const confidence = params.find(p => p.key === 'confidence.minThreshold');
      expect(confidence?.minValue).toBe(0);
      expect(confidence?.maxValue).toBe(1);

      // Daily loss should be 0-10000
      const dailyLoss = params.find(p => p.key === 'hardStops.dailyLossLimit');
      expect(dailyLoss?.minValue).toBe(0);
      expect(dailyLoss?.maxValue).toBe(10000);

      // Consecutive losses should be 0-20
      const consecutive = params.find(p => p.key === 'hardStops.consecutiveLosses');
      expect(consecutive?.minValue).toBe(0);
      expect(consecutive?.maxValue).toBe(20);
    });

    it('should include descriptions for all parameters', () => {
      const params = transformConfigToParameters(mockConfigResponse.config);
      
      params.forEach(param => {
        expect(param.description).toBeDefined();
        expect(param.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('validateParameter', () => {
    it('should validate valid values', () => {
      const result = validateParameter('confidence.minThreshold', 0.5, 0, 1);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject values below minimum', () => {
      const result = validateParameter('confidence.minThreshold', -0.1, 0, 1);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('La valeur minimum est 0');
    });

    it('should reject values above maximum', () => {
      const result = validateParameter('confidence.minThreshold', 1.5, 0, 1);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('La valeur maximum est 1');
    });

    it('should reject NaN values', () => {
      const result = validateParameter('confidence.minThreshold', NaN, 0, 1);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('La valeur doit être un nombre');
    });

    it('should accept boundary values', () => {
      const minResult = validateParameter('confidence.minThreshold', 0, 0, 1);
      expect(minResult.valid).toBe(true);

      const maxResult = validateParameter('confidence.minThreshold', 1, 0, 1);
      expect(maxResult.valid).toBe(true);
    });

    it('should handle different parameter keys', () => {
      const result1 = validateParameter('hardStops.dailyLossLimit', 100, 0, 10000);
      expect(result1.valid).toBe(true);

      const result2 = validateParameter('hardStops.consecutiveLosses', 3, 0, 20);
      expect(result2.valid).toBe(true);
    });
  });
});
