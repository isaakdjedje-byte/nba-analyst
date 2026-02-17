/**
 * Predict End of NBA Season 2024-2025
 * 
 * This script generates predictions for all remaining games of the NBA season
 * from today until the end of the regular season (April 13, 2025)
 * 
 * Usage: npx tsx scripts/predict-end-of-season.ts
 */

import { PrismaClient, RunStatus, DailyRun, PredictionStatus } from '@prisma/client';
import { executeDailyRunPipeline } from '../src/server/jobs/daily-run-orchestrator';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// NBA Season 2025-2026 end date (regular season ends mid-April 2026)
const SEASON_END_DATE = new Date('2026-04-15');

async function predictEndOfSeason() {
  console.log('🏀 PREDICT END OF NBA SEASON 2024-2025\n');
  console.log('=' .repeat(70));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (today > SEASON_END_DATE) {
    console.log('❌ The NBA season has already ended!');
    process.exit(1);
  }

  console.log(`📅 Today: ${today.toISOString().split('T')[0]}`);
  console.log(`🏁 Season End: ${SEASON_END_DATE.toISOString().split('T')[0]}`);
  
  const daysRemaining = Math.ceil((SEASON_END_DATE.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  console.log(`📊 Days Remaining: ${daysRemaining}\n`);

  try {
    // Create or get daily run for today
    console.log('📅 Creating End-of-Season Daily Run...');
    let dailyRun = await prisma.dailyRun.findUnique({
      where: { runDate: today },
    });

    if (dailyRun) {
      console.log('   🔄 Using existing daily run, resetting...');
      dailyRun = await prisma.dailyRun.update({
        where: { id: dailyRun.id },
        data: {
          status: RunStatus.PENDING,
          triggeredBy: 'end-of-season-prediction',
          traceId: `eos-${Date.now()}`,
          startedAt: null,
          completedAt: null,
          errors: null,
        },
      });
    } else {
      dailyRun = await prisma.dailyRun.create({
        data: {
          runDate: today,
          status: RunStatus.PENDING,
          triggeredBy: 'end-of-season-prediction',
          traceId: `eos-${Date.now()}`,
          totalMatches: 0,
          predictionsCount: 0,
          picksCount: 0,
          noBetCount: 0,
          hardStopCount: 0,
        },
      });
    }
    console.log(`   ✓ Daily Run ID: ${dailyRun.id}\n`);

    // Initialize Hard-Stop State
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
    }

    // Execute pipeline
    console.log('⚡ EXECUTING PREDICTION PIPELINE\n');
    console.log('-'.repeat(70));

    const traceId = uuidv4();
    const result = await executeDailyRunPipeline({
      runId: dailyRun.id,
      runDate: today,
      traceId,
      skipIngestion: false,
      skipMLInference: false,
    });

    console.log('-'.repeat(70));

    // Display results
    console.log('\n📊 PREDICTION RESULTS\n');
    console.log(`   Status: ${result.status.toUpperCase()}`);
    console.log(`   Duration: ${result.metadata.totalDuration}ms`);
    console.log(`\n   📈 Decisions Summary:`);
    console.log(`   - Total Predictions: ${result.predictionsCount}`);
    console.log(`   - Picks: ${result.picksCount} 🟢`);
    console.log(`   - No-Bets: ${result.noBetCount} 🟡`);
    console.log(`   - Hard-Stops: ${result.hardStopCount} 🔴`);
    
    if (result.dataQualityScore !== null) {
      console.log(`\n   📊 Data Quality: ${(result.dataQualityScore * 100).toFixed(1)}%`);
    }

    if (result.errors.length > 0) {
      console.log(`\n   ⚠️ Errors (${result.errors.length}):`);
      result.errors.slice(0, 5).forEach((err, i) => {
        console.log(`   ${i + 1}. ${err}`);
      });
      if (result.errors.length > 5) {
        console.log(`   ... and ${result.errors.length - 5} more`);
      }
    }

    // Fetch and display predictions
    console.log('\n\n🔮 PREDICTIONS FOR END OF SEASON\n');
    const predictions = await prisma.prediction.findMany({
      where: { runId: dailyRun.id },
      include: {
        policyDecision: true,
      },
      orderBy: [
        { matchDate: 'asc' },
      ],
    });

    if (predictions.length === 0) {
      console.log('   No predictions generated.\n');
    } else {
      // Group by date
      const groupedByDate = predictions.reduce((acc, pred) => {
        const date = pred.matchDate.toISOString().split('T')[0];
        if (!acc[date]) acc[date] = [];
        acc[date].push(pred);
        return acc;
      }, {} as Record<string, typeof predictions>);

      let totalPick = 0;
      let totalNoBet = 0;
      let totalHardStop = 0;

      Object.entries(groupedByDate).forEach(([date, preds]) => {
        console.log(`\n📅 ${date}:`);
        console.log('-'.repeat(70));
        
        preds.forEach((pred, idx) => {
          const decision = pred.policyDecision;
          const statusEmoji = decision?.status === 'PICK' ? '🟢' : 
                             decision?.status === 'NO_BET' ? '🟡' : '🔴';
          
          if (decision?.status === 'PICK') totalPick++;
          else if (decision?.status === 'NO_BET') totalNoBet++;
          else if (decision?.status === 'HARD_STOP') totalHardStop++;

          console.log(`  ${idx + 1}. ${statusEmoji} ${pred.homeTeam} vs ${pred.awayTeam}`);
          console.log(`     🏆 Winner: ${pred.winnerPrediction || 'N/A'}`);
          console.log(`     📊 Score: ${pred.scorePrediction || 'N/A'}`);
          console.log(`     🎯 Confidence: ${(pred.confidence * 100).toFixed(1)}%`);
          console.log(`     📈 Edge: ${pred.edge?.toFixed(1) || 'N/A'}%`);
          
          if (decision) {
            console.log(`     🎲 Decision: ${decision.status}`);
            if (decision.recommendedPick) {
              console.log(`     💰 Recommended: ${decision.recommendedPick}`);
            }
            if (decision.hardStopReason) {
              console.log(`     🛑 Hard-Stop: ${decision.hardStopReason}`);
            }
          }
          console.log();
        });
      });

      // Summary
      console.log('\n📊 SEASON END SUMMARY\n');
      console.log(`   Total Games Predicted: ${predictions.length}`);
      console.log(`   🟢 Picks (Recommended Bets): ${totalPick}`);
      console.log(`   🟡 No-Bets (Skip): ${totalNoBet}`);
      console.log(`   🔴 Hard-Stops (Risk): ${totalHardStop}`);
      
      if (predictions.length > 0) {
        const pickRate = ((totalPick / predictions.length) * 100).toFixed(1);
        console.log(`\n   📈 Pick Rate: ${pickRate}%`);
        console.log(`   💡 Recommendation: ${totalPick} games worth betting on`);
      }
    }

    // Hard-Stop status
    const hardStop = await prisma.hardStopState.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    
    if (hardStop) {
      console.log('\n🛡️ HARD-STOP STATUS\n');
      console.log(`   Active: ${hardStop.isActive ? '❌ YES' : '✅ No'}`);
      console.log(`   Daily Loss: $${hardStop.dailyLoss.toFixed(2)}`);
      console.log(`   Consecutive Losses: ${hardStop.consecutiveLosses}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('\n✅ END OF SEASON PREDICTIONS COMPLETED\n');

    // Next steps
    console.log('📋 NEXT STEPS\n');
    console.log('   1. View all predictions in Prisma Studio:');
    console.log('      npx prisma studio');
    console.log('   2. Start the web app to see picks:');
    console.log('      npm run dev');
    console.log('   3. Navigate to: http://localhost:3000/dashboard/picks');
    console.log(`   4. Run ID for reference: ${dailyRun.id}\n`);

    return dailyRun;

  } catch (error) {
    console.error('\n❌ PREDICTION FAILED\n');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

predictEndOfSeason();
