/**
 * ATDD E2E Tests for Story 5-1: BlockCausePanel Integration
 * 
 * TDD RED PHASE: These tests will FAIL until integrations are implemented
 * 
 * Pending Integrations:
 * - Task 2.3: Integrate BlockCausePanel into decision investigation view (story 4-4)
 * - Task 2.4: Integrate BlockCausePanel into Logs view when viewing blocked decisions
 * 
 * Acceptance Criteria from Story 5-1:
 * - AC1: Display specific cause and recommended action
 * - AC2: Show threshold values, current vs limit
 * - AC3: Reference to policy rule
 * - AC4: Data quality metrics display
 * - AC5: Expandable technical details section
 */

import { test, expect } from '@playwright/test';
import { faker } from '@faker-js/faker';

// ============================================
// DATA FACTORY: BlockCause Test Data
// ============================================

type BlockCauseCategory = 'bankroll_limit' | 'data_quality' | 'model_confidence' | 'drift_detection' | 'service_unavailable';

interface BlockCauseData {
  decisionId: string;
  ruleName: string;
  ruleDescription: string;
  triggeredAt: string;
  currentValue: number;
  threshold: number;
  recommendation: string;
  category: BlockCauseCategory;
  relatedPolicyId?: string;
  dataQualityMetrics?: Array<{
    metric: string;
    value: number;
    threshold: number;
  }>;
}

function createBlockedDecision(overrides: Partial<BlockCauseData> = {}): BlockCauseData {
  const category = overrides.category || 'bankroll_limit';
  
  const categoryConfigs: Record<BlockCauseCategory, { ruleName: string; ruleDescription: string; recommendation: string }> = {
    bankroll_limit: {
      ruleName: 'HARD_STOP_BANKROLL_LIMIT',
      ruleDescription: 'Bankroll limit exceeded for the current period',
      recommendation: 'Wait for next period reset or contact support to increase limit',
    },
    data_quality: {
      ruleName: 'HARD_STOP_DATA_QUALITY',
      ruleDescription: 'Data quality gate failed - insufficient source reliability',
      recommendation: 'Retry when data sources are more reliable or contact data team',
    },
    model_confidence: {
      ruleName: 'HARD_STOP_MODEL_CONFIDENCE',
      ruleDescription: 'Model confidence below minimum threshold',
      recommendation: 'Model retraining required before generating new predictions',
    },
    drift_detection: {
      ruleName: 'HARD_STOP_DRIFT_DETECTED',
      ruleDescription: 'Significant drift detected in model predictions',
      recommendation: 'Review model performance and consider retraining',
    },
    service_unavailable: {
      ruleName: 'HARD_STOP_SERVICE_UNAVAILABLE',
      ruleDescription: 'External service temporarily unavailable',
      recommendation: 'Retry prediction when service is restored',
    },
  };

  const config = categoryConfigs[category];

  return {
    decisionId: faker.string.uuid(),
    ruleName: config.ruleName,
    ruleDescription: config.ruleDescription,
    triggeredAt: new Date().toISOString(),
    currentValue: faker.number.int({ min: 100, max: 2000 }),
    threshold: faker.number.int({ min: 50, max: 500 }),
    recommendation: config.recommendation,
    category,
    relatedPolicyId: `POLICY-${category.toUpperCase()}-001`,
    ...overrides,
  };
}

// ============================================
// TESTS: Investigation View Integration (Task 2.3)
// ============================================

