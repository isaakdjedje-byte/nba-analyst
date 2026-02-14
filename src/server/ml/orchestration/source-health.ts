/**
 * Source Health Monitor
 * 
 * Monitors data source health and detects recovery after failures.
 * Story 2.7: Implement fallback strategy and degraded no-bet mode
 */

import { Logger } from 'pino';

// ============================================
// Types
// ============================================

export interface SourceHealthStatus {
  sourceId: string;
  isHealthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  lastHealthyAt: Date | null;
  lastFailedAt: Date | null;
  recoveryEventLogged: boolean;
}

export interface SourceHealthConfig {
  sourceId: string;
  checkIntervalMs: number;
  maxConsecutiveFailures: number;
  recoveryThresholdMs: number;
}

export interface SourceHealthCheckResult {
  sourceId: string;
  isHealthy: boolean;
  latencyMs: number;
  error?: string;
}

// ============================================
// Source Health Monitor
// ============================================

export class SourceHealthMonitor {
  private sources: Map<string, SourceHealthStatus> = new Map();
  private readonly logger: Logger;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: SourceHealthConfig[],
    private readonly healthCheckFn: (sourceId: string) => Promise<SourceHealthCheckResult>,
    logger: Logger
  ) {
    this.logger = logger.child({ component: 'SourceHealthMonitor' });
    
    // Initialize sources
    for (const cfg of config) {
      this.sources.set(cfg.sourceId, {
        sourceId: cfg.sourceId,
        isHealthy: true,
        lastCheck: new Date(),
        consecutiveFailures: 0,
        lastHealthyAt: new Date(),
        lastFailedAt: null,
        recoveryEventLogged: false,
      });
    }
  }

  /**
   * Start continuous health monitoring
   */
  start(): void {
    if (this.checkInterval) {
      this.logger.warn('Health monitor already running');
      return;
    }

    const intervalMs = Math.min(...this.config.map(c => c.checkIntervalMs));
    
    this.checkInterval = setInterval(() => {
      this.checkAllSources().catch(err => {
        this.logger.error({ error: err }, 'Error checking sources');
      });
    }, intervalMs);

    this.logger.info({ intervalMs }, 'Source health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.logger.info('Source health monitoring stopped');
    }
  }

  /**
   * Check health of all sources
   */
  async checkAllSources(): Promise<Map<string, SourceHealthStatus>> {
    for (const sourceId of this.sources.keys()) {
      await this.checkSource(sourceId);
    }
    return this.sources;
  }

  /**
   * Check health of a specific source
   */
  async checkSource(sourceId: string): Promise<SourceHealthStatus | null> {
    const status = this.sources.get(sourceId);
    if (!status) {
      this.logger.warn({ sourceId }, 'Unknown source');
      return null;
    }

    const config = this.config.find(c => c.sourceId === sourceId);
    if (!config) {
      return status;
    }

    try {
      const result = await this.healthCheckFn(sourceId);
      const now = new Date();

      if (result.isHealthy) {
        // Check for recovery
        const wasUnhealthy = !status.isHealthy;
        
        status.consecutiveFailures = 0;
        status.lastHealthyAt = now;
        status.lastCheck = now;
        status.isHealthy = true;

        // Log recovery event if source was previously unhealthy
        if (wasUnhealthy && !status.recoveryEventLogged) {
          this.logger.info(
            {
              sourceId,
              lastFailedAt: status.lastFailedAt,
              recoveryTimeMs: now.getTime() - (status.lastFailedAt?.getTime() || now.getTime()),
            },
            'Source recovered - data quality validation in progress'
          );
          status.recoveryEventLogged = true;
        }
      } else {
        status.consecutiveFailures++;
        status.lastCheck = now;
        status.isHealthy = false;
        status.recoveryEventLogged = false;

        if (status.consecutiveFailures >= config.maxConsecutiveFailures) {
          status.lastFailedAt = now;
          this.logger.warn(
            { sourceId, consecutiveFailures: status.consecutiveFailures },
            'Source marked as unhealthy'
          );
        }
      }
    } catch (error) {
      this.logger.error({ sourceId, error }, 'Health check failed');
      status.consecutiveFailures++;
      status.lastCheck = new Date();
      status.isHealthy = false;
    }

    this.sources.set(sourceId, status);
    return status;
  }

  /**
   * Get health status for a source
   */
  getSourceStatus(sourceId: string): SourceHealthStatus | null {
    return this.sources.get(sourceId) || null;
  }

  /**
   * Get all source statuses
   */
  getAllStatuses(): SourceHealthStatus[] {
    return Array.from(this.sources.values());
  }

  /**
   * Check if all sources are healthy
   */
  areAllSourcesHealthy(): boolean {
    return Array.from(this.sources.values()).every(s => s.isHealthy);
  }

  /**
   * Get list of unhealthy sources
   */
  getUnhealthySources(): string[] {
    return Array.from(this.sources.entries())
      .filter(([, status]) => !status.isHealthy)
      .map(([sourceId]) => sourceId);
  }

  /**
   * Validate if recovered source has stable quality
   */
  async validateSourceRecovery(sourceId: string, qualityCheckFn: () => Promise<boolean>): Promise<boolean> {
    const status = this.sources.get(sourceId);
    if (!status) {
      return false;
    }

    const config = this.config.find(c => c.sourceId === sourceId);
    if (!config) {
      return false;
    }

    // Wait for recovery threshold
    const timeSinceFailure = status.lastFailedAt 
      ? Date.now() - status.lastFailedAt.getTime()
      : 0;

    if (timeSinceFailure < config.recoveryThresholdMs) {
      this.logger.debug(
        { sourceId, timeSinceFailure, threshold: config.recoveryThresholdMs },
        'Recovery validation pending - waiting for threshold'
      );
      return false;
    }

    // Validate quality
    const qualityValid = await qualityCheckFn();
    
    if (qualityValid) {
      this.logger.info({ sourceId }, 'Source recovery validated - normal operation resumed');
      status.recoveryEventLogged = false; // Reset for next failure
      this.sources.set(sourceId, status);
    }

    return qualityValid;
  }

  /**
   * Reset source health status
   */
  resetSource(sourceId: string): void {
    const status = this.sources.get(sourceId);
    if (status) {
      status.isHealthy = true;
      status.consecutiveFailures = 0;
      status.lastHealthyAt = new Date();
      status.lastFailedAt = null;
      status.recoveryEventLogged = false;
      this.sources.set(sourceId, status);
      this.logger.info({ sourceId }, 'Source health reset');
    }
  }

  /**
   * Get recovery events for audit
   */
  getRecoveryEvents(): Array<{ sourceId: string; recoveredAt: Date; previousFailureAt: Date }> {
    const events: Array<{ sourceId: string; recoveredAt: Date; previousFailureAt: Date }> = [];
    
    for (const [sourceId, status] of this.sources.entries()) {
      if (status.isHealthy && status.lastFailedAt && status.lastHealthyAt) {
        events.push({
          sourceId,
          recoveredAt: status.lastHealthyAt,
          previousFailureAt: status.lastFailedAt,
        });
      }
    }

    return events;
  }
}

// ============================================
// Factory
// ============================================

export interface SourceHealthMonitorOptions {
  checkIntervalMs?: number;
  maxConsecutiveFailures?: number;
  recoveryThresholdMs?: number;
}

/**
 * Create a source health monitor with default configuration
 */
export function createSourceHealthMonitor(
  sourceIds: string[],
  healthCheckFn: (sourceId: string) => Promise<SourceHealthCheckResult>,
  logger: Logger,
  options: SourceHealthMonitorOptions = {}
): SourceHealthMonitor {
  const config: SourceHealthConfig[] = sourceIds.map(sourceId => ({
    sourceId,
    checkIntervalMs: options.checkIntervalMs || 60000, // 1 minute default
    maxConsecutiveFailures: options.maxConsecutiveFailures || 3,
    recoveryThresholdMs: options.recoveryThresholdMs || 300000, // 5 minutes default
  }));

  return new SourceHealthMonitor(config, healthCheckFn, logger);
}
