/**
 * Run Continuous Learning Cycle
 *
 * Resolves prediction outcomes, computes monitoring health, and optionally
 * retrains/promotes a challenger model based on configured thresholds.
 */

import { runContinuousLearningCycle } from '@/server/ml/automation/continuous-learning-service';

async function main(): Promise<void> {
  console.log('='.repeat(64));
  console.log('NBA Analyst - Continuous Learning Cycle');
  console.log('='.repeat(64));

  const result = await runContinuousLearningCycle();

  console.log('\nOutcome resolution');
  console.log(`  scanned: ${result.outcomeResolution.scanned}`);
  console.log(`  resolved: ${result.outcomeResolution.resolved}`);
  console.log(`  skipped: ${result.outcomeResolution.skipped}`);
  console.log(`  errors: ${result.outcomeResolution.errors}`);

  console.log('\nWeekly metrics');
  console.log(`  resolved: ${result.weeklyMetrics.resolvedCount}`);
  console.log(`  accuracy: ${(result.weeklyMetrics.accuracy * 100).toFixed(2)}%`);
  console.log(`  calibrationError: ${(result.weeklyMetrics.calibrationError * 100).toFixed(2)}%`);

  console.log('\nHealth');
  console.log(`  healthy: ${result.health.healthy}`);
  if (result.health.alerts.length > 0) {
    console.log(`  alerts: ${result.health.alerts.join(' | ')}`);
  }

  console.log('\nRetraining');
  console.log(`  attempted: ${result.retraining.attempted}`);
  console.log(`  promoted: ${result.retraining.promoted}`);
  console.log(`  reason: ${result.retraining.reason}`);
  if (result.retraining.candidateModelVersion) {
    console.log(`  candidate: ${result.retraining.candidateModelVersion}`);
  }

  console.log('\nDone.');
}

main().catch((error) => {
  console.error('Continuous learning failed:', error);
  process.exit(1);
});
