/**
 * Hard Stop Tracker - State Management
 * 
 * Tracks hard-stop state across daily runs with persistence.
 * Story 2.6: Implements state tracking for hard-stop gates.
 * 
 * CRITICAL: Hard-stop enforcement is 100% - zero exceptions (NFR13)
 * This tracker maintains state across the daily run and persists to database.
 */

import { PrismaClient } from '@prisma/client';
import { HardStopsConfig } from './types';

export interface HardStopStateData {
  isActive: boolean;
  dailyLoss: number;
  consecutiveLosses: number;
  bankrollPercent: number;
  lastResetAt: Date;
  triggeredAt?: Date;
  triggerReason?: string;
}

export interface HardStopStateInput {
  isActive: boolean;
  dailyLoss: number;
  consecutiveLosses: number;
  bankrollPercent: number;
  lastResetAt: Date;
  triggeredAt?: Date;
  triggerReason?: string;
}

/**
 * Hard Stop Tracker
 * 
 * Manages hard-stop state across daily runs with database persistence.
 * Tracks:
 * - Daily loss accumulation
 * - Consecutive loss count
 * - Bankroll percentage at risk
 */
export class HardStopTracker {
  private prisma: PrismaClient;
  private config: HardStopsConfig;
  private state: HardStopStateData;
  private currentBankroll: number = 0;
  
  // In-memory cache for performance (synced with DB)
  private initialized: boolean = false;

  constructor(config: HardStopsConfig, prisma: PrismaClient) {
    this.config = config;
    this.prisma = prisma;
    
    // Initialize with default state
    this.state = {
      isActive: false,
      dailyLoss: 0,
      consecutiveLosses: 0,
      bankrollPercent: 0,
      lastResetAt: new Date(),
    };
  }

  /**
   * Initialize tracker by loading state from database
   * Must be called before using the tracker
   */
  async initialize(): Promise<void> {
    // Check for existing state in database
    const existingState = await this.prisma.hardStopState.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (existingState) {
      this.state = {
        isActive: existingState.isActive,
        dailyLoss: existingState.dailyLoss,
        consecutiveLosses: existingState.consecutiveLosses,
        bankrollPercent: existingState.bankrollPercent,
        lastResetAt: existingState.lastResetAt,
        triggeredAt: existingState.triggeredAt ?? undefined,
        triggerReason: existingState.triggerReason ?? undefined,
      };
      
      // Check if we need to reset for a new day
      await this.checkDailyReset();
    } else {
      // Create initial state in database
      await this.prisma.hardStopState.create({
        data: {
          isActive: false,
          dailyLoss: 0,
          consecutiveLosses: 0,
          bankrollPercent: 0,
          lastResetAt: new Date(),
        },
      });
    }

    this.initialized = true;
  }

  /**
   * Check if we need to reset for a new day
   * Resets daily loss and bankroll tracking at midnight UTC
   */
  private async checkDailyReset(): Promise<void> {
    const now = new Date();
    const lastReset = new Date(this.state.lastResetAt);
    
    // Reset if last reset was on a different day (UTC)
    if (lastReset.toISOString().split('T')[0] !== now.toISOString().split('T')[0]) {
      // Reset daily-specific values but preserve consecutive losses
      this.state.dailyLoss = 0;
      this.state.bankrollPercent = 0;
      this.state.lastResetAt = now;
      
      // If hard-stop was not active, keep it that way
      // If it was active, check if conditions still apply
      
      await this.persistState();
    }
  }

  /**
   * Check if hard-stop is currently active
   */
  async isActive(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    // Re-check daily reset in case time passed
    await this.checkDailyReset();
    
    return this.state.isActive;
  }

  /**
   * Get current hard-stop state
   */
  async getState(): Promise<HardStopStateData> {
    if (!this.initialized) {
      await this.initialize();
    }
    
    return { ...this.state };
  }

