import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function showMLStats() {
  console.log('\n========================================');
  console.log('  ML MODELS & PREDICTIONS DASHBOARD');
  console.log('========================================\n');

  // 1. ML Models
  console.log('📊 ML Models:');
  console.log('-'.repeat(80));
  const models = await prisma.mLModel.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  if (models.length === 0) {
    console.log('   No models found.\n');
  } else {
    models.forEach((model, i) => {
      const status = model.isActive ? '🟢 ACTIVE' : '⚪ Inactive';
      console.log(`   ${i + 1}. ${model.version} ${status}`);
      console.log(`      Algorithm: ${model.algorithm}`);
      console.log(`      Accuracy:  ${(model.accuracy * 100).toFixed(2)}%`);
      console.log(`      F1 Score:  ${(model.f1Score * 100).toFixed(2)}%`);
      console.log(`      AUC:       ${(model.auc * 100).toFixed(2)}%`);
      console.log(`      Precision: ${(model.precision * 100).toFixed(2)}%`);
      console.log(`      Recall:    ${(model.recall * 100).toFixed(2)}%`);
      console.log(`      Log Loss:  ${model.logLoss.toFixed(4)}`);
      console.log(`      Training:  ${model.numTrainingSamples} samples`);
      console.log(`      Created:   ${model.createdAt.toLocaleDateString()}`);
      if (model.activatedAt) {
        console.log(`      Activated: ${model.activatedAt.toLocaleDateString()}`);
      }
      console.log('');
    });
  }

  // 2. Predictions Summary
  console.log('\n🔮 Recent Predictions:');
  console.log('-'.repeat(80));
  const predictionsCount = await prisma.prediction.count();
  const recentPredictions = await prisma.prediction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: {
      policyDecision: true,
    },
  });

  console.log(`   Total Predictions: ${predictionsCount}`);
  console.log('');

  if (recentPredictions.length > 0) {
    recentPredictions.forEach((pred, i) => {
      const decision = pred.policyDecision ? `→ ${pred.policyDecision.status}` : 'Pending';
      const confidence = (pred.confidence * 100).toFixed(1);
      console.log(`   ${i + 1}. ${pred.homeTeam} vs ${pred.awayTeam}`);
      console.log(`      Date:      ${pred.matchDate.toLocaleDateString()}`);
      console.log(`      Winner:    ${pred.winnerPrediction}`);
      console.log(`      Score:     ${pred.scorePrediction}`);
      console.log(`      Confidence: ${confidence}%`);
      console.log(`      Model:     ${pred.modelVersion}`);
      console.log(`      Decision:  ${decision}`);
      console.log('');
    });
  } else {
    console.log('   No predictions found.\n');
  }

  // 3. Policy Decisions Stats
  console.log('\n📈 Policy Decisions:');
  console.log('-'.repeat(80));
  const decisionStats = await prisma.policyDecision.groupBy({
    by: ['status'],
    _count: {
      status: true,
    },
  });

  if (decisionStats.length === 0) {
    console.log('   No decisions found.\n');
  } else {
    decisionStats.forEach((stat) => {
      const emoji = stat.status === 'PICK' ? '✅' : stat.status === 'NO_BET' ? '⛔' : '🛑';
      console.log(`   ${emoji} ${stat.status}: ${stat._count.status}`);
    });
    const total = decisionStats.reduce((sum, s) => sum + s._count.status, 0);
    console.log(`   📊 Total: ${total}`);
  }

  // 4. Performance Metrics (if available)
  console.log('\n🎯 Performance Metrics:');
  console.log('-'.repeat(80));
  const resolvedPredictions = await prisma.predictionLog.findMany({
    where: { correct: { not: null } },
    take: 100,
  });

  if (resolvedPredictions.length > 0) {
    const correct = resolvedPredictions.filter(p => p.correct).length;
    const accuracy = (correct / resolvedPredictions.length * 100).toFixed(2);
    console.log(`   Resolved Predictions: ${resolvedPredictions.length}`);
    console.log(`   Correct: ${correct}`);
    console.log(`   Accuracy: ${accuracy}%`);
  } else {
    console.log('   No resolved predictions yet.\n');
  }

  console.log('\n========================================');
  console.log('End of Report');
  console.log('========================================\n');

  await prisma.$disconnect();
}

showMLStats().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
