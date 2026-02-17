/**
 * Load, failover, and monitoring validation for hybrid system.
 *
 * Usage: npx tsx scripts/load-failover-monitoring.ts
 */

import { HybridPredictionSystem } from './hybrid-prediction-system';
import { ModelFeatures } from '@/server/ml/features/types';
import * as fs from 'fs';
import * as path from 'path';

interface LatencySummary {
  p50: number;
  p95: number;
  p99: number;
  avg: number;
  min: number;
  max: number;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  const bounded = Math.max(0, Math.min(sorted.length - 1, idx));
  return sorted[bounded];
}

function summarizeLatencies(latencies: number[]): LatencySummary {
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = latencies.reduce((a, b) => a + b, 0);
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    avg: latencies.length ? sum / latencies.length : 0,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0
  };
}

function sampleInput(i: number): { features: ModelFeatures; pythonFeatures: Record<string, number> } {
  const tilt = ((i % 11) - 5) / 10;
  const homeWinRate = Math.max(0.25, Math.min(0.75, 0.55 + tilt * 0.1));
  const awayWinRate = Math.max(0.25, Math.min(0.75, 0.50 - tilt * 0.1));
  const homeProb = Math.max(0.05, Math.min(0.95, 0.5 + (homeWinRate - awayWinRate) * 0.8));

  return {
    features: {
      homeWinRate,
      homeOffensiveRating: 111 + tilt * 8,
      homeDefensiveRating: 109 - tilt * 6,
      homeForm: homeWinRate,
      homeRestAdvantage: 0,
      awayWinRate,
      awayOffensiveRating: 110 - tilt * 7,
      awayDefensiveRating: 110 + tilt * 5,
      awayForm: awayWinRate,
      homeAdvantage: 1,
      h2hAdvantage: 0,
      matchupStrength: (homeWinRate + awayWinRate) / 2,
      isBackToBack: i % 3 === 0 ? 1 : 0,
      daysRestDiff: 0,
      isPlayoff: 0
    },
    pythonFeatures: {
      elo_diff: (homeWinRate - awayWinRate) * 400,
      elo_diff_norm: (homeWinRate - awayWinRate) * 0.5 + 0.5,
      home_last10_wins: homeWinRate,
      away_last10_wins: awayWinRate,
      spread_num: -2,
      over_under: 223,
      ml_home_prob: homeProb,
      ml_away_prob: 1 - homeProb,
      rest_days_home: 2,
      rest_days_away: 2,
      season_norm: 0.87
    }
  };
}