  /**
   * Update state after each decision
   * 
   * @param decisionStatus - The decision status (PICK, NO_BET, HARD_STOP)
   * @param outcome - The outcome of the bet (WIN, LOSS) - only for PICK decisions
   * @param currentBankroll - Current bankroll amount
   */
  async updateAfterDecision(
    decisionStatus: 'PICK' | 'NO_BET' | 'HARD_STOP',
    outcome?: 'WIN' | 'LOSS',
    currentBankroll?: number
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const wasActive = this.state.isActive;

    // If already active, no updates needed
    if (wasActive) {
      return;
    }

    // Update based on decision outcome
    if (decisionStatus === 'HARD_STOP') {
      // Already handled by activate()
      return;
    }

    // Update consecutive losses
    if (outcome === 'LOSS') {
      this.state.consecutiveLosses += 1;
    } else if (outcome === 'WIN') {
      // Reset consecutive losses on win
      this.state.consecutiveLosses = 0;
    }

    // Update bankroll percent
    if (currentBankroll !== undefined && currentBankroll > 0) {
      this.state.bankrollPercent = this.state.dailyLoss / currentBankroll;
    }

    // Check if hard-stop should trigger
    await this.checkAndActivate();

    // Persist state
    await this.persistState();
  }

  /**
   * Update daily loss amount
   * Call this after each loss to accumulate daily loss
   */
  async updateDailyLoss(amount: number): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (this.state.isActive) {
      return;
    }

    this.state.dailyLoss += amount;
    
    // Update bankroll percent after daily loss changes
    this.updateBankrollPercent();

    // Check if hard-stop should trigger
    await this.checkAndActivate();

