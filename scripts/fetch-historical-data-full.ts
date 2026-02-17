import { PrismaClient } from '@prisma/client';
import { PlayerIngestionService } from '../src/server/ingestion/services/player-ingestion-service';
import { PlayerDataProvider } from '../src/server/ingestion/providers/player-data-provider';
import { NBACDNProvider } from '../src/server/ingestion/providers/nba-cdn-provider';

/**
 * Fetch Historical Data with Player Stats
 * Phase 6 Implementation - Full data fetch with player information
 */

interface FetchFullOptions {
  startDate: Date;
  endDate: Date;
  includePlayers: boolean;
  includeInjuries: boolean;
  updateRosters: boolean;
  season: number;
  resumeFromLast?: boolean;
}

interface FetchProgress {
  season: number;
  gamesCompleted: number;
  gamesTotal: number;
  playerGamesStored: number;
  lastSuccessfulDate: Date | null;
  errors: string[];
}

const prisma = new PrismaClient();

const playerProvider = new PlayerDataProvider({
  name: 'nba-cdn-player',
  baseUrl: 'https://cdn.nba.com',
  timeout: 15000,
  rateLimit: 60,
  retryConfig: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
  },
});

const nbaProvider = new NBACDNProvider({
  name: 'nba-cdn',
  baseUrl: 'https://cdn.nba.com',
  timeout: 15000,
  rateLimit: 60,
});

const playerIngestionService = new PlayerIngestionService(prisma, playerProvider);

/**
 * Save progress to database
 */
