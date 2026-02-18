/**
 * Trigger Real Daily Run with ESPN Data
 * 
 * This script triggers a daily run that fetches real NBA data from ESPN API,
 * generates ML predictions, and evaluates them through the policy engine.
 * 
 * Usage: npx tsx scripts/trigger-real-daily-run.ts
 */

import { PrismaClient, RunStatus } from '@prisma/client';
import { executeDailyRunPipeline } from '../src/server/jobs/daily-run-orchestrator';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 TRIGGER REAL DAILY RUN WITH ESPN DATA\n');
  console.log('=' .repeat(60));

  try {
    // 1. Create or get today's daily run
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log(`📅 Date: ${today.toISOString().split('T')[0]}\n`);

    // Check if a run already exists for today
    let dailyRun = await prisma.dailyRun.findUnique({
      where: { runDate: today },
    });

    if (dailyRun) {
      console.log('🔄 Daily run already exists, resetting status...');

      await prisma.policyDecision.deleteMany({
        where: { runId: dailyRun.id },
      });

      await prisma.prediction.deleteMany({
        where: { runId: dailyRun.id },
      });

      dailyRun = await prisma.dailyRun.update({
        where: { id: dailyRun.id },
        data: {
          status: RunStatus.PENDING,
          startedAt: null,
          completedAt: null,
          predictionsCount: 0,
          picksCount: 0,
          noBetCount: 0,
          hardStopCount: 0,
          errors: null,
        },
      });
    } else {
      console.log('📅 Creating new Daily Run...');
      dailyRun = await prisma.dailyRun.create({
        data: {
          runDate: today,
          status: RunStatus.PENDING,
          triggeredBy: 'manual-real-data',
          traceId: `real-${Date.now()}`,
          totalMatches: 0,
          predictionsCount: 0,
          picksCount: 0,
          noBetCount: 0,
          hardStopCount: 0,
        },
      });
    }

    console.log(`   ✓ Daily Run ID: ${dailyRun.id}\n`);

    // 2. Initialize Hard-Stop State if not exists
    const existingHardStop = await prisma.hardStopState.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    if (!existingHardStop) {
      console.log('🛡️ Initializing Hard-Stop State...');
      await prisma.hardStopState.create({
        data: {
          isActive: false,
          dailyLoss: 0,
          consecutiveLosses: 0,
          bankrollPercent: 0,
        },
      });
      console.log('   ✓ Hard-Stop initialized\n');
    } else if (existingHardStop.isActive) {
      console.log('🧹 Resetting active Hard-Stop state for manual run...');
      await prisma.hardStopState.update({
        where: { id: existingHardStop.id },
        data: {
          isActive: false,
          dailyLoss: 0,
          consecutiveLosses: 0,
          bankrollPercent: 0,
          triggeredAt: null,
          triggerReason: null,
          lastResetAt: new Date(),
        },
      });
      console.log('   ✓ Hard-Stop reset\n');
    }

    // 3. Execute the pipeline
    console.log('⚡ EXECUTING PIPELINE\n');
    console.log('-'.repeat(60));

    const traceId = uuidv4();
    const result = await executeDailyRunPipeline({
      runId: dailyRun.id,
      runDate: today,
      traceId,
      skipIngestion: false,
      skipMLInference: false,
    });

    console.log('-'.repeat(60));

    // 4. Display results
    console.log('\n📊 PIPELINE RESULTS\n');
    console.log(`   Status: ${result.status.toUpperCase()}`);
    console.log(`   Total Duration: ${result.metadata.totalDuration}ms`);
    console.log(`\n   Phase Durations:`);
    console.log(`   - Ingestion: ${result.metadata.ingestionDuration}ms`);
    console.log(`   - ML Inference: ${result.metadata.mlInferenceDuration}ms`);
    console.log(`   - Policy Evaluation: ${result.metadata.policyEvaluationDuration}ms`);
    console.log(`   - Publication: ${result.metadata.publicationDuration}ms`);
    
    console.log(`\n   📈 Predictions:`);
    console.log(`   - Total: ${result.predictionsCount}`);
    console.log(`   - Picks: ${result.picksCount} 🟢`);
    console.log(`   - No-Bets: ${result.noBetCount} 🟡`);
    console.log(`   - Hard-Stops: ${result.hardStopCount} 🔴`);
    
    if (result.dataQualityScore !== null) {
      console.log(`\n   📊 Data Quality Score: ${(result.dataQualityScore * 100).toFixed(1)}%`);
    }

    if (result.errors.length > 0) {
      console.log(`\n   ⚠️ Errors (${result.errors.length}):`);
      result.errors.forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`);
      });
    }

    // 5. Fetch and display created decisions
    console.log('\n\n🎲 CREATED DECISIONS\n');
    const decisions = await prisma.policyDecision.findMany({
      where: { runId: dailyRun.id },
      orderBy: { createdAt: 'asc' },
    });

    if (decisions.length === 0) {
      console.log('   No decisions created.\n');
    } else {
      decisions.forEach((decision, idx) => {
        const statusEmoji = decision.status === 'PICK' ? '🟢' : 
                           decision.status === 'NO_BET' ? '🟡' : '🔴';
        console.log(`${idx + 1}. ${statusEmoji} ${decision.homeTeam} vs ${decision.awayTeam}`);
        console.log(`   Status: ${decision.status}`);
        console.log(`   Match Date: ${decision.matchDate.toISOString().split('T')[0]}`);
        console.log(`   Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
        console.log(`   Edge: ${decision.edge !== null ? (decision.edge * 100).toFixed(1) : 'N/A'}%`);
        console.log(`   Pick: ${decision.recommendedPick || 'N/A'}`);
        console.log(`   Gates: confidence=${decision.confidenceGate} edge=${decision.edgeGate} drift=${decision.driftGate} hardstop=${decision.hardStopGate}`);
        console.log(`   Rationale: ${decision.rationale.substring(0, 100)}${decision.rationale.length > 100 ? '...' : ''}`);
        console.log();
      });
    }

    // 6. Display final hard-stop status
    const hardStop = await prisma.hardStopState.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    
    if (hardStop) {
      console.log('🛡️ HARD-STOP STATUS\n');
      console.log(`   Active: ${hardStop.isActive ? '❌ YES' : '✅ No'}`);
      console.log(`   Daily Loss: $${hardStop.dailyLoss.toFixed(2)}`);
      console.log(`   Consecutive Losses: ${hardStop.consecutiveLosses}`);
      console.log(`   Bankroll %: ${hardStop.bankrollPercent.toFixed(2)}%`);
      if (hardStop.triggerReason) {
        console.log(`   Trigger Reason: ${hardStop.triggerReason}`);
      }
      console.log();
    }

    console.log('='.repeat(60));
    console.log('\n✅ PIPELINE COMPLETED SUCCESSFULLY\n');

    // 7. Instructions for viewing in dashboard
    console.log('🌐 VIEW IN DASHBOARD\n');
    console.log('   1. Start the dev server: npm run dev');
    console.log('   2. Login at: http://localhost:3000/login');
    console.log('   3. Navigate to: http://localhost:3000/dashboard/picks');
    console.log(`   4. You should see ${decisions.length} decision(s)\n`);

  } catch (error) {
    console.error('\n❌ PIPELINE FAILED\n');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
