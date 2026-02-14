/**
 * Source Health Monitor Tests
 * 
 * Tests for the SourceHealthMonitor service.
 * Story 2.7: Implement fallback strategy and degraded no-bet mode
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SourceHealthMonitor, createSourceHealthMonitor, SourceHealthCheckResult } from '@/server/ml/orchestration';

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(() => mockLogger),
};

describe('SourceHealthMonitor', () => {
  let healthCheckFn: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    vi.clearAllMocks();
    healthCheckFn = vi.fn();
  });

  describe('Initialization', () => {
    it('should initialize with healthy status for all sources', () => {
      // Arrange & Act
      const monitor = createSourceHealthMonitor(
        ['source-a', 'source-b'],
        healthCheckFn,
        mockLogger as any
      );

      // Assert
      const statuses = monitor.getAllStatuses();
      expect(statuses).toHaveLength(2);
      expect(statuses.every(s => s.isHealthy)).toBe(true);
      expect(statuses.every(s => s.consecutiveFailures === 0)).toBe(true);
    });
  });

  describe('checkSource', () => {
    it('should mark source as unhealthy when health check fails', async () => {
      // Arrange
      healthCheckFn.mockResolvedValue({
        sourceId: 'source-a',
        isHealthy: false,
        latencyMs: 100,
        error: 'Connection timeout',
      });

      const monitor = createSourceHealthMonitor(
        ['source-a'],
        healthCheckFn,
        mockLogger as any,
        { maxConsecutiveFailures: 1 }
      );

      // Act
      await monitor.checkSource('source-a');

      // Assert
      const status = monitor.getSourceStatus('source-a');
      expect(status?.isHealthy).toBe(false);
      expect(status?.consecutiveFailures).toBe(1);
      expect(status?.lastFailedAt).not.toBeNull();
    });

    it('should mark source as healthy when health check passes', async () => {
      // Arrange
      healthCheckFn.mockResolvedValue({
        sourceId: 'source-a',
        isHealthy: true,
        latencyMs: 50,
      });

      const monitor = createSourceHealthMonitor(
        ['source-a'],
        healthCheckFn,
        mockLogger as any
      );

      // Make source unhealthy first
      await monitor.checkSource('source-a');
      healthCheckFn.mockResolvedValue({
        sourceId: 'source-a',
        isHealthy: true,
        latencyMs: 50,
      });

      // Act
      await monitor.checkSource('source-a');

      // Assert
      const status = monitor.getSourceStatus('source-a');
      expect(status?.isHealthy).toBe(true);
      expect(status?.lastHealthyAt).not.toBeNull();
    });

    it('should log recovery event when source recovers', async () => {
      // Arrange
      healthCheckFn
        .mockResolvedValueOnce({
          sourceId: 'source-a',
          isHealthy: false,
          latencyMs: 100,
        })
        .mockResolvedValueOnce({
          sourceId: 'source-a',
          isHealthy: true,
          latencyMs: 50,
        });

      const monitor = createSourceHealthMonitor(
        ['source-a'],
        healthCheckFn,
        mockLogger as any,
        { maxConsecutiveFailures: 1 }
      );

      // Act
      await monitor.checkSource('source-a'); // Fail
      await monitor.checkSource('source-a'); // Recover

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceId: 'source-a',
        }),
        expect.stringContaining('Source recovered')
      );
    });
  });

  describe('areAllSourcesHealthy', () => {
    it('should return true when all sources are healthy', () => {
      // Arrange
      const monitor = createSourceHealthMonitor(
        ['source-a', 'source-b'],
        healthCheckFn,
        mockLogger as any
      );

      // Assert
      expect(monitor.areAllSourcesHealthy()).toBe(true);
    });

    it('should return false when any source is unhealthy', async () => {
      // Arrange
      healthCheckFn.mockResolvedValue({
        sourceId: 'source-a',
        isHealthy: false,
        latencyMs: 100,
      });

      const monitor = createSourceHealthMonitor(
        ['source-a', 'source-b'],
        healthCheckFn,
        mockLogger as any,
        { maxConsecutiveFailures: 1 }
      );

      // Act
      await monitor.checkSource('source-a');

      // Assert
      expect(monitor.areAllSourcesHealthy()).toBe(false);
    });
  });

  describe('getUnhealthySources', () => {
    it('should return list of unhealthy sources', async () => {
      // Arrange
      healthCheckFn.mockImplementation((sourceId: string) => 
        Promise.resolve({
          sourceId,
          isHealthy: sourceId === 'source-b',
          latencyMs: 50,
        })
      );

      const monitor = createSourceHealthMonitor(
        ['source-a', 'source-b'],
        healthCheckFn,
        mockLogger as any,
        { maxConsecutiveFailures: 1 }
      );

      // Act
      await monitor.checkSource('source-a');
      await monitor.checkSource('source-b');

      // Assert
      const unhealthy = monitor.getUnhealthySources();
      expect(unhealthy).toEqual(['source-a']);
    });
  });

  describe('validateSourceRecovery', () => {
    it('should return false if source is not in the monitor', async () => {
      // Arrange
      const monitor = createSourceHealthMonitor(
        ['source-a'],
        healthCheckFn,
        mockLogger as any
      );

      // Act & Assert
      const result = await monitor.validateSourceRecovery('unknown-source', async () => true);
      expect(result).toBe(false);
    });
  });

  describe('getRecoveryEvents', () => {
    it('should return empty array when no recoveries', () => {
      // Arrange
      const monitor = createSourceHealthMonitor(
        ['source-a'],
        healthCheckFn,
        mockLogger as any
      );

      // Assert
      const events = monitor.getRecoveryEvents();
      expect(events).toHaveLength(0);
    });

    it('should return recovery events for healthy sources that were previously failed', async () => {
      // Arrange
      healthCheckFn
        .mockResolvedValueOnce({
          sourceId: 'source-a',
          isHealthy: false,
          latencyMs: 100,
        })
        .mockResolvedValueOnce({
          sourceId: 'source-a',
          isHealthy: true,
          latencyMs: 50,
        });

      const monitor = createSourceHealthMonitor(
        ['source-a'],
        healthCheckFn,
        mockLogger as any,
        { maxConsecutiveFailures: 1 }
      );

      // Fail then recover
      await monitor.checkSource('source-a');
      await monitor.checkSource('source-a');

      // Assert
      const events = monitor.getRecoveryEvents();
      expect(events).toHaveLength(1);
      expect(events[0].sourceId).toBe('source-a');
    });
  });

  describe('resetSource', () => {
    it('should reset source to healthy state', async () => {
      // Arrange
      healthCheckFn.mockResolvedValue({
        sourceId: 'source-a',
        isHealthy: false,
        latencyMs: 100,
      });

      const monitor = createSourceHealthMonitor(
        ['source-a'],
        healthCheckFn,
        mockLogger as any
      );

      // Make unhealthy
      await monitor.checkSource('source-a');
      expect(monitor.getSourceStatus('source-a')?.isHealthy).toBe(false);

      // Act
      monitor.resetSource('source-a');

      // Assert
      const status = monitor.getSourceStatus('source-a');
      expect(status?.isHealthy).toBe(true);
      expect(status?.consecutiveFailures).toBe(0);
      expect(status?.lastFailedAt).toBeNull();
    });
  });
});

describe('createSourceHealthMonitor', () => {
  it('should create monitor with default options', () => {
    // Act
    const monitor = createSourceHealthMonitor(
      ['source-a'],
      vi.fn(),
      mockLogger as any
    );

    // Assert
    const statuses = monitor.getAllStatuses();
    expect(statuses).toHaveLength(1);
    expect(statuses[0].isHealthy).toBe(true);
  });

  it('should create monitor with custom options', () => {
    // Act
    const monitor = createSourceHealthMonitor(
      ['source-a', 'source-b'],
      vi.fn(),
      mockLogger as any,
      {
        checkIntervalMs: 30000,
        maxConsecutiveFailures: 5,
        recoveryThresholdMs: 600000,
      }
    );

    // Assert
    const statuses = monitor.getAllStatuses();
    expect(statuses).toHaveLength(2);
  });
});
