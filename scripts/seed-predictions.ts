/**
 * Seed Predictions
 * 
 * Creates predictions with confirmed results for training
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPredictions() {
  console.log('Creating predictions with confirmed results...');
  
  // Get games from database
  const games = await prisma.game.findMany({
    where: {
      season: 2023,
    },
    take: 400,
  });
  
  console.log(`Found ${games.length} games`);
  
  if (games.length === 0) {
    console.log('No games found. Run seed-realistic-games.ts first!');
    process.exit(1);
  }
  
  // Delete existing predictions
  const deleted = await prisma.prediction.deleteMany({
    where: {
      matchDate: {
        gte: new Date('2023-10-01'),
        lte: new Date('2024-06-01'),
      },
    },
  });
  console.log(`Deleted ${deleted.count} existing predictions`);
  
  const predictions = [];
  
  for (const game of games) {
    const homeWon = game.homeScore > game.awayScore;
    
    predictions.push({
      matchId: game.externalId.toString(),
      matchDate: game.gameDate,
      homeTeam: game.homeTeamName,
      awayTeam: game.awayTeamName,
      predictedWinner: homeWon ? 'HOME' : 'AWAY',
      winnerPrediction: homeWon ? 'HOME' : 'AWAY',
      confidence: 0.6 + Math.random() * 0.3,
      homeWinProbability: homeWon ? 0.7 : 0.3,
      awayWinProbability: homeWon ? 0.3 : 0.7,
      modelVersion: 'seed-v1',
      features: {},
      status: 'confirmed',
      createdAt: new Date(game.gameDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
      updatedAt: game.gameDate,
    });
  }
  
  console.log(`Creating ${predictions.length} predictions...`);
  
  // Insert in batches
  const batchSize = 50;
  for (let i = 0; i < predictions.length; i += batchSize) {
    const batch = predictions.slice(i, i + batchSize);
    await prisma.prediction.createMany({
      data: batch,
    });
    console.log(`  Created ${Math.min(i + batchSize, predictions.length)}/${predictions.length}`);
  }
  
  console.log('');
  console.log('✅ Predictions seeded!');
  console.log('  Total:', predictions.length);
  console.log('');
  console.log('Now you can train with:');
  console.log('  npx tsx scripts/train-ml-model.ts --start-date 2023-10-01 --end-date 2024-06-01 --activate');
}

seedPredictions()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