test.describe('BlockCausePanel Integration - Investigation View (Task 2.3)', () => {
  
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('/api/auth/signin');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/picks');
  });

  test('[P1] AC1: should display block cause panel in investigation detail for blocked decisions', async ({ page }) => {
    // Given: A blocked decision exists in the investigation view
    const blockedDecision = createBlockedDecision({ category: 'bankroll_limit' });
    
    // Mock the API response for block cause
    await page.route('**/api/v1/decisions/*/block-cause', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: blockedDecision,
          meta: {
            traceId: `block-cause-${Date.now()}`,
            timestamp: new Date().toISOString(),
          },
        }),
      });
    });

    // When: I navigate to investigation detail for a blocked decision
    await page.goto(`/dashboard/investigation/${blockedDecision.decisionId}`);

    // Then: The BlockCausePanel should be visible
    await expect(page.getByTestId('block-cause-panel')).toBeVisible();
  });

  test('[P1] AC1: should display rule name in block cause panel', async ({ page }) => {
    const blockedDecision = createBlockedDecision({ 
      category: 'data_quality',
      ruleName: 'HARD_STOP_DATA_QUALITY',
    });
    
    await page.route('**/api/v1/decisions/*/block-cause', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: blockedDecision,
          meta: { traceId: 'test', timestamp: new Date().toISOString() },
        }),
      });
    });

    await page.goto(`/dashboard/investigation/${blockedDecision.decisionId}`);

    // Then: Rule name should be displayed
    await expect(page.getByText('HARD_STOP_DATA_QUALITY')).toBeVisible();
  });

  test('[P1] AC1: should display recommended action in block cause panel', async ({ page }) => {
    const blockedDecision = createBlockedDecision({ 
      recommendation: 'Wait for next period reset or contact support',
    });
    
    await page.route('**/api/v1/decisions/*/block-cause', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: blockedDecision,
          meta: { traceId: 'test', timestamp: new Date().toISOString() },
        }),
      });
    });

    await page.goto(`/dashboard/investigation/${blockedDecision.decisionId}`);

    // Then: Recommendation should be displayed
    await expect(page.getByText('Wait for next period reset or contact support')).toBeVisible();
  });

  test('[P1] AC2: should display threshold values and current vs limit', async ({ page }) => {
    const blockedDecision = createBlockedDecision({ 
      currentValue: 1500,
      threshold: 1000,
    });
    
    await page.route('**/api/v1/decisions/*/block-cause', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: blockedDecision,
          meta: { traceId: 'test', timestamp: new Date().toISOString() },
        }),
      });
    });

    await page.goto(`/dashboard/investigation/${blockedDecision.decisionId}`);

    // Then: Current value and threshold should be visible
    await expect(page.getByText(/1500/)).toBeVisible();
    await expect(page.getByText(/1000/)).toBeVisible();
    
    // And: Progress bar should show percentage
    const progressBar = page.getByRole('progressbar');
    await expect(progressBar).toBeVisible();
  });

  test('[P2] AC3: should display related policy reference', async ({ page }) => {
    const blockedDecision = createBlockedDecision({ 
      relatedPolicyId: 'POLICY-BANKROLL-001',
    });
    
    await page.route('**/api/v1/decisions/*/block-cause', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: blockedDecision,
          meta: { traceId: 'test', timestamp: new Date().toISOString() },
        }),
      });
    });

    await page.goto(`/dashboard/investigation/${blockedDecision.decisionId}`);

    // When: User expands technical details
    await page.getByText(/détails techniques/i).click();

    // Then: Policy reference should be visible
    await expect(page.getByText('POLICY-BANKROLL-001')).toBeVisible();
  });

  test('[P2] AC4: should display data quality metrics for data quality blocks', async ({ page }) => {
    const blockedDecision = createBlockedDecision({
      category: 'data_quality',
      dataQualityMetrics: [
        { metric: 'Data Freshness', value: 0.75, threshold: 0.9 },
        { metric: 'Source Reliability', value: 0.85, threshold: 0.85 },
      ],
    });
    
    await page.route('**/api/v1/decisions/*/block-cause', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: blockedDecision,
          meta: { traceId: 'test', timestamp: new Date().toISOString() },
        }),
      });
    });

    await page.goto(`/dashboard/investigation/${blockedDecision.decisionId}`);

    // Then: Data quality metrics should be visible
    await expect(page.getByText('Data Freshness')).toBeVisible();
    await expect(page.getByText('Source Reliability')).toBeVisible();
  });

  test('[P2] AC5: should have expandable technical details section', async ({ page }) => {
    const blockedDecision = createBlockedDecision();
    
    await page.route('**/api/v1/decisions/*/block-cause', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: blockedDecision,
          meta: { traceId: 'test', timestamp: new Date().toISOString() },
        }),
      });
    });

    await page.goto(`/dashboard/investigation/${blockedDecision.decisionId}`);

    // Then: Expand button should be visible
    const expandButton = page.getByText(/détails techniques/i);
    await expect(expandButton).toBeVisible();
    
    // When: User clicks expand
    await expandButton.click();
    
    // Then: Triggered date should be visible
    await expect(page.getByText(/triggeredAt|déclenché/i)).toBeVisible();
  });
});

// ============================================
// TESTS: Logs View Integration (Task 2.4)
// ============================================

