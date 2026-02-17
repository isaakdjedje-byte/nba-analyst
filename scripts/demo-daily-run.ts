/**
 * Demo Daily Run Execution
 * Creates test data and runs the daily run pipeline
 */

import { PrismaClient } from '@prisma/client';
import { processDailyRun } from '../src/jobs/daily-run-job';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 DÉMARRAGE DU DEMONSTRATION DAILY RUN\n');

  // 1. Créer un utilisateur test
  console.log('👤 Création utilisateur test...');
  const hashedPassword = await bcrypt.hash('testpassword123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@nba-analyst.com' },
    update: {},
    create: {
      email: 'demo@nba-analyst.com',
      password: hashedPassword,
      role: 'user',
    },
  });
  console.log(`   ✓ Utilisateur: ${user.email} (${user.id})\n`);

  // 2. Créer ou récupérer un Daily Run
  console.log('📅 Création/Récupération Daily Run...');
  const runDate = new Date();
  runDate.setHours(0, 0, 0, 0); // Normalize to start of day
  
  const run = await prisma.dailyRun.upsert({
    where: { runDate },
    update: {
      status: 'PENDING',
      traceId: `demo-${Date.now()}`,
    },
    create: {
      runDate,
      status: 'PENDING',
      triggeredBy: 'manual',
      traceId: `demo-${Date.now()}`,
    },
  });
  console.log(`   ✓ Daily Run: ${run.id}`);
  console.log(`   ✓ Date: ${runDate.toISOString().split('T')[0]}\n`);

  // 3. Créer des prédictions ML de test
  console.log('🎯 Création des prédictions ML...\n');

  const predictions = [
    // Match 1: High confidence → PICK attendu
    {
      matchId: 'match-001',
      homeTeam: 'Los Angeles Lakers',
      awayTeam: 'Golden State Warriors',
      winnerPrediction: 'HOME',
      scorePrediction: '112-108',
      overUnderPrediction: 220.5,
      confidence: 0.72,
      edge: 12.5,
      modelVersion: 'v2.1.0',
      expected: 'PICK (High Confidence)',
    },
    // Match 2: Medium confidence → PICK possible
    {
      matchId: 'match-002',
      homeTeam: 'Boston Celtics',
      awayTeam: 'Miami Heat',
      winnerPrediction: 'HOME',
      scorePrediction: '110-105',
      overUnderPrediction: 215.5,
      confidence: 0.65,
      edge: 8.2,
      modelVersion: 'v2.1.0',
      expected: 'PICK (Medium Confidence)',
    },
    // Match 3: Low confidence → NO-BET attendu
    {
      matchId: 'match-003',
      homeTeam: 'Denver Nuggets',
      awayTeam: 'Phoenix Suns',
      winnerPrediction: 'HOME',
      scorePrediction: '108-107',
      overUnderPrediction: 225.5,
      confidence: 0.55, // Below threshold
      edge: 3.1,
      modelVersion: 'v2.1.0',
      expected: 'NO-BET (Low Confidence)',
    },
    // Match 4: Very high confidence with edge → PICK
    {
      matchId: 'match-004',
      homeTeam: 'Milwaukee Bucks',
      awayTeam: 'Chicago Bulls',
      winnerPrediction: 'HOME',
      scorePrediction: '118-102',
      overUnderPrediction: 218.5,
      confidence: 0.78,
      edge: 15.3,
      modelVersion: 'v2.1.0',
      expected: 'PICK (Strong Signal)',
    },
    // Match 5: Borderline confidence → NO-BET
    {
      matchId: 'match-005',
      homeTeam: 'Dallas Mavericks',
      awayTeam: 'Houston Rockets',
      winnerPrediction: 'AWAY',
      scorePrediction: '112-114',
      overUnderPrediction: 222.5,
      confidence: 0.58, // Just below threshold
      edge: 4.5,
      modelVersion: 'v2.1.0',
      expected: 'NO-BET (Below Threshold)',
    },
  ];

  for (const pred of predictions) {
    await prisma.prediction.create({
      data: {
        matchId: pred.matchId,
        matchDate: runDate,
        league: 'nba',
        homeTeam: pred.homeTeam,
        awayTeam: pred.awayTeam,
        winnerPrediction: pred.winnerPrediction,
        scorePrediction: pred.scorePrediction,
        overUnderPrediction: pred.overUnderPrediction,
        confidence: pred.confidence,
        edge: pred.edge,
        modelVersion: pred.modelVersion,
        featuresHash: 'demo-hash-123',
        status: 'pending',
        userId: user.id,
        runId: run.id,
        traceId: `pred-${pred.matchId}`,
      },
    });
    console.log(`   ✓ ${pred.homeTeam} vs ${pred.awayTeam}`);
    console.log(`     Confidence: ${(pred.confidence * 100).toFixed(1)}% | Edge: ${pred.edge}%`);
    console.log(`     Attendu: ${pred.expected}\n`);
  }

  // 4. Initialiser Hard-Stop State (inactif)
  console.log('🛡️ Initialisation Hard-Stop (inactif)...');
  await prisma.hardStopState.create({
    data: {
      isActive: false,
      dailyLoss: 0,
      consecutiveLosses: 0,
      bankrollPercent: 0,
    },
  });
  console.log('   ✓ Hard-Stop prêt\n');

  // 5. Exécuter le Daily Run
  console.log('⚡ EXÉCUTION DU DAILY RUN...\n');
  console.log('='.repeat(60));

  const result = await processDailyRun(run.id, {
    currentBankroll: 10000, // €10,000 bankroll
    dailyLossLimit: 1000,   // €1,000 daily loss limit
    consecutiveLosses: 3,   // Max 3 consecutive losses
    bankrollPercent: 15,    // 15% of bankroll max
    defaultStakeAmount: 100, // €100 default stake
  });

  console.log('='.repeat(60));
  console.log('\n📊 RÉSULTATS DU DAILY RUN\n');
  console.log(`   Run ID: ${result.runId}`);
  console.log(`   Status: ${result.status.toUpperCase()}`);
  console.log(`   Hard-Stop Triggered: ${result.hardStopTriggered ? '❌ OUI' : '✅ Non'}`);
  if (result.hardStopReason) {
    console.log(`   Raison: ${result.hardStopReason}`);
  }
  console.log(`\n   📈 Statistiques:`);
  console.log(`   - Total Predictions: ${result.totalPredictions}`);
  console.log(`   - Picks: ${result.picksCount} 🟢`);
  console.log(`   - No-Bets: ${result.noBetCount} 🟡`);
  console.log(`   - Hard-Stops: ${result.hardStopCount} 🔴`);
  console.log(`\n   💰 Fallback Stats:`);
  console.log(`   - Forced No-Bets: ${result.fallbackStats?.forcedNoBetCount || 0}`);
  console.log(`   - Fallback Levels utilisés:`);
  if (result.fallbackStats) {
    Object.entries(result.fallbackStats.fallbackLevels).forEach(([level, count]) => {
      if (count > 0) console.log(`     • ${level}: ${count}`);
    });
  }

  if (result.errors.length > 0) {
    console.log(`\n   ⚠️ Erreurs:`);
    result.errors.forEach(err => console.log(`     - ${err}`));
  }

  // 6. Afficher les décisions créées
  console.log('\n\n🎲 DÉCISIONS CRÉÉES\n');
  const decisions = await prisma.policyDecision.findMany({
    where: { runId: run.id },
    include: {
      prediction: {
        select: {
          homeTeam: true,
          awayTeam: true,
          confidence: true,
          edge: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  decisions.forEach((decision, idx) => {
    const statusEmoji = decision.status === 'PICK' ? '🟢' : 
                        decision.status === 'NO_BET' ? '🟡' : '🔴';
    console.log(`${idx + 1}. ${statusEmoji} ${decision.prediction.homeTeam} vs ${decision.prediction.awayTeam}`);
    console.log(`   Status: ${decision.status}`);
    console.log(`   Confidence: ${(decision.prediction.confidence * 100).toFixed(1)}%`);
    console.log(`   Edge: ${decision.prediction.edge}%`);
    console.log(`   Gates: confidence=${decision.confidenceGate} edge=${decision.edgeGate} drift=${decision.driftGate} hardstop=${decision.hardStopGate}`);
    console.log(`   Rationale: ${decision.rationale}`);
    console.log(`   Action: ${decision.recommendedAction || 'N/A'}\n`);
  });

  // 7. Vérifier le statut Hard-Stop final
  console.log('\n🛡️ STATUT FINAL HARD-STOP\n');
  const hardStop = await prisma.hardStopState.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  if (hardStop) {
    console.log(`   Actif: ${hardStop.isActive ? '❌ OUI' : '✅ Non'}`);
    console.log(`   Daily Loss: €${hardStop.dailyLoss.toFixed(2)}`);
    console.log(`   Consecutive Losses: ${hardStop.consecutiveLosses}`);
    console.log(`   Bankroll %: ${hardStop.bankrollPercent.toFixed(2)}%`);
    if (hardStop.triggerReason) {
      console.log(`   Trigger Reason: ${hardStop.triggerReason}`);
    }
  }

  console.log('\n\n✅ DEMONSTRATION TERMINÉE\n');
}

main()
  .catch((e) => {
    console.error('❌ ERREUR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
