/**
 * Benchmark Data Loader
 * 
 * Extract 1000 test games from DuckDB for fair model comparison
 * Creates compatible features for both Python V3 and TypeScript models
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface TestGame {
  gameId: string;
  date: string;
  season: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeWon: boolean;
  // Python V3 features
  pythonV3Features: {
    elo_diff: number;
    elo_diff_norm: number;
    home_last10_wins: number;
    away_last10_wins: number;
    spread_num: number;
    over_under: number;
    ml_home_prob: number;
    ml_away_prob: number;
    rest_days_home: number;
    rest_days_away: number;
    season_norm: number;
  };
  // TypeScript features (basic)
  tsFeatures: {
    homeWinRate: number;
    awayWinRate: number;
    homeForm: number;
    awayForm: number;
    daysRestDiff: number;
    isBackToBack: number;
  };
}

async function americanOddsToProb(odds: number): Promise<number> {
  if (!odds || odds === 0) return 0.5;
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}

async function loadTestData(): Promise<TestGame[]> {
  console.log('='.repeat(70));
  console.log('BENCHMARK DATA LOADER');
  console.log('Extracting 1000 test games from season 2023');
  console.log('='.repeat(70));
  console.log();

  // Get games from 2023 season with ELO ratings
  const games = await prisma.$queryRaw`
    SELECT 
      g.game_id,
      g.date::text,
      g.season,
      g.home_team,
      g.away_team,
      g.home_score,
      g.away_score,
      CASE WHEN g.home_score > g.away_score THEN 1 ELSE 0 END as home_won,
      g.elo_home_before,
      g.elo_away_before
    FROM github_games g
    WHERE g.season = 2023
    AND g.elo_home_before IS NOT NULL
    AND g.date >= '2023-01-01'::date
    AND g.date <= '2023-12-31'::date
    ORDER BY RANDOM()
    LIMIT 1000
  `;

  console.log(`Found ${(games as any[]).length} games from 2023`);

  const testGames: TestGame[] = [];
  let processed = 0;

  for (const game of games as any[]) {
    // Get recent form (last 10 games for each team)
    const homeForm = await prisma.$queryRaw`
      SELECT 
        COUNT(*) FILTER (WHERE home_score > away_score) as wins,
        COUNT(*) as total
      FROM github_games
      WHERE home_team = ${game.home_team}
      AND date < ${game.date}::date
      AND date >= (${game.date}::date - INTERVAL '30 days')
      LIMIT 10
    `;

    const awayForm = await prisma.$queryRaw`
      SELECT 
        COUNT(*) FILTER (WHERE away_score > home_score) as wins,
        COUNT(*) as total
      FROM github_games
      WHERE away_team = ${game.away_team}
      AND date < ${game.date}::date
      AND date >= (${game.date}::date - INTERVAL '30 days')
      LIMIT 10
    `;

    // Get season win rates
    const homeWinRate = await prisma.$queryRaw`
      SELECT 
        COUNT(*) FILTER (WHERE home_score > away_score)::float / 
        NULLIF(COUNT(*), 0)::float as win_rate
      FROM github_games
      WHERE home_team = ${game.home_team}
      AND season = ${game.season}
      AND date < ${game.date}::date
    `;

    const awayWinRate = await prisma.$queryRaw`
      SELECT 
        COUNT(*) FILTER (WHERE away_score > home_score)::float / 
        NULLIF(COUNT(*), 0)::float as win_rate
      FROM github_games
      WHERE away_team = ${game.away_team}
      AND season = ${game.season}
      AND date < ${game.date}::date
    `;

    // Get odds if available (use defaults if not)
    const odds = await prisma.$queryRaw`
      SELECT spread, over_under, ml_home, ml_away
      FROM odds_historical
      WHERE season = ${game.season}
      AND home_team ILIKE ${'%' + game.home_team + '%'}
      AND away_team ILIKE ${'%' + game.away_team + '%'}
      LIMIT 1
    `;

    const oddsData = (odds as any[])[0] || { spread: -5, over_under: 220, ml_home: -150, ml_away: 130 };

    // Calculate features
    const hForm = ((homeForm as any[])[0]?.total > 0) 
      ? (homeForm as any[])[0].wins / (homeForm as any[])[0].total 
      : 0.5;
    const aForm = ((awayForm as any[])[0]?.total > 0)
      ? (awayForm as any[])[0].wins / (awayForm as any[])[0].total
      : 0.5;

    const hWinRate = (homeWinRate as any[])[0]?.win_rate || 0.5;
    const aWinRate = (awayWinRate as any[])[0]?.win_rate || 0.5;

    const eloDiff = game.elo_home_before - game.elo_away_before;
    const mlHomeProb = await americanOddsToProb(oddsData.ml_home);
    const mlAwayProb = await americanOddsToProb(oddsData.ml_away);

    testGames.push({
      gameId: game.game_id,
      date: game.date,
      season: game.season,
      homeTeam: game.home_team,
      awayTeam: game.away_team,
      homeScore: game.home_score,
      awayScore: game.away_score,
      homeWon: game.home_won === 1,
      pythonV3Features: {
        elo_diff: eloDiff,
        elo_diff_norm: (eloDiff + 400) / 800,
        home_last10_wins: hForm,
        away_last10_wins: aForm,
        spread_num: parseFloat(oddsData.spread) || -5,
        over_under: parseFloat(oddsData.over_under) || 220,
        ml_home_prob: mlHomeProb,
        ml_away_prob: mlAwayProb,
        rest_days_home: 2, // Default
        rest_days_away: 2, // Default
        season_norm: (game.season - 2010) / 15,
      },
      tsFeatures: {
        homeWinRate: hWinRate,
        awayWinRate: aWinRate,
        homeForm: hForm,
        awayForm: aForm,
        daysRestDiff: 0, // Simplified
        isBackToBack: 0, // Simplified
      },
    });

    processed++;
    if (processed % 100 === 0) {
      console.log(`  Processed ${processed}/${(games as any[]).length} games...`);
    }
  }

  // Save to file
  const outputPath = path.join(process.cwd(), 'benchmark-test-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(testGames, null, 2));

  console.log();
  console.log('='.repeat(70));
  console.log('DATA PREPARATION COMPLETE');
  console.log('='.repeat(70));
  console.log(`Total games: ${testGames.length}`);
  console.log(`Home wins: ${testGames.filter(g => g.homeWon).length}`);
  console.log(`Away wins: ${testGames.filter(g => !g.homeWon).length}`);
  console.log(`File saved: ${outputPath}`);
  console.log();

  return testGames;
}

// Run if called directly
if (require.main === module) {
  loadTestData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

export { loadTestData };
