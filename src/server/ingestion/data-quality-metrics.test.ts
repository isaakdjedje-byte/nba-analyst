import { describe, it, expect, beforeEach } from 'vitest';
import { DataQualityMetricsService } from './data-quality-metrics';

describe('Data Quality Metrics Service', () => {
  let service: DataQualityMetricsService;

  beforeEach(() => {
    service = new DataQualityMetricsService(1); // 1 minute window for tests
  });

  describe('validation metrics', () => {
    it('should record successful validation', () => {
      service.recordValidation('nba-cdn', true, 100);
      
      const metrics = service.getMetrics('nba-cdn');
      expect(metrics).not.toBeNull();
      expect(metrics!.validation.totalRequests).toBe(1);
      expect(metrics!.validation.passedRequests).toBe(1);
      expect(metrics!.validation.failedRequests).toBe(0);
      expect(metrics!.validation.passRate).toBe(1);
    });

    it('should record failed validation', () => {
      service.recordValidation('nba-cdn', true, 100);
      service.recordValidation('nba-cdn', false, 150);
      
      const metrics = service.getMetrics('nba-cdn');
      expect(metrics!.validation.totalRequests).toBe(2);
      expect(metrics!.validation.passedRequests).toBe(1);
      expect(metrics!.validation.failedRequests).toBe(1);
      expect(metrics!.validation.passRate).toBe(0.5);
    });

    it('should calculate average validation time', () => {
      service.recordValidation('nba-cdn', true, 100);
      service.recordValidation('nba-cdn', true, 200);
      service.recordValidation('nba-cdn', true, 300);
      
      const metrics = service.getMetrics('nba-cdn');
      expect(metrics!.validation.averageValidationTime).toBe(200);
    });
  });

  describe('drift metrics', () => {
    it('should record no drift', () => {
      service.recordDrift('nba-cdn', false);
      
      const metrics = service.getMetrics('nba-cdn');
      expect(metrics!.drift.totalChecks).toBe(1);
      expect(metrics!.drift.driftDetected).toBe(0);
      expect(metrics!.drift.driftRate).toBe(0);
    });

    it('should record drift by severity', () => {
      service.recordDrift('nba-cdn', true, 'low');
      service.recordDrift('nba-cdn', true, 'medium');
      service.recordDrift('nba-cdn', true, 'critical');
      
      const metrics = service.getMetrics('nba-cdn');
      expect(metrics!.drift.totalChecks).toBe(3);
      expect(metrics!.drift.driftDetected).toBe(3);
      expect(metrics!.drift.driftRate).toBe(1);
      expect(metrics!.drift.bySeverity.low).toBe(1);
      expect(metrics!.drift.bySeverity.medium).toBe(1);
      expect(metrics!.drift.bySeverity.critical).toBe(1);
    });
  });

  describe('health metrics', () => {
    it('should record successful health check', () => {
      service.recordHealthCheck('nba-cdn', true, 100);
      
      const metrics = service.getMetrics('nba-cdn');
      expect(metrics!.health.errorRate).toBe(0);
      expect(metrics!.health.averageLatency).toBe(100);
    });

    it('should record failed health check', () => {
      service.recordHealthCheck('nba-cdn', false, 500);
      
      const metrics = service.getMetrics('nba-cdn');
      expect(metrics!.health.errorRate).toBe(1);
    });

    it('should calculate latency percentiles', () => {
      // Record 100 latencies from 1 to 100
      for (let i = 1; i <= 100; i++) {
        service.recordHealthCheck('nba-cdn', true, i);
      }
      
      const metrics = service.getMetrics('nba-cdn');
      // p95 is the value at 95th percentile (index 94 in 0-indexed array)
      // p99 is the value at 99th percentile (index 98 in 0-indexed array)
      expect(metrics!.health.p95Latency).toBeGreaterThanOrEqual(94);
      expect(metrics!.health.p95Latency).toBeLessThanOrEqual(96);
      expect(metrics!.health.p99Latency).toBeGreaterThanOrEqual(98);
      expect(metrics!.health.p99Latency).toBeLessThanOrEqual(100);
    });

    it('should track circuit breaker openings', () => {
      service.recordCircuitBreakerOpen('nba-cdn');
      service.recordCircuitBreakerOpen('nba-cdn');
      
      const metrics = service.getMetrics('nba-cdn');
      expect(metrics!.health.circuitBreakerOpenings).toBe(2);
    });
  });

  describe('completeness metrics', () => {
    it('should record completeness', () => {
      service.recordCompleteness('nba-cdn', 8, 2, 10);
      
      const metrics = service.getMetrics('nba-cdn');
      expect(metrics!.completeness.requiredFieldsPresent).toBe(8);
      expect(metrics!.completeness.optionalFieldsPresent).toBe(2);
      expect(metrics!.completeness.totalFields).toBe(10);
    });

    it('should calculate completeness score', () => {
      // 8 required + 2 optional (weighted 0.5) = 9 / 10 = 0.9
      service.recordCompleteness('nba-cdn', 8, 2, 10);
      
      const metrics = service.getMetrics('nba-cdn');
      expect(metrics!.completeness.completenessScore).toBe(0.9);
    });
  });

  describe('all providers', () => {
    it('should return metrics for all providers', () => {
      service.recordValidation('nba-cdn', true, 100);
      service.recordValidation('espn', true, 150);
      service.recordValidation('odds-primary', false, 200);
      
      const allMetrics = service.getAllMetrics();
      expect(Object.keys(allMetrics)).toHaveLength(3);
      expect(allMetrics['nba-cdn']).toBeDefined();
      expect(allMetrics['espn']).toBeDefined();
      expect(allMetrics['odds-primary']).toBeDefined();
    });
  });

  describe('summary', () => {
    it('should calculate summary across providers', () => {
      service.recordValidation('nba-cdn', true, 100);
      service.recordValidation('nba-cdn', true, 100);
      service.recordValidation('espn', true, 100);
      service.recordValidation('espn', false, 100);
      
      const summary = service.getSummary();
      expect(summary.totalProviders).toBe(2);
      expect(summary.avgPassRate).toBe(0.75); // (1 + 0.5) / 2
    });

    it('should return zero summary when no providers', () => {
      const summary = service.getSummary();
      expect(summary.totalProviders).toBe(0);
      expect(summary.avgPassRate).toBe(0);
    });
  });

  describe('SLA checking', () => {
    beforeEach(() => {
      // Setup: 80% pass rate, 5% drift, 10% error, 85% completeness
      for (let i = 0; i < 80; i++) {
        service.recordValidation('nba-cdn', true, 100);
      }
      for (let i = 0; i < 20; i++) {
        service.recordValidation('nba-cdn', false, 100);
      }
      
      service.recordDrift('nba-cdn', true, 'low');
      for (let i = 0; i < 19; i++) {
        service.recordDrift('nba-cdn', false);
      }
      
      for (let i = 0; i < 90; i++) {
        service.recordHealthCheck('nba-cdn', true, 100);
      }
      for (let i = 0; i < 10; i++) {
        service.recordHealthCheck('nba-cdn', false, 100);
      }
      
      service.recordCompleteness('nba-cdn', 8, 2, 10);
    });

    it('should pass SLA when all thresholds met', () => {
      const result = service.checkSLA('nba-cdn', {
        minPassRate: 0.75,
        maxDriftRate: 0.1,
        maxErrorRate: 0.15,
        minCompleteness: 0.8,
      });
      
      expect(result.compliant).toBe(true);
      expect(result.violations).toHaveLength(0);
    });

    it('should fail SLA when pass rate too low', () => {
      const result = service.checkSLA('nba-cdn', {
        minPassRate: 0.85,
      });
      
      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.includes('Pass rate'))).toBe(true);
    });

    it('should fail SLA when error rate too high', () => {
      const result = service.checkSLA('nba-cdn', {
        maxErrorRate: 0.05,
      });
      
      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.includes('Error rate'))).toBe(true);
    });

    it('should fail SLA when completeness too low', () => {
      const result = service.checkSLA('nba-cdn', {
        minCompleteness: 0.95,
      });
      
      expect(result.compliant).toBe(false);
      expect(result.violations.some(v => v.includes('Completeness'))).toBe(true);
    });

    it('should return violation for non-existent provider', () => {
      const result = service.checkSLA('non-existent', {});
      expect(result.compliant).toBe(false);
      expect(result.violations).toContain('No metrics available');
    });
  });

  describe('reset', () => {
    it('should reset provider metrics', () => {
      service.recordValidation('nba-cdn', true, 100);
      expect(service.getMetrics('nba-cdn')).not.toBeNull();
      
      service.resetProvider('nba-cdn');
      expect(service.getMetrics('nba-cdn')).toBeNull();
    });

    it('should reset all metrics', () => {
      service.recordValidation('nba-cdn', true, 100);
      service.recordValidation('espn', true, 100);
      
      service.resetAll();
      
      expect(service.getMetrics('nba-cdn')).toBeNull();
      expect(service.getMetrics('espn')).toBeNull();
    });
  });
});
