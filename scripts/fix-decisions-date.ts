/**
 * Fix Decisions Date
 * Updates existing decisions to today's date so they appear in the dashboard
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing decisions dates...\n');
  
  // Get today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  
  console.log(`📅 Today's date: ${todayStr}\n`);
  
  // Find all existing decisions
  const existingDecisions = await prisma.policyDecision.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  
  console.log(`📊 Found ${existingDecisions.length} existing decisions\n`);
  
  if (existingDecisions.length === 0) {
    console.log('❌ No decisions found. Run demo-daily-run.ts first.');
    return;
  }
  
  // Update decisions to today
  console.log('📝 Updating decisions to today...\n');
  
  for (const decision of existingDecisions) {
    await prisma.policyDecision.update({
      where: { id: decision.id },
      data: {
        matchDate: today,
        createdAt: new Date(), // Update to now
      },
    });
    console.log(`   ✓ Updated: ${decision.homeTeam} vs ${decision.awayTeam}`);
  }
  
  // Update predictions too
  const existingPredictions = await prisma.prediction.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  
  console.log(`\n📝 Updating ${existingPredictions.length} predictions...\n`);
  
  for (const prediction of existingPredictions) {
    await prisma.prediction.update({
      where: { id: prediction.id },
      data: {
        matchDate: today,
        createdAt: new Date(),
      },
    });
  }
  
  // Update daily run
  const dailyRun = await prisma.dailyRun.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  
  if (dailyRun) {
    await prisma.dailyRun.update({
      where: { id: dailyRun.id },
      data: {
        runDate: today,
      },
    });
    console.log(`   ✓ Updated DailyRun to ${todayStr}`);
  }
  
  console.log('\n✅ All dates updated to today!');
  console.log('\n🌐 Refresh the dashboard to see the decisions');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