test.describe('BlockCausePanel Integration - Logs View (Task 2.4)', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/api/auth/signin');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/picks');
  });

  test('[P1] should display block cause panel when viewing blocked decision in logs', async ({ page }) => {
    // Given: A blocked decision in logs
    const blockedDecision = createBlockedDecision({ category: 'bankroll_limit' });
    
    // Mock the logs API to return blocked decision
    await page.route('**/api/v1/logs**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: blockedDecision.decisionId,
              status: 'Hard-Stop',
              matchId: 'match-001',
              createdAt: new Date().toISOString(),
            },
          ],
          meta: { traceId: 'test', timestamp: new Date().toISOString() },
        }),
      });
    });

    // Mock block cause API
    await page.route('**/api/v1/decisions/*/block-cause', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: blockedDecision,
          meta: { traceId: 'test', timestamp: new Date().toISOString() },
        }),
      });
    });

    // When: I navigate to logs and view a blocked decision
    await page.goto('/dashboard/logs');
    await page.waitForSelector('[data-testid="log-entry"]');
    
    // Click on blocked decision entry
    const hardStopEntry = page.locator('[data-testid="log-entry"]').filter({ hasText: 'Hard-Stop' }).first();
    await hardStopEntry.click();

    // Then: BlockCausePanel should be visible in detail panel
    await expect(page.getByTestId('block-cause-panel')).toBeVisible();
  });

  test('[P1] should show block cause for hard-stop status in logs detail', async ({ page }) => {
    const blockedDecision = createBlockedDecision({ 
      ruleName: 'HARD_STOP_DRIFT_DETECTED',
    });
    
    await page.route('**/api/v1/logs**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{ id: blockedDecision.decisionId, status: 'Hard-Stop' }],
          meta: { traceId: 'test', timestamp: new Date().toISOString() },
        }),
      });
    });

    await page.route('**/api/v1/decisions/*/block-cause', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: blockedDecision,
          meta: { traceId: 'test', timestamp: new Date().toISOString() },
        }),
      });
    });

    await page.goto('/dashboard/logs');
    await page.waitForSelector('[data-testid="log-entry"]');
    
    const entry = page.locator('[data-testid="log-entry"]').filter({ hasText: 'Hard-Stop' }).first();
    await entry.click();

    // Then: Rule name should be displayed
    await expect(page.getByText('HARD_STOP_DRIFT_DETECTED')).toBeVisible();
  });

  test('[P2] should filter logs to show only blocked decisions', async ({ page }) => {
    // When: I filter logs by Hard-Stop status
    await page.goto('/dashboard/logs');
    
    const statusFilter = page.getByTestId('logs-status-filter');
    await statusFilter.selectOption('hard-stop');

    // Then: Only hard-stop decisions should be visible
    const entries = page.locator('[data-testid="log-entry"]');
    const count = await entries.count();
    
    for (let i = 0; i < count; i++) {
      const entry = entries.nth(i);
      await expect(entry.locator('[data-testid="log-entry-status"]')).toHaveText('Hard-Stop');
    }
  });

  test('[P2] should display block cause in logs detail panel with all AC', async ({ page }) => {
    const blockedDecision = createBlockedDecision({
      category: 'model_confidence',
      currentValue: 0.55,
      threshold: 0.75,
    });
    
    await page.route('**/api/v1/logs**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{ id: blockedDecision.decisionId, status: 'Hard-Stop' }],
          meta: { traceId: 'test', timestamp: new Date().toISOString() },
        }),
      });
    });

    await page.route('**/api/v1/decisions/*/block-cause', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: blockedDecision,
          meta: { traceId: 'test', timestamp: new Date().toISOString() },
        }),
      });
    });

    await page.goto('/dashboard/logs');
    await page.waitForSelector('[data-testid="log-entry"]');
    
    const entry = page.locator('[data-testid="log-entry"]').filter({ hasText: 'Hard-Stop' }).first();
    await entry.click();

    // AC1: Rule name and recommendation
    await expect(page.getByText(/HARD_STOP_MODEL_CONFIDENCE/)).toBeVisible();
    
    // AC2: Current value and threshold
    await expect(page.getByText(/0\.55/)).toBeVisible();
    await expect(page.getByText(/0\.75/)).toBeVisible();
  });
});

// ============================================
// ACCESSIBILITY TESTS
// ============================================

test.describe('BlockCausePanel Accessibility', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/api/auth/signin');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard/picks');
  });

  test('[P2] should have proper ARIA attributes on block cause panel', async ({ page }) => {
    const blockedDecision = createBlockedDecision();
    
    await page.route('**/api/v1/decisions/*/block-cause', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: blockedDecision,
          meta: { traceId: 'test', timestamp: new Date().toISOString() },
        }),
      });
    });

    await page.goto(`/dashboard/investigation/${blockedDecision.decisionId}`);

    // Then: Panel should have correct role
    const panel = page.getByTestId('block-cause-panel');
    await expect(panel).toHaveAttribute('role', 'region');
    
    // And: Category should be indicated
    await expect(panel).toHaveAttribute('data-category');
  });

  test('[P3] should be keyboard navigable', async ({ page }) => {
    const blockedDecision = createBlockedDecision();
    
    await page.route('**/api/v1/decisions/*/block-cause', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: blockedDecision,
          meta: { traceId: 'test', timestamp: new Date().toISOString() },
        }),
      });
    });

    await page.goto(`/dashboard/investigation/${blockedDecision.decisionId}`);

    // Then: Should be able to tab to expand button
    await page.keyboard.press('Tab');
    const expandButton = page.getByText(/détails techniques/i);
    await expect(expandButton).toBeFocused();
  });
});