async function saveProgress(progress: FetchProgress): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO fetch_progress (
      season, games_completed, games_total, player_games_stored, 
      last_successful_date, errors, updated_at
    ) VALUES (
      ${progress.season}, ${progress.gamesCompleted}, ${progress.gamesTotal},
      ${progress.playerGamesStored}, ${progress.lastSuccessfulDate}, 
      ${JSON.stringify(progress.errors)}, NOW()
    )
    ON CONFLICT (season) DO UPDATE SET
      games_completed = EXCLUDED.games_completed,
      games_total = EXCLUDED.games_total,
      player_games_stored = EXCLUDED.player_games_stored,
      last_successful_date = EXCLUDED.last_successful_date,
      errors = EXCLUDED.errors,
      updated_at = NOW()
  `;
}

/**
 * Load progress from database
 */
async function loadProgress(season: number): Promise<FetchProgress | null> {
  const result = await prisma.$queryRaw<FetchProgress[]>`
    SELECT season, games_completed, games_total, player_games_stored,
           last_successful_date, errors
    FROM fetch_progress
    WHERE season = ${season}
  `;
  
  return result.length > 0 ? result[0] : null;
}

/**
 * Fetch games for a date range
 */
async function fetchGamesForDateRange(
  startDate: Date,
  endDate: Date,
  options: FetchFullOptions
): Promise<void> {
  const progress: FetchProgress = {
    season: options.season,
    gamesCompleted: 0,
    gamesTotal: 0,
    playerGamesStored: 0,
    lastSuccessfulDate: null,
    errors: [],
  };

  // Load existing progress if resuming
  if (options.resumeFromLast) {
    const existingProgress = await loadProgress(options.season);
    if (existingProgress) {
      progress.gamesCompleted = existingProgress.gamesCompleted;
      progress.playerGamesStored = existingProgress.playerGamesStored;
      progress.errors = existingProgress.errors;
      console.log(`Resuming from ${existingProgress.gamesCompleted} games completed`);
    }
  }

  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    console.log(`\nFetching games for ${dateStr}...`);

    try {
      // Fetch games for this date
      const scheduleResult = await nbaProvider.getGamesByDate(dateStr);
      const games = scheduleResult.data.games;

      progress.gamesTotal += games.length;

      for (const game of games) {
        try {
          // Check if game already exists
          const existingGame = await prisma.game.findUnique({
            where: { externalId: game.id },
          });

          let gameId: string;

          if (existingGame) {
            gameId = existingGame.id;
            console.log(`  Game ${game.id} already exists, skipping...`);
          } else {
            // Store game
            const createdGame = await prisma.game.create({
              data: {
                externalId: game.id,
                season: options.season,
                seasonType: game.seasonType,
                gameDate: new Date(game.date),
                status: game.status,
                homeTeamId: game.homeTeam.id,
                homeTeamName: game.homeTeam.name,
                homeTeamAbbreviation: game.homeTeam.abbreviation,
                homeTeamConference: game.homeTeam.conference,
                awayTeamId: game.awayTeam.id,
                awayTeamName: game.awayTeam.name,
                awayTeamAbbreviation: game.awayTeam.abbreviation,
                awayTeamConference: game.awayTeam.conference,
                homeScore: game.homeScore,
                awayScore: game.awayScore,
                arena: game.arena,
                attendance: game.attendance,
              },
            });
            gameId = createdGame.id;
            console.log(`  Stored game ${game.id}: ${game.homeTeam.name} vs ${game.awayTeam.name}`);
          }

          // Fetch and store player stats if enabled
          if (options.includePlayers) {
            try {
              const statsResult = await playerIngestionService.fetchAndStorePlayerGameStats(
                gameId,
                game.id,
                options.season
              );
              progress.playerGamesStored += statsResult.statsAdded;
              
              if (statsResult.errors.length > 0) {
                progress.errors.push(...statsResult.errors);
              }
              
              console.log(`    Stored ${statsResult.statsAdded} player game stats`);
            } catch (error) {
              const msg = error instanceof Error ? error.message : 'Unknown error';
              progress.errors.push(`Player stats for game ${game.id}: ${msg}`);
              console.error(`    Error fetching player stats: ${msg}`);
            }
          }

          progress.gamesCompleted++;
          progress.lastSuccessfulDate = new Date(dateStr);

          // Save progress every 10 games
          if (progress.gamesCompleted % 10 === 0) {
            await saveProgress(progress);
            console.log(`  Progress saved: ${progress.gamesCompleted}/${progress.gamesTotal} games`);
          }

          // Rate limiting - wait between games
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          progress.errors.push(`Game ${game.id}: ${msg}`);
          console.error(`  Error processing game ${game.id}: ${msg}`);
        }
      }

      // Fetch injury reports if enabled
      if (options.includeInjuries) {
        try {
          const injuryResult = await playerIngestionService.fetchAndStoreInjuryReports(
            dateStr,
            options.season
          );
          console.log(`  Stored ${injuryResult.injuriesAdded} injury reports`);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`  Error fetching injuries: ${msg}`);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      progress.errors.push(`Date ${dateStr}: ${msg}`);
      console.error(`Error fetching games for ${dateStr}: ${msg}`);
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);

    // Rate limiting - wait between dates
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Final progress save
  await saveProgress(progress);

  console.log(`\n=== Fetch Complete ===`);
  console.log(`Games processed: ${progress.gamesCompleted}/${progress.gamesTotal}`);
  console.log(`Player games stored: ${progress.playerGamesStored}`);
  console.log(`Errors: ${progress.errors.length}`);

  // Update rosters if enabled
  if (options.updateRosters) {
    console.log('\nUpdating team rosters...');
    const rosterResult = await playerIngestionService.fetchAndStoreRosters(options.season);
    console.log(`Rosters updated: ${rosterResult.playersAdded} added, ${rosterResult.playersUpdated} updated`);

    // Update season stats
    console.log('\nUpdating player season stats...');
    await playerIngestionService.updatePlayerSeasonStats(options.season);
    console.log('Player season stats updated');
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Parse arguments
  const startDateStr = args.find(arg => arg.startsWith('--start-date='))?.split('=')[1];
  const endDateStr = args.find(arg => arg.startsWith('--end-date='))?.split('=')[1];
  const seasonStr = args.find(arg => arg.startsWith('--season='))?.split('=')[1];
  const includePlayers = args.includes('--include-players');
  const includeInjuries = args.includes('--include-injuries');
  const updateRosters = args.includes('--update-rosters');
  const resumeFromLast = args.includes('--resume-from-last');

  if (!startDateStr || !endDateStr || !seasonStr) {
    console.error('Usage: npx ts-node scripts/fetch-historical-data-full.ts --start-date=YYYY-MM-DD --end-date=YYYY-MM-DD --season=YYYY [--include-players] [--include-injuries] [--update-rosters] [--resume-from-last]');
    process.exit(1);
  }

  const options: FetchFullOptions = {
    startDate: new Date(startDateStr),
    endDate: new Date(endDateStr),
    includePlayers,
    includeInjuries,
    updateRosters,
    season: parseInt(seasonStr, 10),
    resumeFromLast,
  };

  console.log('=== NBA Historical Data Fetch with Player Stats ===');
  console.log(`Season: ${options.season}`);
  console.log(`Date range: ${startDateStr} to ${endDateStr}`);
  console.log(`Include players: ${options.includePlayers}`);
  console.log(`Include injuries: ${options.includeInjuries}`);
  console.log(`Update rosters: ${options.updateRosters}`);
  console.log(`Resume from last: ${options.resumeFromLast}`);
  console.log('');

  try {
    await fetchGamesForDateRange(options.startDate, options.endDate, options);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
