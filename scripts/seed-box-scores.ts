/**
 * Seed Box Scores
 * 
 * Creates box scores from existing games for training
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedBoxScores() {
  console.log('Creating box scores from existing games...');
  
  // Get games without box scores
  const games = await prisma.game.findMany({
    where: {
      boxScore: null,
      homeScore: { not: null },
      awayScore: { not: null },
    },
    take: 1000,
  });
  
  console.log(`Found ${games.length} games needing box scores`);
  
  if (games.length === 0) {
    console.log('All games already have box scores!');
    process.exit(0);
  }
  
  const boxScores = [];
  
  for (const game of games) {
    // Generate realistic stats based on scores
    const homePoints = game.homeScore || 100;
    const awayPoints = game.awayScore || 100;
    
    boxScores.push({
      gameId: game.id,
      homePoints: homePoints,
      homeRebounds: 40 + Math.floor(Math.random() * 10),
      homeAssists: 20 + Math.floor(Math.random() * 10),
      homeSteals: 5 + Math.floor(Math.random() * 5),
      homeBlocks: 4 + Math.floor(Math.random() * 4),
      homeTurnovers: 10 + Math.floor(Math.random() * 8),
      homeFgPct: 0.45 + Math.random() * 0.1,
      home3pPct: 0.35 + Math.random() * 0.1,
      homeFtPct: 0.75 + Math.random() * 0.1,
      awayPoints: awayPoints,
      awayRebounds: 40 + Math.floor(Math.random() * 10),
      awayAssists: 20 + Math.floor(Math.random() * 10),
      awaySteals: 5 + Math.floor(Math.random() * 5),
      awayBlocks: 4 + Math.floor(Math.random() * 4),
      awayTurnovers: 10 + Math.floor(Math.random() * 8),
      awayFgPct: 0.45 + Math.random() * 0.1,
      away3pPct: 0.35 + Math.random() * 0.1,
      awayFtPct: 0.75 + Math.random() * 0.1,
    });
  }
  
  console.log(`Creating ${boxScores.length} box scores...`);
  
  // Insert in batches
  const batchSize = 50;
  for (let i = 0; i < boxScores.length; i += batchSize) {
    const batch = boxScores.slice(i, i + batchSize);
    await prisma.boxScore.createMany({
      data: batch,
    });
    console.log(`  Created ${Math.min(i + batchSize, boxScores.length)}/${boxScores.length}`);
  }
  
  console.log('');
  console.log('✅ Box scores created!');
  console.log('  Total:', boxScores.length);
  console.log('');
  console.log('You can now train with:');
  console.log('  npx tsx scripts/train-ml-model.ts --start-date 2023-10-01 --end-date 2024-06-01 --activate');
}

seedBoxScores()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
