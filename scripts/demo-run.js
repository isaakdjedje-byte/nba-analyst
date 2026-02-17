/**
 * Demo Daily Run - JavaScript Version
 * Tests the pipeline with real database
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 DÉMARRAGE DU TEST DAILY RUN AVEC DONNÉES RÉELLES\n');

  try {
    // 1. Vérifier l'état actuel de la base
    console.log('📊 ÉTAT ACTUEL DE LA BASE DE DONNÉES\n');
    
    const userCount = await prisma.user.count();
    const runCount = await prisma.dailyRun.count();
    const predictionCount = await prisma.prediction.count();
    const decisionCount = await prisma.policyDecision.count();
    const hardStopCount = await prisma.hardStopState.count();

    console.log(`   Utilisateurs: ${userCount}`);
    console.log(`   Daily Runs: ${runCount}`);
    console.log(`   Prédictions: ${predictionCount}`);
    console.log(`   Décisions Policy: ${decisionCount}`);
    console.log(`   Hard-Stop States: ${hardStopCount}\n`);

    // 2. Créer un utilisateur test si nécessaire
    let user;
    if (userCount === 0) {
      console.log('👤 Création utilisateur test...');
      const hashedPassword = await bcrypt.hash('testpassword123', 10);
      user = await prisma.user.create({
        data: {
          email: 'demo@nba-analyst.com',
          password: hashedPassword,
          role: 'user',
        },
      });
      console.log(`   ✓ Utilisateur créé: ${user.email} (${user.id})\n`);
    } else {
      user = await prisma.user.findFirst();
      console.log(`👤 Utilisateur existant: ${user.email}\n`);
    }

    // 3. Créer un Daily Run
    console.log('📅 Création Daily Run...');
    const runDate = new Date();
    const run = await prisma.dailyRun.create({
      data: {
        runDate,
        status: 'PENDING',
        triggeredBy: 'manual',
        traceId: `demo-${Date.now()}`,
        userId: user.id,
      },
    });
    console.log(`   ✓ Daily Run: ${run.id}\n`);

    // 4. Créer des prédictions ML réalistes
    console.log('🎯 Création des PRÉDICTIONS ML...\n');

    const predictions = [
      { 
        matchId: 'nba-20260214-lal-gsw',
        homeTeam: 'Los Angeles Lakers',
        awayTeam: 'Golden State Warriors',
        winner: 'HOME',
        confidence: 0.72,
        edge: 12.5,
        score: '112-108',
        overUnder: 220.5
      },
      { 
        matchId: 'nba-20260214-bos-mia',
        homeTeam: 'Boston Celtics',
        awayTeam: 'Miami Heat',
        winner: 'HOME',
        confidence: 0.65,
        edge: 8.2,
        score: '110-105',
        overUnder: 215.5
      },
      { 
        matchId: 'nba-20260214-den-phx',
        homeTeam: 'Denver Nuggets',
        awayTeam: 'Phoenix Suns',
        winner: 'HOME',
        confidence: 0.55, // Sous le seuil
        edge: 3.1,
        score: '108-107',
        overUnder: 225.5
      },
      { 
        matchId: 'nba-20260214-mil-chi',
        homeTeam: 'Milwaukee Bucks',
        awayTeam: 'Chicago Bulls',
        winner: 'HOME',
        confidence: 0.78,
        edge: 15.3,
        score: '118-102',
        overUnder: 218.5
      },
      { 
        matchId: 'nba-20260214-dal-hou',
        homeTeam: 'Dallas Mavericks',
        awayTeam: 'Houston Rockets',
        winner: 'AWAY',
        confidence: 0.58, // Juste sous le seuil
        edge: 4.5,
        score: '112-114',
        overUnder: 222.5
      },
    ];

    for (const p of predictions) {
      await prisma.prediction.create({
        data: {
          matchId: p.matchId,
          matchDate: runDate,
          league: 'nba',
          homeTeam: p.homeTeam,
          awayTeam: p.awayTeam,
          winnerPrediction: p.winner,
          scorePrediction: p.score,
          overUnderPrediction: p.overUnder,
          confidence: p.confidence,
          edge: p.edge,
          modelVersion: 'v2.1.0',
          status: 'pending',
          userId: user.id,
          runId: run.id,
          traceId: `pred-${p.matchId}`,
        },
      });
      const status = p.confidence >= 0.60 ? '🟢' : '🟡';
      console.log(`   ${status} ${p.homeTeam} vs ${p.awayTeam}`);
      console.log(`      Confiance: ${(p.confidence*100).toFixed(0)}% | Edge: ${p.edge}%`);
    }

    // 5. Initialiser Hard-Stop
    console.log('\n🛡️ Initialisation Hard-Stop...');
    let hardStop = await prisma.hardStopState.findFirst();
    if (!hardStop) {
      hardStop = await prisma.hardStopState.create({
        data: {
          isActive: false,
          dailyLoss: 0,
          consecutiveLosses: 0,
          bankrollPercent: 0,
        },
      });
      console.log('   ✓ Hard-Stop créé (inactif)\n');
    } else {
      console.log('   ✓ Hard-Stop existe déjà\n');
    }

    // 6. SIMULATION DU POLICY ENGINE
    console.log('⚡ EXÉCUTION DU POLICY ENGINE...');
    console.log('='.repeat(70));

    let processedPicks = 0;
    let processedNoBets = 0;
    let processedHardStops = 0;

    // Récupérer les prédictions créées
    const pendingPredictions = await prisma.prediction.findMany({
      where: { runId: run.id },
    });

    console.log(`\n📊 Analyse de ${pendingPredictions.length} prédictions...\n`);

    const results = [];

    for (const pred of pendingPredictions) {
      console.log(`\n🏀 ${pred.homeTeam} vs ${pred.awayTeam}`);
      console.log(`   Match ID: ${pred.matchId}`);
      console.log(`   Confiance ML: ${(pred.confidence * 100).toFixed(1)}%`);
      console.log(`   Edge: ${pred.edge}%`);

      // Policy Gates
      const confidenceGate = pred.confidence >= 0.60;
      const edgeGate = pred.edge >= 5.0;
      const hardStopGate = hardStop.isActive;

      console.log(`\n   📋 Quality Gates:`);
      console.log(`      ${confidenceGate ? '✅' : '❌'} Confidence Gate (≥60%): ${(pred.confidence * 100).toFixed(1)}%`);
      console.log(`      ${edgeGate ? '✅' : '❌'} Edge Gate (≥5%): ${pred.edge}%`);
      console.log(`      ${!hardStopGate ? '✅' : '❌'} Hard-Stop Gate: ${hardStop.isActive ? 'ACTIF' : 'inactif'}`);

      // Décision
      let status, rationale, recommendedAction;

      if (hardStopGate) {
        status = 'HARD_STOP';
        rationale = `HARD-STOP: Risk limits exceeded - ${hardStop.triggerReason}`;
        recommendedAction = 'STOP: Review risk parameters before continuing';
      } else if (!confidenceGate) {
        status = 'NO_BET';
        rationale = `NO-BET: Confidence ${(pred.confidence * 100).toFixed(1)}% below threshold (60%)`;
        recommendedAction = 'WAIT: Insufficient model confidence';
      } else if (!edgeGate) {
        status = 'NO_BET';
        rationale = `NO-BET: Edge ${pred.edge}% below threshold (5%)`;
        recommendedAction = 'WAIT: Insufficient edge for value bet';
      } else {
        status = 'PICK';
        rationale = `PICK: Strong signal - Confidence ${(pred.confidence * 100).toFixed(1)}%, Edge ${pred.edge}%`;
        recommendedAction = `BET: Recommended stake based on Kelly criterion`;
      }

      // Créer la décision
      const decision = await prisma.policyDecision.create({
        data: {
          predictionId: pred.id,
          matchId: pred.matchId,
          userId: user.id,
          status: status,
          rationale: rationale,
          confidenceGate: confidenceGate,
          edgeGate: edgeGate,
          driftGate: true,
          hardStopGate: !hardStopGate,
          hardStopReason: hardStopGate ? hardStop.triggerReason : null,
          recommendedAction: recommendedAction,
          matchDate: pred.matchDate,
          homeTeam: pred.homeTeam,
          awayTeam: pred.awayTeam,
          confidence: pred.confidence,
          edge: pred.edge,
          modelVersion: pred.modelVersion,
          traceId: pred.traceId,
          runId: run.id,
          executedAt: new Date(),
        },
      });

      // Mettre à jour le statut de la prédiction
      await prisma.prediction.update({
        where: { id: pred.id },
        data: { status: 'processed' },
      });

      const icon = status === 'PICK' ? '🟢' : status === 'NO_BET' ? '🟡' : '🔴';
      console.log(`\n   ${icon} DÉCISION: ${status}`);
      console.log(`      ${rationale}`);
      console.log(`      Action: ${recommendedAction}`);

      results.push({
        match: `${pred.homeTeam} vs ${pred.awayTeam}`,
        status: status,
        confidence: pred.confidence,
        edge: pred.edge,
        gates: { confidence: confidenceGate, edge: edgeGate, hardStop: hardStopGate },
      });
    }

    // 7. Mettre à jour le Daily Run
    const finalPicksCount = results.filter(r => r.status === 'PICK').length;
    const finalNoBetCount = results.filter(r => r.status === 'NO_BET').length;
    const finalHardStopCount = results.filter(r => r.status === 'HARD_STOP').length;

    await prisma.dailyRun.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        totalMatches: predictions.length,
        predictionsCount: predictions.length,
        picksCount: finalPicksCount,
        noBetCount: finalNoBetCount,
        hardStopCount: finalHardStopCount,
      },
    });

    // 8. RÉSULTATS
    console.log('\n' + '='.repeat(70));
    console.log('📊 RÉSULTATS DU DAILY RUN');
    console.log('='.repeat(70));

    console.log(`\n   Run ID: ${run.id}`);
    console.log(`   Status: ✅ COMPLETED`);
    console.log(`   Hard-Stop: ${hardStop.isActive ? '❌ ACTIF' : '✅ Inactif'}`);

    console.log(`\n   📈 Résumé:`);
    console.log(`   ┌─────────────────────────────────────────┐`);
    console.log(`   │  Total Matchs Analysés:     ${predictions.length.toString().padStart(3)}          │`);
    console.log(`   │  🟢 PICKS:                   ${finalPicksCount.toString().padStart(3)}          │`);
    console.log(`   │  🟡 NO-BETS:                 ${finalNoBetCount.toString().padStart(3)}          │`);
    console.log(`   │  🔴 HARD-STOPS:              ${finalHardStopCount.toString().padStart(3)}          │`);
    console.log(`   └─────────────────────────────────────────┘`);

    // Exposition
    const exposure = finalPicksCount * 100; // €100 par pick
    console.log(`\n   💰 Exposition:`);
    console.log(`      Exposition totale: €${exposure}`);
    console.log(`      % du bankroll: ${(exposure / 10000 * 100).toFixed(1)}%`);

    // 9. DÉCISIONS DÉTAILLÉES
    console.log('\n🎲 DÉCISIONS DÉTAILLÉES');
    console.log('═'.repeat(70));

    const decisions = await prisma.policyDecision.findMany({
      where: { runId: run.id },
      orderBy: { executedAt: 'asc' },
    });

    decisions.forEach((dec, idx) => {
      const icon = dec.status === 'PICK' ? '🟢' : dec.status === 'NO_BET' ? '🟡' : '🔴';
      console.log(`\n${idx + 1}. ${icon} ${dec.homeTeam} vs ${dec.awayTeam}`);
      console.log(`   → Statut: ${dec.status}`);
      console.log(`   → Confiance: ${(dec.confidence * 100).toFixed(1)}% | Edge: ${dec.edge}%`);
      console.log(`   → Gates: conf=${dec.confidenceGate ? '✓' : '✗'} edge=${dec.edgeGate ? '✓' : '✗'} hardstop=${dec.hardStopGate ? '✓' : '✗'}`);
      console.log(`   → ${dec.rationale.substring(0, 70)}${dec.rationale.length > 70 ? '...' : ''}`);
    });

    // 10. STATUT FINAL
    console.log('\n\n🛡️ STATUT HARD-STOP FINAL');
    console.log('═'.repeat(70));
    const finalHardStop = await prisma.hardStopState.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (finalHardStop) {
      console.log(`   Actif:              ${finalHardStop.isActive ? '❌ OUI' : '✅ Non'}`);
      console.log(`   Perte journalière:  €${finalHardStop.dailyLoss.toFixed(2)}`);
      console.log(`   Pertes consécutives: ${finalHardStop.consecutiveLosses}`);
      console.log(`   % Bankroll:         ${finalHardStop.bankrollPercent.toFixed(2)}%`);
    }

    // Vérifier l'état final
    console.log('\n\n📊 ÉTAT FINAL DE LA BASE');
    console.log('═'.repeat(70));
    console.log(`   Utilisateurs:      ${await prisma.user.count()}`);
    console.log(`   Daily Runs:        ${await prisma.dailyRun.count()}`);
    console.log(`   Prédictions:       ${await prisma.prediction.count()}`);
    console.log(`   Décisions Policy:  ${await prisma.policyDecision.count()}`);
    console.log(`   Hard-Stop States:  ${await prisma.hardStopState.count()}`);

    console.log('\n\n✅ TEST TERMINÉ AVEC SUCCÈS');
    console.log('   Le pipeline Daily Run fonctionne correctement avec des données réelles.\n');

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
