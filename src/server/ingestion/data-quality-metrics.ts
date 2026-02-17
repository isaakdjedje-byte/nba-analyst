/**
 * Data Quality Metrics Service
 * Tracks and reports data quality metrics across the ingestion pipeline
 *
 * Metrics tracked:
 * - Validation pass/fail rates
 * - Drift detection frequency
 * - Provider health scores
 * - Data completeness rates
 * - Latency percentiles
 */

export interface DataQualityMetrics {
  timestamp: Date;
  provider: string;
  
  // Validation metrics
  validation: {
    totalRequests: number;
    passedRequests: number;
    failedRequests: number;
    passRate: number;
    averageValidationTime: number;
  };
  
  // Drift detection metrics
  drift: {
    totalChecks: number;
    driftDetected: number;
    driftRate: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  
  // Provider health metrics
  health: {
    uptime: number; // Percentage
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    errorRate: number;
    circuitBreakerOpenings: number;
  };
  
  // Data completeness
  completeness: {
    requiredFieldsPresent: number;
    optionalFieldsPresent: number;
    totalFields: number;
    completenessScore: number; // 0-1
  };
}

interface ProviderMetrics {
  validation: {
    total: number;
    passed: number;
    failed: number;
    times: number[];
  };
  drift: {
    total: number;
    detected: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  health: {
    requests: number;
    errors: number;
    latencies: number[];
    circuitBreakerOpenings: number;
  };
  completeness: {
    requiredPresent: number;
    optionalPresent: number;
    totalFields: number;
  };
  startTime: number;
}

export class DataQualityMetricsService {
  private metrics: Map<string, ProviderMetrics> = new Map();
  private readonly maxLatencySamples = 1000;
  private readonly windowMs: number;

  constructor(windowMinutes = 60) {
    this.windowMs = windowMinutes * 60 * 1000;
    // Clean up old metrics every 5 minutes
    setInterval(() => this.cleanupOldMetrics(), 5 * 60 * 1000);
  }

  /**
   * Record validation result
   */
  recordValidation(
    provider: string,
    success: boolean,
    durationMs: number
  ): void {
    const metrics = this.getOrCreateMetrics(provider);
    metrics.validation.total++;
    
    if (success) {
      metrics.validation.passed++;
    } else {
      metrics.validation.failed++;
    }
    
    metrics.validation.times.push(durationMs);
    
    // Keep only recent samples
    if (metrics.validation.times.length > this.maxLatencySamples) {
      metrics.validation.times = metrics.validation.times.slice(-this.maxLatencySamples);
    }
  }

  /**
   * Record drift detection
   */
  recordDrift(
    provider: string,
    driftDetected: boolean,
    severity?: 'none' | 'low' | 'medium' | 'high' | 'critical'
  ): void {
    const metrics = this.getOrCreateMetrics(provider);
    metrics.drift.total++;
    
    if (driftDetected && severity) {
      metrics.drift.detected++;
      metrics.drift.bySeverity[severity]++;
    }
  }

  /**
   * Record health check
   */
  recordHealthCheck(
    provider: string,
    success: boolean,
    latencyMs: number
  ): void {
    const metrics = this.getOrCreateMetrics(provider);
    metrics.health.requests++;
    
    if (!success) {
      metrics.health.errors++;
    }
    
    metrics.health.latencies.push(latencyMs);
    
    // Keep only recent samples
    if (metrics.health.latencies.length > this.maxLatencySamples) {
      metrics.health.latencies = metrics.health.latencies.slice(-this.maxLatencySamples);
    }
  }

  /**
   * Record circuit breaker opening
   */
  recordCircuitBreakerOpen(provider: string): void {
    const metrics = this.getOrCreateMetrics(provider);
    metrics.health.circuitBreakerOpenings++;
  }

  /**
   * Record data completeness
   */
  recordCompleteness(
    provider: string,
    requiredPresent: number,
    optionalPresent: number,
    totalFields: number
  ): void {
    const metrics = this.getOrCreateMetrics(provider);
    metrics.completeness.requiredPresent += requiredPresent;
    metrics.completeness.optionalPresent += optionalPresent;
    metrics.completeness.totalFields += totalFields;
  }

  /**
   * Get metrics for a specific provider
   */
  getMetrics(provider: string): DataQualityMetrics | null {
    const metrics = this.metrics.get(provider);
    if (!metrics) return null;

    return this.calculateMetrics(provider, metrics);
  }

  /**
   * Get metrics for all providers
   */
  getAllMetrics(): Record<string, DataQualityMetrics> {
    const result: Record<string, DataQualityMetrics> = {};
    
    for (const [provider, metrics] of this.metrics) {
      result[provider] = this.calculateMetrics(provider, metrics);
    }
    
    return result;
  }

  /**
   * Get summary across all providers
   */
  getSummary(): {
    totalProviders: number;
    avgPassRate: number;
    avgDriftRate: number;
    avgErrorRate: number;
    avgCompleteness: number;
  } {
    const allMetrics = this.getAllMetrics();
    const providers = Object.values(allMetrics);
    
    if (providers.length === 0) {
      return {
        totalProviders: 0,
        avgPassRate: 0,
        avgDriftRate: 0,
        avgErrorRate: 0,
        avgCompleteness: 0,
      };
    }

    const totalPassRate = providers.reduce((sum, m) => sum + m.validation.passRate, 0);
    const totalDriftRate = providers.reduce((sum, m) => sum + m.drift.driftRate, 0);
    const totalErrorRate = providers.reduce((sum, m) => sum + m.health.errorRate, 0);
    const totalCompleteness = providers.reduce((sum, m) => sum + m.completeness.completenessScore, 0);

    return {
      totalProviders: providers.length,
      avgPassRate: totalPassRate / providers.length,
      avgDriftRate: totalDriftRate / providers.length,
      avgErrorRate: totalErrorRate / providers.length,
      avgCompleteness: totalCompleteness / providers.length,
    };
  }

