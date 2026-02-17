/**
 * Demo Daily Run - Version Simplifiée
 * Crée des données et exécute le daily run
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
  const user = await prisma.user.create({
    data: {
      email: 'demo@nba-analyst.com',
      password: hashedPassword,
      role: 'user',
    },
  });
  console.log(`   ✓ Utilisateur: ${user.email} (${user.id})\n`);

  // 2. Créer un Daily Run
  console.log('📅 Création Daily Run...');
  const runDate = new Date();
  const run = await prisma.dailyRun.create({
    data: {
      runDate,
      status: 'PENDING',
      triggeredBy: 'manual',
      traceId: `demo-${Date.now()}`,
      totalMatches: 0,
      predictionsCount: 0,
      picksCount: 0,
      noBetCount: 0,
      hardStopCount: 0,
    },
  });
  console.log(`   ✓ Daily Run: ${run.id}\n`);

  // 3. Créer des prédictions ML
  console.log('🎯 Création des prédictions ML...\n');

  const predictionsData = [
    { matchId: 'match-001', home: 'LAL', away: 'GSW', conf: 0.72, edge: 12.5, expected: 'PICK' },
    { matchId: 'match-002', home: 'BOS', away: 'MIA', conf: 0.65, edge: 8.2, expected: 'PICK' },
    { matchId: 'match-003', home: 'DEN', away: 'PHX', conf: 0.55, edge: 3.1, expected: 'NO-BET' },
    { matchId: 'match-004', home: 'MIL', away: 'CHI', conf: 0.78, edge: 15.3, expected: 'PICK' },
    { matchId: 'match-005', home: 'DAL', away: 'HOU', conf: 0.58, edge: 4.5, expected: 'NO-BET' },
  ];

  for (const p of predictionsData) {
    await prisma.prediction.create({
      data: {
        matchId: p.matchId,
        matchDate: runDate,
        league: 'nba',
        homeTeam: p.home,
        awayTeam: p.away,
        winnerPrediction: 'HOME',
        scorePrediction: '110-105',
        confidence: p.conf,
        edge: p.edge,
        modelVersion: 'v2.1.0',
        status: 'pending',
        userId: user.id,
        runId: run.id,
        traceId: `pred-${p.matchId}`,
      },
    });
    console.log(`   ✓ ${p.home} vs ${p.away} | Conf: ${(p.conf*100).toFixed(0)}% | Attendu: ${p.expected}`);
  }

  // 4. Initialiser Hard-Stop
  console.log('\n🛡️ Initialisation Hard-Stop...');
  await prisma.hardStopState.create({
    data: {
      isActive: false,
      dailyLoss: 0,
      consecutiveLosses: 0,
      bankrollPercent: 0,
    },
  });
  console.log('   ✓ Hard-Stop inactif\n');

  // 5. Exécuter le Daily Run
  console.log('⚡ EXÉCUTION DU DAILY RUN...');
  console.log('='.repeat(60));

  try {
    const result = await processDailyRun(run.id, {
      currentBankroll: 10000,
      dailyLossLimit: 1000,
      consecutiveLosses: 3,
      bankrollPercent: 15,
      defaultStakeAmount: 100,
    });

    console.log('='.repeat(60));
    console.log('\n📊 RÉSULTATS\n');
    console.log(`   Status: ${result.status.toUpperCase()}`);
    console.log(`   Hard-Stop: ${result.hardStopTriggered ? '❌ DECLENCHÉ' : '✅ Non actif'}`);
    console.log(`\n   📈 Résumé:`);
    console.log(`   - Total: ${result.totalPredictions} matchs analysés`);
    console.log(`   - 🟢 PICKS: ${result.picksCount}`);
    console.log(`   - 🟡 NO-BET: ${result.noBetCount}`);
    console.log(`   - 🔴 HARD-STOP: ${result.hardStopCount}`);

    if (result.hardStopReason) {
      console.log(`\n   Raison Hard-Stop: ${result.hardStopReason}`);
    }

    // 6. Afficher les décisions
    console.log('\n\n🎲 DÉCISIONS DÉTAILLÉES\n');
    const decisions = await prisma.policyDecision.findMany({
      where: { runId: run.id },
      orderBy: { executedAt: 'asc' },
    });

    decisions.forEach((dec, idx) => {
      const icon = dec.status === 'PICK' ? '🟢' : dec.status === 'NO_BET' ? '🟡' : '🔴';
      console.log(`${idx + 1}. ${icon} ${dec.homeTeam} vs ${dec.awayTeam}`);
      console.log(`   → ${dec.status} | Confiance: ${(dec.confidence * 100).toFixed(0)}%`);
      console.log(`   → Gates: conf=${dec.confidenceGate} edge=${dec.edgeGate} hardstop=${dec.hardStopGate}`);
      console.log(`   → ${dec.rationale.substring(0, 80)}...\n`);
    });

    // 7. Statut final Hard-Stop
    console.log('\n🛡️ STATUT HARD-STOP FINAL\n');
    const finalHardStop = await prisma.hardStopState.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (finalHardStop) {
      console.log(`   Actif: ${finalHardStop.isActive ? '❌ OUI' : '✅ Non'}`);
      console.log(`   Perte journalière: €${finalHardStop.dailyLoss.toFixed(2)}`);
      console.log(`   Pertes consécutives: ${finalHardStop.consecutiveLosses}`);
    }

    console.log('\n\n✅ DÉMONSTRATION TERMINÉE\n');

  } catch (error) {
    console.error('\n❌ ERREUR:', error);
    console.log('\nNote: Cette erreur est normale si les dépendances du job ne sont pas complètement initialisées.');
    console.log('Le schéma de données a été créé avec succès.\n');
  }
}

main()
  .catch((e) => {
    console.error('❌ ERREUR CRITIQUE:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
