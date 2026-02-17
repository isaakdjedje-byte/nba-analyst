/**
 * E2E Test Fixtures - BlockCause
 * Fixture for BlockCause integration tests
 * 
 * Story: 5.1 - Créer le panneau d'affichage des causes de blocage policy
 * 
 * Provides:
 * - Mock blocked decision data
 * - API route interception helpers
 * - Test data cleanup
 */

import { test as base, APIRequestContext } from '@playwright/test';
import { 
  createBlockCause, 
  createBankrollBlockCause,
  createDataQualityBlockCause,
  createModelConfidenceBlockCause,
  createDriftBlockCause,
  createServiceUnavailableBlockCause,
  createThresholdExceededBlockCause,
  type BlockCause,
  type BlockCauseCategory,
  type BlockCauseOverrides
} from '../../factories/block-cause-factory';

/**
 * Extended test type with BlockCause fixtures
 */
export const test = base.extend<{
  /**
   * Create a block cause with default values
   */
  createBlockCause: (overrides?: BlockCauseOverrides) => BlockCause;
  
  /**
   * Create a bankroll-related block cause
   */
  createBankrollBlockCause: (overrides?: BlockCauseOverrides) => BlockCause;
  
  /**
   * Create a data quality-related block cause
   */
  createDataQualityBlockCause: (overrides?: BlockCauseOverrides) => BlockCause;
  
  /**
   * Create a model confidence block cause
   */
  createModelConfidenceBlockCause: (overrides?: BlockCauseOverrides) => BlockCause;
  
  /**
   * Create a drift detection block cause
   */
  createDriftBlockCause: (overrides?: BlockCauseOverrides) => BlockCause;
  
  /**
   * Create a service unavailable block cause
   */
  createServiceUnavailableBlockCause: (overrides?: BlockCauseOverrides) => BlockCause;
  
  /**
   * Create a block cause where threshold is exceeded
   */
  createThresholdExceededBlockCause: (exceedByPercent?: number, overrides?: BlockCauseOverrides) => BlockCause;
  
  /**
   * Mock block cause API endpoint for a decision
   */
  mockBlockCauseApi: (decisionId: string, blockCause: BlockCause) => Promise<void>;
  
  /**
   * Setup mock for investigation page with blocked decision
   */
  setupInvestigationWithBlockedDecision: (decisionId: string, blockCause: BlockCause) => Promise<void>;
  
  /**
   * Setup mock for logs page with blocked decisions
   */
  setupLogsWithBlockedDecisions: (blockedDecisions: Array<{ id: string; status: string }>) => Promise<void>;
}>({
  createBlockCause: async ({}, use) => {
    await use((overrides) => createBlockCause(overrides));
  },
  
  createBankrollBlockCause: async ({}, use) => {
    await use((overrides) => createBankrollBlockCause(overrides));
  },
  
  createDataQualityBlockCause: async ({}, use) => {
    await use((overrides) => createDataQualityBlockCause(overrides));
  },
  
  createModelConfidenceBlockCause: async ({}, use) => {
    await use((overrides) => createModelConfidenceBlockCause(overrides));
  },
  
  createDriftBlockCause: async ({}, use) => {
    await use((overrides) => createDriftBlockCause(overrides));
  },
  
  createServiceUnavailableBlockCause: async ({}, use) => {
    await use((overrides) => createServiceUnavailableBlockCause(overrides));
  },
  
  createThresholdExceededBlockCause: async ({}, use) => {
    await use((exceedByPercent, overrides) => 
      createThresholdExceededBlockCause(exceedByPercent, overrides)
    );
  },
  
  mockBlockCauseApi: async ({ page }, use) => {
    const mockFn = async (decisionId: string, blockCause: BlockCause) => {
      await page.route(`**/api/v1/decisions/${decisionId}/block-cause`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: blockCause,
            meta: {
              traceId: `block-cause-${Date.now()}`,
              timestamp: new Date().toISOString(),
            },
          }),
        });
      });
    };
    await use(mockFn);
  },
  
  setupInvestigationWithBlockedDecision: async ({ page }, use) => {
    const setupFn = async (decisionId: string, blockCause: BlockCause) => {
      // Mock the block cause API
      await page.route(`**/api/v1/decisions/${decisionId}/block-cause`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: blockCause,
            meta: {
              traceId: `block-cause-${Date.now()}`,
              timestamp: new Date().toISOString(),
            },
          }),
        });
      });
      
      // Mock the investigation detail API
      await page.route(`**/api/v1/investigations/${decisionId}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              id: decisionId,
              status: 'Hard-Stop',
              traceId: `trace-${decisionId}`,
              createdAt: new Date().toISOString(),
            },
            meta: {
              traceId: `investigation-${Date.now()}`,
              timestamp: new Date().toISOString(),
            },
          }),
        });
      });
    };
    await use(setupFn);
  },
  
  setupLogsWithBlockedDecisions: async ({ page }, use) => {
    const setupFn = async (blockedDecisions: Array<{ id: string; status: string }>) => {
      await page.route('**/api/v1/logs**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: blockedDecisions,
            meta: {
              traceId: `logs-${Date.now()}`,
              timestamp: new Date().toISOString(),
            },
          }),
        });
      });
    };
    await use(setupFn);
  },
});

/**
 * Export block cause types for use in tests
 */
export { BlockCause, BlockCauseCategory, BlockCauseOverrides };

/**
 * Predefined block cause scenarios for common test cases
 */
export const BlockCauseScenarios = {
  bankrollExceeded: () => createBankrollBlockCause(),
  dataQualityFailed: () => createDataQualityBlockCause(),
  lowConfidence: () => createModelConfidenceBlockCause(),
  driftDetected: () => createDriftBlockCause(),
  serviceDown: () => createServiceUnavailableBlockCause(),
  thresholdExceeded: (percent = 50) => createThresholdExceededBlockCause(percent),
} as const;
