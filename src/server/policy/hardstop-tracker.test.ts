/**
 * Hard Stop Tracker Unit Tests
 * 
 * Tests for the HardStopTracker class.
 * Story 2.6: Unit tests for hard-stop state management.
 * 
 * CRITICAL: Tests verify 100% hard-stop enforcement (NFR13).
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HardStopTracker, HardStopStateData } from '@/server/policy/hardstop-tracker';
import { HardStopsConfig } from '@/server/policy/types';

// Mock Prisma client
const mockPrisma = {
  hardStopState: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

describe('HardStopTracker', () => {
  let tracker: HardStopTracker;
  const config: HardStopsConfig = {
    dailyLossLimit: 1000,
    consecutiveLosses: 5,
    bankrollPercent: 0.10,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    mockPrisma.hardStopState.findFirst.mockResolvedValue(null);
    mockPrisma.hardStopState.create.mockResolvedValue({
      id: 'test-id',
      isActive: false,
      dailyLoss: 0,
      consecutiveLosses: 0,
      bankrollPercent: 0,
      lastResetAt: new Date(),
      triggeredAt: null,
      triggerReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.hardStopState.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});
    
    tracker = new HardStopTracker(config, mockPrisma as any);
  });

  describe('Initialization', () => {
    it('should initialize with default state when no existing state', async () => {
      await tracker.initialize();
      
      expect(mockPrisma.hardStopState.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isActive: false,
          dailyLoss: 0,
          consecutiveLosses: 0,
          bankrollPercent: 0,
        }),
      });
    });

    it('should load existing state from database', async () => {
      const existingState = {
        id: 'existing-id',
        isActive: true,
        dailyLoss: 1200,
        consecutiveLosses: 6,
        bankrollPercent: 0.15,
        lastResetAt: new Date(),
        triggeredAt: new Date(),
        triggerReason: 'Daily loss limit exceeded',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.hardStopState.findFirst.mockResolvedValue(existingState);
      
      const state = await tracker.getState();
      
      expect(state.isActive).toBe(true);
      expect(state.dailyLoss).toBe(1200);
      expect(state.consecutiveLosses).toBe(6);
      expect(state.bankrollPercent).toBe(0.15);
    });
  });

  describe('isActive()', () => {
    it('should return false when hard-stop is not active', async () => {
      await tracker.initialize();
      
      const isActive = await tracker.isActive();
      
      expect(isActive).toBe(false);
    });

    it('should return true when hard-stop is active', async () => {
      const existingState = {
        id: 'existing-id',
        isActive: true,
        dailyLoss: 1200,
        consecutiveLosses: 6,
        bankrollPercent: 0.15,
        lastResetAt: new Date(),
        triggeredAt: new Date(),
        triggerReason: 'Daily loss limit exceeded',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      mockPrisma.hardStopState.findFirst.mockResolvedValue(existingState);
      
      const isActive = await tracker.isActive();
      
      expect(isActive).toBe(true);
    });
  });

  describe('updateDailyLoss()', () => {
    it('should accumulate daily loss', async () => {
      await tracker.initialize();
      
      await tracker.updateDailyLoss(500);
      
      const state = await tracker.getState();
      expect(state.dailyLoss).toBe(500);
    });

    it('should not update when hard-stop is already active', async () => {
      // Pre-activate hard-stop
      await tracker.activate('Test reason');
      
      // Try to update daily loss
      await tracker.updateDailyLoss(500);
      
      const state = await tracker.getState();
      // Should still be 0 since it was already active
      expect(state.dailyLoss).toBe(0);
    });
  });

  describe('updateAfterDecision()', () => {
    it('should increment consecutive losses on LOSS outcome', async () => {
      await tracker.initialize();
      
      await tracker.updateAfterDecision('PICK', 'LOSS');
      
      const state = await tracker.getState();
      expect(state.consecutiveLosses).toBe(1);
    });

    it('should reset consecutive losses on WIN outcome', async () => {
      // First lose
      await tracker.initialize();
      await tracker.updateAfterDecision('PICK', 'LOSS');
      await tracker.updateAfterDecision('PICK', 'LOSS');
      
      // Then win
      await tracker.updateAfterDecision('PICK', 'WIN');
      
      const state = await tracker.getState();
      expect(state.consecutiveLosses).toBe(0);
    });

    it('should not update when decision is HARD_STOP', async () => {
      await tracker.initialize();
      
      await tracker.updateAfterDecision('HARD_STOP');
      
      const state = await tracker.getState();
      // consecutiveLosses should remain 0
      expect(state.consecutiveLosses).toBe(0);
    });
  });

  describe('activate()', () => {
    it('should activate hard-stop with reason', async () => {
      await tracker.initialize();
      
      await tracker.activate('Daily loss limit exceeded');
      
      const state = await tracker.getState();
      
      expect(state.isActive).toBe(true);
      expect(state.triggerReason).toBe('Daily loss limit exceeded');
      expect(state.triggeredAt).toBeDefined();
    });
  });

  describe('reset()', () => {
    it('should reset hard-stop state', async () => {
      // First activate
      await tracker.initialize();
      await tracker.activate('Daily loss limit exceeded');
      
      // Then reset
      await tracker.reset('Admin reset', 'admin-user-id');
      
      const state = await tracker.getState();
      
      expect(state.isActive).toBe(false);
      expect(state.dailyLoss).toBe(0);
      expect(state.consecutiveLosses).toBe(0);
    });

    it('should create audit log entry on reset', async () => {
      await tracker.initialize();
      await tracker.activate('Test reason');
      
      await tracker.reset('Admin reset', 'admin-user-id');
      
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorId: 'admin-user-id',
          action: 'HARD_STOP_RESET',
          targetType: 'POLICY',
        }),
      });
    });
  });

  describe('getRecommendedAction()', () => {
    it('should return continue message when not active', async () => {
      await tracker.initialize();
      
      const action = tracker.getRecommendedAction();
      
      expect(action).toContain('Continue');
    });

    it('should return stop message when active', async () => {
      await tracker.initialize();
      await tracker.activate('Daily loss limit exceeded');
      
      const action = tracker.getRecommendedAction();
      
      expect(action).toContain('Stop betting');
      expect(action).toContain('Contact ops');
    });
  });

  describe('Bankroll percentage calculation', () => {
    it('should calculate bankroll percentage correctly when set separately', async () => {
      await tracker.initialize();
      
      // First set the bankroll
      tracker.setBankroll(10000);
      
      // Then update daily loss
      await tracker.updateDailyLoss(500);
      
      const state = await tracker.getState();
      
      // 500 / 10000 = 0.05 = 5%
      expect(state.bankrollPercent).toBe(0.05);
    });

    it('should trigger hard-stop when bankroll percent AT limit (>= comparison)', async () => {
      // Set bankroll to 10000 (so 10% = 1000)
      tracker.setBankroll(10000);
      
      await tracker.initialize();
      
      // Add exactly 1000 loss (10% - at limit)
      await tracker.updateDailyLoss(1000);
      
      const state = await tracker.getState();
      
      // Hard-stop should be active (>= comparison matches gate)
      expect(state.isActive).toBe(true);
      expect(state.triggerReason).toContain('Bankroll');
    });

    it('should trigger hard-stop when bankroll percent EXCEEDS limit', async () => {
      // Set bankroll to 10000 (so 10% = 1000)
      tracker.setBankroll(10000);
      
      await tracker.initialize();
      
      // Add 1100 loss (11% - over 10% limit)
      await tracker.updateDailyLoss(1100);
      
      const state = await tracker.getState();
      
      // Hard-stop should be active
      expect(state.isActive).toBe(true);
    });
  });

  describe('Hard-stop triggers at EXACT limit (boundary tests)', () => {
    it('should trigger at exactly daily loss limit (>= comparison)', async () => {
      await tracker.initialize();
      
      // Add exactly 1000 (limit is 1000, so >= triggers)
      await tracker.updateDailyLoss(1000);
      
      const state = await tracker.getState();
      
      // Should be active (>= comparison matches gate behavior)
      expect(state.isActive).toBe(true);
    });

    it('should trigger when daily loss EXCEEDS limit (> comparison)', async () => {
      await tracker.initialize();
      
      // Add 1001 (over 1000 limit)
      await tracker.updateDailyLoss(1001);
      
      const state = await tracker.getState();
      
      // Should be active
      expect(state.isActive).toBe(true);
    });

    it('should NOT trigger when BELOW daily loss limit', async () => {
      await tracker.initialize();
      
      // Add 999 (below 1000 limit)
      await tracker.updateDailyLoss(999);
      
      const state = await tracker.getState();
      
      // Should NOT be active
      expect(state.isActive).toBe(false);
    });

    it('should trigger at exactly consecutive losses limit (>= comparison)', async () => {
      await tracker.initialize();
      
      // Add exactly 5 losses (limit is 5, so >= triggers)
      for (let i = 0; i < 5; i++) {
        await tracker.updateAfterDecision('PICK', 'LOSS');
      }
      
      const state = await tracker.getState();
      
      // Should be active (>= comparison matches gate behavior)
      expect(state.isActive).toBe(true);
    });

    it('should trigger when EXCEEDS consecutive losses limit', async () => {
      await tracker.initialize();
      
      // Add 6 losses (over 5 limit)
      for (let i = 0; i < 6; i++) {
        await tracker.updateAfterDecision('PICK', 'LOSS');
      }
      
      const state = await tracker.getState();
      
      // Should be active
      expect(state.isActive).toBe(true);
    });

    it('should NOT trigger when BELOW consecutive losses limit', async () => {
      await tracker.initialize();
      
      // Add 4 losses (below 5 limit)
      for (let i = 0; i < 4; i++) {
        await tracker.updateAfterDecision('PICK', 'LOSS');
      }
      
      const state = await tracker.getState();
      
      // Should NOT be active
      expect(state.isActive).toBe(false);
    });

    it('should trigger at exactly bankroll percent limit (>= comparison)', async () => {
      tracker.setBankroll(10000); // 10% = 1000
      await tracker.initialize();
      
      // Add exactly 1000 (10% - at limit)
      await tracker.updateDailyLoss(1000);
      
      const state = await tracker.getState();
      
      // Should be active (>= comparison matches gate behavior)
      expect(state.isActive).toBe(true);
    });

    it('should trigger when EXCEEDS bankroll percent limit', async () => {
      tracker.setBankroll(10000); // 10% = 1000
      await tracker.initialize();
      
      // Add 1001 (> 10%)
      await tracker.updateDailyLoss(1001);
      
      const state = await tracker.getState();
      
      // Should be active
      expect(state.isActive).toBe(true);
    });

    it('should NOT trigger when BELOW bankroll percent limit', async () => {
      tracker.setBankroll(10000); // 10% = 1000
      await tracker.initialize();
      
      // Add 999 (< 10%)
      await tracker.updateDailyLoss(999);
      
      const state = await tracker.getState();
      
      // Should NOT be active
      expect(state.isActive).toBe(false);
    });
  });
});
