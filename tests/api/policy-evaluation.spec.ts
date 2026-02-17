import { test, expect } from '@playwright/test';

test.describe('Policy Evaluation API @api @policy', () => {
  test('[P0] should evaluate Pick when all gates pass @smoke @p0', async ({ request }) => {
    const response = await request.post('/api/policy/evaluate', {
      data: {
        modelOutputs: {
          confidence: 0.75,
          edge: 0.05,
          drift: 0.05,
        },
      },
    });
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('Pick');
    expect(body.gates.confidenceGate).toBe('passed');
    expect(body.gates.edgeGate).toBe('passed');
    expect(body.gates.driftGate).toBe('passed');
    expect(body.rationale).toBe('All gates passed');
    expect(body.evaluatedAt).toBeTruthy();
  });

  test('[P0] should return No-Bet when confidence gate fails @smoke @p0', async ({ request }) => {
    const response = await request.post('/api/policy/evaluate', {
      data: {
        modelOutputs: {
          confidence: 0.3,
          edge: 0.05,
          drift: 0.05,
        },
      },
    });
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('No-Bet');
    expect(body.gates.confidenceGate).toBe('failed');
    expect(body.rationale).toContain('confidence');
  });

  test('[P0] should return No-Bet when edge gate fails @smoke @p0', async ({ request }) => {
    const response = await request.post('/api/policy/evaluate', {
      data: {
        modelOutputs: {
          confidence: 0.75,
          edge: 0.01,
          drift: 0.05,
        },
      },
    });
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('No-Bet');
    expect(body.gates.edgeGate).toBe('failed');
    expect(body.rationale).toContain('edge');
  });

  test('[P1] should validate modelOutputs is required @validation @p1', async ({ request }) => {
    const response = await request.post('/api/policy/evaluate', {
      data: {},
    });
    
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('modelOutputs');
  });

  test('[P1] should handle drift threshold @p1', async ({ request }) => {
    const response = await request.post('/api/policy/evaluate', {
      data: {
        modelOutputs: {
          confidence: 0.75,
          edge: 0.05,
          drift: 0.15,
        },
      },
    });
    
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.gates.driftGate).toBe('failed');
  });

  test('[P2] should handle empty modelOutputs @error @p2', async ({ request }) => {
    const response = await request.post('/api/policy/evaluate', {
      data: { modelOutputs: {} },
    });
    
    expect(response.status()).toBe(200);
  });
});