async function runLoadTest() {
  const targetRps = 100;
  const durationSeconds = 60;
  const totalRequests = targetRps * durationSeconds;

  const hybrid = new HybridPredictionSystem({
    pythonThreshold: 0.75,
    pythonMinConfidence: 0.65,
    fallbackToTypescript: true,
    pythonBaseUrl: 'http://localhost:8000'
  });
  await hybrid.initialize();

  const latencies: number[] = [];
  const modelCounts = { TypeScript: 0, Python: 0, Fallback: 0 };
  const memBefore = process.memoryUsage();
  const cpuBefore = process.cpuUsage();

  const start = Date.now();
  for (let second = 0; second < durationSeconds; second++) {
    const batchStart = Date.now();
    const batch = Array.from({ length: targetRps }, (_, j) => second * targetRps + j);
    const batchResults = await Promise.all(
      batch.map(async (idx) => {
        const input = sampleInput(idx);
        const res = await hybrid.predict(input.features, input.pythonFeatures);
        return res;
      })
    );

    for (const item of batchResults) {
      latencies.push(item.latency);
      modelCounts[item.modelUsed] += 1;
    }

    const elapsed = Date.now() - batchStart;
    const sleepMs = 1000 - elapsed;
    if (sleepMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
  }
  const totalMs = Date.now() - start;

  const cpuAfter = process.cpuUsage(cpuBefore);
  const memAfter = process.memoryUsage();

  return {
    requests: totalRequests,
    durationSeconds,
    effectiveRps: totalRequests / (totalMs / 1000),
    latencies: summarizeLatencies(latencies),
    modelCounts,
    resources: {
      memoryBeforeMb: Math.round(memBefore.rss / 1024 / 1024),
      memoryAfterMb: Math.round(memAfter.rss / 1024 / 1024),
      cpuUserMs: Math.round(cpuAfter.user / 1000),
      cpuSystemMs: Math.round(cpuAfter.system / 1000)
    }
  };
}

async function runFailoverTest() {
  const healthy = new HybridPredictionSystem({
    pythonThreshold: 0.7,
    pythonMinConfidence: 0.6,
    fallbackToTypescript: true,
    pythonBaseUrl: 'http://localhost:8000'
  });
  await healthy.initialize();

  const outage = new HybridPredictionSystem({
    pythonThreshold: 0.7,
    pythonMinConfidence: 0.6,
    fallbackToTypescript: true,
    pythonBaseUrl: 'http://localhost:8009'
  });
  await outage.initialize();

  const sample = sampleInput(1);
  const before = await healthy.predict(sample.features, sample.pythonFeatures);

  const failoverLatencies: number[] = [];
  let fallbackCount = 0;
  const t0 = Date.now();
  for (let i = 0; i < 50; i++) {
    const out = sampleInput(i + 2000);
    const res = await outage.predict(out.features, out.pythonFeatures);
    failoverLatencies.push(res.latency);
    if (res.modelUsed === 'Fallback' || res.modelUsed === 'TypeScript') fallbackCount += 1;
  }
  const recoveryMs = Date.now() - t0;

  const after = await healthy.predict(sample.features, sample.pythonFeatures);

  return {
    preOutageModel: before.modelUsed,
    postRecoveryModel: after.modelUsed,
    fallbackRatePct: (fallbackCount / 50) * 100,
    recoveryWindowMs: recoveryMs,
    failoverLatency: summarizeLatencies(failoverLatencies)
  };
}

async function main() {
  console.log('Running load test...');
  const load = await runLoadTest();
  console.log('Running failover test...');
  const failover = await runFailoverTest();

  const payload = {
    timestamp: new Date().toISOString(),
    load,
    failover,
    alerts: {
      p95LatencyAlertMs: 250,
      errorRateAlertPct: 2,
      pythonUnavailableAlertConsecutive: 5
    }
  };

  const jsonPath = path.join(process.cwd(), 'load-failover-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

  const dashboardPath = path.join(process.cwd(), 'MONITORING_DASHBOARD.md');
  const dashboard = [
    '# Monitoring Dashboard',
    '',
    `- Generated: ${payload.timestamp}`,
    '',
    '## Load Test (100 req/s for 60s)',
    '',
    `- Effective throughput: ${load.effectiveRps.toFixed(2)} req/s`,
    `- Latency P50/P95/P99: ${load.latencies.p50.toFixed(2)} / ${load.latencies.p95.toFixed(2)} / ${load.latencies.p99.toFixed(2)} ms`,
    `- Avg latency: ${load.latencies.avg.toFixed(2)} ms`,
    `- Model usage: TS=${load.modelCounts.TypeScript}, Python=${load.modelCounts.Python}, Fallback=${load.modelCounts.Fallback}`,
    `- Memory RSS (MB): ${load.resources.memoryBeforeMb} -> ${load.resources.memoryAfterMb}`,
    `- CPU user/system (ms): ${load.resources.cpuUserMs}/${load.resources.cpuSystemMs}`,
    '',
    '## Failover Test',
    '',
    `- Fallback success rate: ${failover.fallbackRatePct.toFixed(2)}%`,
    `- Recovery window: ${failover.recoveryWindowMs} ms`,
    `- Pre-outage model: ${failover.preOutageModel}`,
    `- Post-recovery model: ${failover.postRecoveryModel}`,
    `- Failover P95 latency: ${failover.failoverLatency.p95.toFixed(2)} ms`,
    '',
    '## Alerts',
    '',
    '- Trigger `high_latency` if P95 > 250ms for 3 consecutive windows.',
    '- Trigger `python_service_down` if Python health check fails 5 times in a row.',
    '- Trigger `elevated_error_rate` if error rate > 2% over the last 5 minutes.'
  ].join('\n');
  fs.writeFileSync(dashboardPath, dashboard);

  const runbookPath = path.join(process.cwd(), 'EMERGENCY_PROCEDURES.md');
  const runbook = [
    '# Emergency Procedures',
    '',
    '## Python Service Down',
    '',
    '1. Confirm fallback is active (`modelUsed` is `Fallback`/`TypeScript`).',
    '2. Restart Python service: `python python-service/app.py`.',
    '3. Validate `/health` and run a smoke prediction.',
    '4. If still failing, keep TypeScript-only mode and open incident.',
    '',
    '## Latency Spike',
    '',
    '1. Check P95/P99 and CPU/memory saturation.',
    '2. Temporarily raise `pythonThreshold` to reduce Python calls.',
    '3. Scale Node process horizontally if sustained.',
    '',
    '## Accuracy Drift',
    '',
    '1. Compare rolling 7-day accuracy against baseline.',
    '2. Retrain TypeScript models on latest games.',
    '3. Re-run calibration and benchmark scripts before activation.'
  ].join('\n');
  fs.writeFileSync(runbookPath, runbook);

  console.log(`Saved: ${jsonPath}`);
  console.log(`Saved: ${dashboardPath}`);
  console.log(`Saved: ${runbookPath}`);
}

main().catch((error) => {
  console.error('Load/failover test failed:', error);
  process.exit(1);
});