    // Persist state
    await this.persistState();
  }

  /**
   * Set the current bankroll (for percentage calculation)
   */
  setBankroll(currentBankroll: number): void {
    this.currentBankroll = currentBankroll;
    if (currentBankroll > 0 && this.state.dailyLoss > 0) {
      this.state.bankrollPercent = this.state.dailyLoss / currentBankroll;
    }
  }

  /**
   * Update bankroll and recalculate percentage
   */
  private updateBankrollPercent(): void {
    if (this.currentBankroll > 0) {
      this.state.bankrollPercent = this.state.dailyLoss / this.currentBankroll;
    }
  }

  /**
   * Check if hard-stop conditions are met and activate if needed
   */
  private async checkAndActivate(): Promise<void> {
    const { dailyLossLimit, consecutiveLosses: maxConsecutive, bankrollPercent: maxBankrollPercent } = this.config;

    // Check each condition
    const reasons: string[] = [];
    
    if (this.state.dailyLoss >= dailyLossLimit) {
      reasons.push(`Daily loss limit exceeded (€${this.state.dailyLoss} >= €${dailyLossLimit})`);
    }
    
    if (this.state.consecutiveLosses >= maxConsecutive) {
      reasons.push(`Consecutive losses limit exceeded (${this.state.consecutiveLosses} >= ${maxConsecutive})`);
    }
    
    if (this.state.bankrollPercent >= maxBankrollPercent) {
      reasons.push(`Bankroll limit exceeded (${(this.state.bankrollPercent * 100).toFixed(1)}% >= ${(maxBankrollPercent * 100).toFixed(1)}%)`);
    }

    // Activate hard-stop if any condition met
    if (reasons.length > 0) {
      await this.activate(reasons.join('; '));
    }
  }

  /**
   * Activate hard-stop
   */
  async activate(reason: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    this.state.isActive = true;
    this.state.triggeredAt = new Date();
    this.state.triggerReason = reason;

    await this.persistState();
  }

  /**
   * Reset state (admin action with audit)
   */
  async reset(reason: string, actorId: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const previousState = { ...this.state };

    // Reset state
    this.state = {
      isActive: false,
      dailyLoss: 0,
      consecutiveLosses: 0,
      bankrollPercent: 0,
      lastResetAt: new Date(),
    };

    await this.persistState();

    // Log to audit trail
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'HARD_STOP_RESET',
        targetType: 'POLICY',
        oldValue: JSON.stringify(previousState),
        newValue: JSON.stringify({ reason, resetBy: actorId }),
        metadata: JSON.stringify({ reason }),
        traceId: `hardstop-reset-${Date.now()}`,
      },
    });
  }

  /**
   * Get recommended action based on current state
   */
  getRecommendedAction(): string {
    if (!this.state.isActive) {
      return 'Continue betting according to normal rules.';
    }

    const actions: string[] = [];

    if (this.state.triggerReason?.includes('Daily loss')) {
      actions.push('Stop betting for today. Review daily loss limit.');
    }
    
    if (this.state.triggerReason?.includes('Consecutive')) {
      actions.push('Take a break after consecutive losses. Do not chase losses.');
    }
    
    if (this.state.triggerReason?.includes('Bankroll')) {
      actions.push('Reduce stake size. Bankroll risk is too high.');
    }

    // Add admin contact info
    if (actions.length > 0) {
      actions.push('Contact ops to review risk parameters or wait for daily reset at midnight UTC.');
    }

    return actions.join(' ') || 'Contact ops to review risk parameters.';
  }

  /**
   * Get current limits (for API response)
   */
  getLimits(): { dailyLossLimit: number; consecutiveLosses: number; bankrollPercent: number } {
    return {
      dailyLossLimit: this.config.dailyLossLimit,
      consecutiveLosses: this.config.consecutiveLosses,
      bankrollPercent: this.config.bankrollPercent,
    };
  }

  /**
   * Persist state to database
   */
  private async persistState(): Promise<void> {
    // Update or create the latest state record
    const latestState = await this.prisma.hardStopState.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (latestState) {
      await this.prisma.hardStopState.update({
        where: { id: latestState.id },
        data: {
          isActive: this.state.isActive,
          dailyLoss: this.state.dailyLoss,
          consecutiveLosses: this.state.consecutiveLosses,
          bankrollPercent: this.state.bankrollPercent,
          lastResetAt: this.state.lastResetAt,
          triggeredAt: this.state.triggeredAt,
          triggerReason: this.state.triggerReason,
          updatedAt: new Date(),
        },
      });
    } else {
      await this.prisma.hardStopState.create({
        data: {
          isActive: this.state.isActive,
          dailyLoss: this.state.dailyLoss,
          consecutiveLosses: this.state.consecutiveLosses,
          bankrollPercent: this.state.bankrollPercent,
          lastResetAt: this.state.lastResetAt,
          triggeredAt: this.state.triggeredAt,
          triggerReason: this.state.triggerReason,
        },
      });
    }
  }

  /**
   * Get state for API response
   */
  async getApiResponse(): Promise<{
    isActive: boolean;
    triggeredAt?: string;
    triggerReason?: string;
    currentState: {
      dailyLoss: number;
      consecutiveLosses: number;
      bankrollPercent: number;
    };
    limits: {
      dailyLossLimit: number;
      consecutiveLosses: number;
      bankrollPercent: number;
    };
    recommendedAction: string;
  }> {
    const state = await this.getState();
    const limits = this.getLimits();

    return {
      isActive: state.isActive,
      triggeredAt: state.triggeredAt?.toISOString(),
      triggerReason: state.triggerReason,
      currentState: {
        dailyLoss: state.dailyLoss,
        consecutiveLosses: state.consecutiveLosses,
        bankrollPercent: state.bankrollPercent,
      },
      limits,
      recommendedAction: this.getRecommendedAction(),
    };
  }
}

/**
 * Factory function to create HardStopTracker
 */
export function createHardStopTracker(config: HardStopsConfig, prisma: PrismaClient): HardStopTracker {
  return new HardStopTracker(config, prisma);
}
