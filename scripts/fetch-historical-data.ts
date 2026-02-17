/**
 * Fetch Historical NBA Data Script
 * 
 * Usage:
 *   npx ts-node scripts/fetch-historical-data.ts --start-date 2023-01-01 --end-date 2024-01-01
 */

import { createHistoricalDataService } from '@/server/ml/data/historical-data-service';
import { prisma } from '@/server/db/client';

interface FetchOptions {
  startDate: Date;
  endDate: Date;
  onlyCompleted: boolean;
}

function parseArgs(): FetchOptions {
  const args = process.argv.slice(2);
  const options: FetchOptions = {
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // Default: 1 year ago
    endDate: new Date(),
    onlyCompleted: true,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--start-date':
        options.startDate = new Date(args[++i]);
        break;
      case '--end-date':
        options.endDate = new Date(args[++i]);
        break;
      case '--include-scheduled':
        options.onlyCompleted = false;
        break;
    }
  }

  return options;
}

async function fetchHistoricalData(): Promise<void> {
  const options = parseArgs();

  console.log('='.repeat(60));
  console.log('NBA Analyst - Fetch Historical Data');
  console.log('='.repeat(60));
  console.log();
  console.log('Configuration:');
  console.log(`  Start Date: ${options.startDate.toISOString().split('T')[0]}`);
  console.log(`  End Date: ${options.endDate.toISOString().split('T')[0]}`);
  console.log(`  Only Completed: ${options.onlyCompleted}`);
  console.log();
  console.log('='.repeat(60));
  console.log();

  // Check current data
  const stats = await prisma.$queryRaw`SELECT COUNT(*) as count FROM games`;
  const existingCount = parseInt((stats as any)[0]?.count || 0);
  console.log(`Existing games in database: ${existingCount}`);
  console.log();

  const dataService = createHistoricalDataService();

  // Setup progress callback
  const startTime = Date.now();
  
  const result = await dataService.fetchHistoricalGames(
    {
      startDate: options.startDate,
      endDate: options.endDate,
      onlyCompleted: options.onlyCompleted,
    },
    (progress) => {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = progress.fetchedGames / elapsed;
      const remaining = (progress.totalGames - progress.fetchedGames) / rate;
      
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
      process.stdout.write(
        `[${progress.fetchedGames}/${progress.totalGames}] ` +
        `Fetched: ${progress.fetchedGames} | ` +
        `Failed: ${progress.failedGames} | ` +
        `Rate: ${rate.toFixed(1)} games/sec | ` +
        `ETA: ${Math.round(remaining)}s`
      );
    }
  );

  console.log();
  console.log();
  console.log('='.repeat(60));
  console.log('Fetch Complete!');
  console.log('='.repeat(60));
  console.log();
  console.log(`Games fetched: ${result.gamesFetched}`);
  console.log(`Games failed: ${result.gamesFailed}`);
  console.log(`Success rate: ${((result.gamesFetched / (result.gamesFetched + result.gamesFailed)) * 100).toFixed(1)}%`);
  console.log();

  // Check final stats
  const finalStats = await dataService.getTrainingStats();
  console.log('Database stats:');
  console.log(`  Total games: ${finalStats.totalGames}`);
  console.log(`  With box scores: ${finalStats.gamesWithBoxScores}`);
  console.log(`  Teams: ${finalStats.teams}`);
  console.log(`  Date range: ${finalStats.dateRange.earliest?.toISOString().split('T')[0]} to ${finalStats.dateRange.latest?.toISOString().split('T')[0]}`);
  console.log();

  if (await dataService.hasEnoughDataForTraining(100)) {
    console.log('Sufficient data for training!');
    console.log('Run: npx ts-node scripts/train-ml-model.ts');
  } else {
    console.log('WARNING: Not enough data for training');
    console.log('Need at least 100 games with box scores');
  }

  console.log();
}

fetchHistoricalData().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
