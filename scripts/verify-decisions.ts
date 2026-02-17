/**
 * Verify Decisions Data
 * Checks that decisions have proper dates and displays them
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verifying Decisions Data\n');
  
  // Get all decisions
  const decisions = await prisma.policyDecision.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  
  console.log(`📊 Found ${decisions.length} decisions\n`);
  
  if (decisions.length === 0) {
    console.log('❌ No decisions found.');
    return;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  console.log('📋 Decision Details:\n');
  decisions.forEach((d, i) => {
    const matchDate = d.matchDate ? new Date(d.matchDate) : null;
    const isToday = matchDate && matchDate.toISOString().split('T')[0] === today.toISOString().split('T')[0];
    
    console.log(`${i + 1}. ${d.homeTeam} vs ${d.awayTeam}`);
    console.log(`   Status: ${d.status}`);
    console.log(`   Match Date: ${d.matchDate?.toISOString() || 'NULL'} ${isToday ? '✅' : '⚠️'}`);
    console.log(`   Created At: ${d.createdAt.toISOString()}`);
    console.log();
  });
  
  // Check decisions for today
  const todayStr = today.toISOString().split('T')[0];
  const todayDecisions = await prisma.policyDecision.findMany({
    where: {
      matchDate: {
        gte: new Date(todayStr + 'T00:00:00.000Z'),
        lte: new Date(todayStr + 'T23:59:59.999Z'),
      },
    },
  });
  
  console.log(`📅 Decisions for today (${todayStr}): ${todayDecisions.length}\n`);
  
  if (todayDecisions.length > 0) {
    console.log('✅ Dashboard should display these decisions correctly!');
  } else {
    console.log('⚠️ No decisions for today. The dashboard will be empty.');
    console.log('Run: npx tsx scripts/fix-decisions-date.ts');
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