  /**
   * Reset metrics for a provider
   */
  resetProvider(provider: string): void {
    this.metrics.delete(provider);
  }

  /**
   * Reset all metrics
   */
  resetAll(): void {
    this.metrics.clear();
  }

  /**
   * Check if provider meets SLA
   */
  checkSLA(
    provider: string,
    sla: {
      minPassRate?: number;
      maxDriftRate?: number;
      maxErrorRate?: number;
      minCompleteness?: number;
    }
  ): {
    compliant: boolean;
    violations: string[];
  } {
    const metrics = this.getMetrics(provider);
    if (!metrics) {
      return {
        compliant: false,
        violations: ['No metrics available'],
      };
    }

    const violations: string[] = [];

    if (sla.minPassRate !== undefined && metrics.validation.passRate < sla.minPassRate) {
      violations.push(`Pass rate ${(metrics.validation.passRate * 100).toFixed(1)}% < ${(sla.minPassRate * 100).toFixed(1)}%`);
    }

    if (sla.maxDriftRate !== undefined && metrics.drift.driftRate > sla.maxDriftRate) {
      violations.push(`Drift rate ${(metrics.drift.driftRate * 100).toFixed(1)}% > ${(sla.maxDriftRate * 100).toFixed(1)}%`);
    }

    if (sla.maxErrorRate !== undefined && metrics.health.errorRate > sla.maxErrorRate) {
      violations.push(`Error rate ${(metrics.health.errorRate * 100).toFixed(1)}% > ${(sla.maxErrorRate * 100).toFixed(1)}%`);
    }

    if (sla.minCompleteness !== undefined && metrics.completeness.completenessScore < sla.minCompleteness) {
      violations.push(`Completeness ${(metrics.completeness.completenessScore * 100).toFixed(1)}% < ${(sla.minCompleteness * 100).toFixed(1)}%`);
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  private getOrCreateMetrics(provider: string): ProviderMetrics {
    if (!this.metrics.has(provider)) {
      this.metrics.set(provider, {
        validation: { total: 0, passed: 0, failed: 0, times: [] },
        drift: {
          total: 0,
          detected: 0,
          bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        },
        health: { requests: 0, errors: 0, latencies: [], circuitBreakerOpenings: 0 },
        completeness: { requiredPresent: 0, optionalPresent: 0, totalFields: 0 },
        startTime: Date.now(),
      });
    }
    return this.metrics.get(provider)!;
  }

  private calculateMetrics(
    provider: string,
    metrics: ProviderMetrics
  ): DataQualityMetrics {
    // Calculate percentiles
    const sortedLatencies = [...metrics.health.latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedLatencies.length * 0.95);
    const p99Index = Math.floor(sortedLatencies.length * 0.99);

    // Calculate uptime
    const now = Date.now();
    const uptimeDuration = now - metrics.startTime;
    const uptime = uptimeDuration > 0
      ? ((uptimeDuration - (metrics.health.errors * 5000)) / uptimeDuration) * 100
      : 100;

    // Calculate average validation time
    const avgValidationTime = metrics.validation.times.length > 0
      ? metrics.validation.times.reduce((a, b) => a + b, 0) / metrics.validation.times.length
      : 0;

    // Calculate average latency
    const avgLatency = sortedLatencies.length > 0
      ? sortedLatencies.reduce((a, b) => a + b, 0) / sortedLatencies.length
      : 0;

    return {
      timestamp: new Date(),
      provider,
      validation: {
        totalRequests: metrics.validation.total,
        passedRequests: metrics.validation.passed,
        failedRequests: metrics.validation.failed,
        passRate: metrics.validation.total > 0
          ? metrics.validation.passed / metrics.validation.total
          : 0,
        averageValidationTime: avgValidationTime,
      },
      drift: {
        totalChecks: metrics.drift.total,
        driftDetected: metrics.drift.detected,
        driftRate: metrics.drift.total > 0
          ? metrics.drift.detected / metrics.drift.total
          : 0,
        bySeverity: { ...metrics.drift.bySeverity },
      },
      health: {
        uptime: Math.max(0, uptime),
        averageLatency: avgLatency,
        p95Latency: sortedLatencies[p95Index] || 0,
        p99Latency: sortedLatencies[p99Index] || 0,
        errorRate: metrics.health.requests > 0
          ? metrics.health.errors / metrics.health.requests
          : 0,
        circuitBreakerOpenings: metrics.health.circuitBreakerOpenings,
      },
      completeness: {
        requiredFieldsPresent: metrics.completeness.requiredPresent,
        optionalFieldsPresent: metrics.completeness.optionalPresent,
        totalFields: metrics.completeness.totalFields,
        completenessScore: metrics.completeness.totalFields > 0
          ? (metrics.completeness.requiredPresent + metrics.completeness.optionalPresent * 0.5) / metrics.completeness.totalFields
          : 0,
      },
    };
  }

  private cleanupOldMetrics(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    for (const [provider, metrics] of this.metrics) {
      if (metrics.startTime < cutoff) {
        this.metrics.delete(provider);
      }
    }
  }
}

// Global instance
export const dataQualityMetrics = new DataQualityMetricsService();
