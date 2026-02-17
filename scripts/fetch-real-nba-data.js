#!/usr/bin/env node
/**
 * Fetch Real NBA Data
 * 
 * Fetches actual NBA game data from public APIs.
 * Uses ESPN API (free, no key required for basic data).
 * 
 * Usage: node scripts/fetch-real-nba-data.js --start-date 2023-10-01 --end-date 2024-02-01
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  switch (type) {
    case 'success':
      console.log(`${colors.green}[${timestamp}] ✓ ${message}${colors.reset}`);
      break;
    case 'warning':
      console.log(`${colors.yellow}[${timestamp}] ⚠ ${message}${colors.reset}`);
      break;
    case 'error':
      console.log(`${colors.red}[${timestamp}] ✗ ${message}${colors.reset}`);
      break;
    case 'dim':
      console.log(`${colors.dim}[${timestamp}] ${message}${colors.reset}`);
      break;
    default:
      console.log(`${colors.cyan}[${timestamp}] ℹ ${message}${colors.reset}`);
  }
}

// ESPN API Base URL
const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

// Rate limiting
const RATE_LIMIT_MS = 1000; // 1 request per second to be respectful

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchFromESPN(endpoint) {
  const url = `${ESPN_API_BASE}${endpoint}`;
  log(`Fetching: ${url}`, 'dim');
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    log(`ESPN API error: ${error.message}`, 'error');
    return null;
  }
}

async function fetchTeams() {
  log('Fetching NBA teams from ESPN...', 'info');
  
  const data = await fetchFromESPN('/teams');
  if (!data || !data.sports) {
    log('Failed to fetch teams', 'error');
    return [];
  }
  
  const teams = [];
  const leagues = data.sports[0]?.leagues || [];
  
  for (const league of leagues) {
    for (const team of league.teams || []) {
      const t = team.team;
      teams.push({
        id: parseInt(t.id),
        name: t.name,
        abbreviation: t.abbreviation,
        conference: t.conference || 'Unknown',
        city: t.location || t.city || 'Unknown',
      });
    }
  }
  
  log(`Found ${teams.length} teams`, 'success');
  return teams;
}

async function fetchGamesForDate(date) {
  // ESPN format: YYYYMMDD
  const dateStr = date.replace(/-/g, '');
  
  const data = await fetchFromESPN(`/scoreboard?dates=${dateStr}`);
  if (!data || !data.events) {
    return [];
  }
  
  const games = [];
  
  for (const event of data.events) {
    try {
      const competition = event.competitions?.[0];
      if (!competition) continue;
      
      const homeTeam = competition.competitors?.find(c => c.homeAway === 'home');
      const awayTeam = competition.competitors?.find(c => c.homeAway === 'away');
      
      if (!homeTeam || !awayTeam) continue;
      
      // Get scores
      const homeScore = parseInt(homeTeam.score) || 0;
      const awayScore = parseInt(awayTeam.score) || 0;
      const isCompleted = event.status?.type?.completed === true || 
                         event.status?.type?.state === 'post';
      
      games.push({
        externalId: parseInt(event.id),
        season: 2024,
        seasonType: 'Regular Season',
        gameDate: new Date(event.date),
        status: isCompleted ? 'completed' : 'scheduled',
        homeTeamId: parseInt(homeTeam.team?.id),
        homeTeamName: homeTeam.team?.name || 'Unknown',
        homeTeamAbbreviation: homeTeam.team?.abbreviation || 'UNK',
        homeTeamConference: homeTeam.team?.conference || 'Unknown',
        awayTeamId: parseInt(awayTeam.team?.id),
        awayTeamName: awayTeam.team?.name || 'Unknown',
        awayTeamAbbreviation: awayTeam.team?.abbreviation || 'UNK',
        awayTeamConference: awayTeam.team?.conference || 'Unknown',
        homeScore: isCompleted ? homeScore : null,
        awayScore: isCompleted ? awayScore : null,
      });
    } catch (error) {
      log(`Error parsing game: ${error.message}`, 'warning');
    }
  }
  
  return games;
}

async function fetchBoxScore(gameId) {
  const data = await fetchFromESPN(`/summary?event=${gameId}`);
  if (!data || !data.boxscore) {
    return null;
  }
  
  const box = data.boxscore;
  
  // Extract team stats
  const homeStats = box.teams?.find(t => t.homeAway === 'home');
  const awayStats = box.teams?.find(t => t.homeAway === 'away');
  
  if (!homeStats || !awayStats) return null;
  
  return {
    homePoints: parseInt(homeStats.statistics?.find(s => s.name === 'points')?.displayValue) || 0,
    homeRebounds: parseInt(homeStats.statistics?.find(s => s.name === 'rebounds')?.displayValue) || 0,
    homeAssists: parseInt(homeStats.statistics?.find(s => s.name === 'assists')?.displayValue) || 0,
    homeSteals: parseInt(homeStats.statistics?.find(s => s.name === 'steals')?.displayValue) || 0,
    homeBlocks: parseInt(homeStats.statistics?.find(s => s.name === 'blocks')?.displayValue) || 0,
    homeTurnovers: parseInt(homeStats.statistics?.find(s => s.name === 'turnovers')?.displayValue) || 0,
    homeFgPct: parseFloat(homeStats.statistics?.find(s => s.name === 'fieldGoalPct')?.displayValue) / 100 || 0.45,
    home3pPct: parseFloat(homeStats.statistics?.find(s => s.name === 'threePointFieldGoalPct')?.displayValue) / 100 || 0.35,
    homeFtPct: parseFloat(homeStats.statistics?.find(s => s.name === 'freeThrowPct')?.displayValue) / 100 || 0.75,
    awayPoints: parseInt(awayStats.statistics?.find(s => s.name === 'points')?.displayValue) || 0,
    awayRebounds: parseInt(awayStats.statistics?.find(s => s.name === 'rebounds')?.displayValue) || 0,
    awayAssists: parseInt(awayStats.statistics?.find(s => s.name === 'assists')?.displayValue) || 0,
    awaySteals: parseInt(awayStats.statistics?.find(s => s.name === 'steals')?.displayValue) || 0,
    awayBlocks: parseInt(awayStats.statistics?.find(s => s.name === 'blocks')?.displayValue) || 0,
    awayTurnovers: parseInt(awayStats.statistics?.find(s => s.name === 'turnovers')?.displayValue) || 0,
    awayFgPct: parseFloat(awayStats.statistics?.find(s => s.name === 'fieldGoalPct')?.displayValue) / 100 || 0.43,
    away3pPct: parseFloat(awayStats.statistics?.find(s => s.name === 'threePointFieldGoalPct')?.displayValue) / 100 || 0.33,
    awayFtPct: parseFloat(awayStats.statistics?.find(s => s.name === 'freeThrowPct')?.displayValue) / 100 || 0.73,
  };
}

async function saveGame(game, boxScore) {
  const gameId = `game-${game.externalId}`;
  
  // Insert game
  await prisma.$executeRaw`
    INSERT INTO games (
      id, external_id, season, season_type, game_date, status,
      home_team_id, home_team_name, home_team_abbreviation, home_team_conference,
      away_team_id, away_team_name, away_team_abbreviation, away_team_conference,
      home_score, away_score, fetched_at, updated_at
    ) VALUES (
      ${gameId}, ${game.externalId}, ${game.season}, ${game.seasonType}, ${game.gameDate}, ${game.status},
      ${game.homeTeamId}, ${game.homeTeamName}, ${game.homeTeamAbbreviation}, ${game.homeTeamConference},
      ${game.awayTeamId}, ${game.awayTeamName}, ${game.awayTeamAbbreviation}, ${game.awayTeamConference},
      ${game.homeScore}, ${game.awayScore}, NOW(), NOW()
    )
    ON CONFLICT (external_id) DO UPDATE SET
      home_score = EXCLUDED.home_score,
      away_score = EXCLUDED.away_score,
      status = EXCLUDED.status,
      updated_at = NOW()
  `;
  
  // Insert box score if available
  if (boxScore) {
    await prisma.$executeRaw`
      INSERT INTO box_scores (
        id, game_id,
        home_points, home_rebounds, home_assists, home_steals, home_blocks, home_turnovers,
        home_fg_pct, home_3p_pct, home_ft_pct,
        away_points, away_rebounds, away_assists, away_steals, away_blocks, away_turnovers,
        away_fg_pct, away_3p_pct, away_ft_pct,
        fetched_at
      ) VALUES (
        ${`bs-${game.externalId}`}, ${gameId},
        ${boxScore.homePoints}, ${boxScore.homeRebounds}, ${boxScore.homeAssists}, 
        ${boxScore.homeSteals}, ${boxScore.homeBlocks}, ${boxScore.homeTurnovers},
        ${boxScore.homeFgPct}, ${boxScore.home3pPct}, ${boxScore.homeFtPct},
        ${boxScore.awayPoints}, ${boxScore.awayRebounds}, ${boxScore.awayAssists},
        ${boxScore.awaySteals}, ${boxScore.awayBlocks}, ${boxScore.awayTurnovers},
        ${boxScore.awayFgPct}, ${boxScore.away3pPct}, ${boxScore.awayFtPct},
        NOW()
      )
      ON CONFLICT (game_id) DO UPDATE SET
        home_points = EXCLUDED.home_points,
        home_rebounds = EXCLUDED.home_rebounds,
        away_points = EXCLUDED.away_points,
        away_rebounds = EXCLUDED.away_rebounds,
        fetched_at = NOW()
    `;
    return true;
  }
  
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parse dates
  let startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 2); // Default: last 2 months
  let endDate = new Date();
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--start-date') {
      startDate = new Date(args[i + 1]);
    } else if (args[i] === '--end-date') {
      endDate = new Date(args[i + 1]);
    }
  }
  
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║              NBA Analyst - Real NBA Data Fetcher               ║');
  console.log('║                    (ESPN Public API)                          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);
  
  log(`Fetching games from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`, 'info');
  
  // Fetch teams first (optional, for validation)
  const teams = await fetchTeams();
  
  // Iterate through dates
  const currentDate = new Date(startDate);
  let totalGames = 0;
  let gamesWithBoxScores = 0;
  
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    
    log(`Fetching games for ${dateStr}...`, 'info');
    
    const games = await fetchGamesForDate(dateStr);
    
    if (games.length > 0) {
      log(`Found ${games.length} games`, 'success');
      
      for (const game of games) {
        // Only save completed games with scores
        if (game.status === 'completed' && game.homeScore !== null) {
          // Fetch box score with delay
          await sleep(RATE_LIMIT_MS);
          const boxScore = await fetchBoxScore(game.externalId);
          
          await saveGame(game, boxScore);
          totalGames++;
          if (boxScore) gamesWithBoxScores++;
          
          if (boxScore) {
            log(`  ✓ ${game.homeTeamName} ${game.homeScore} - ${game.awayScore} ${game.awayTeamName}`, 'success');
          } else {
            log(`  ⚠ ${game.homeTeamName} vs ${game.awayTeamName} (no box score)`, 'warning');
          }
        }
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
    
    // Rate limiting between days
    await sleep(RATE_LIMIT_MS);
  }
  
  // Final stats
  const finalGames = await prisma.$queryRaw`SELECT COUNT(*) as count FROM games WHERE status = 'completed'`;
  const finalBoxScores = await prisma.$queryRaw`SELECT COUNT(*) as count FROM box_scores`;
  
  console.log();
  log('Fetch complete!', 'success');
  log(`Total games saved: ${totalGames}`, 'info');
  log(`Games with box scores: ${gamesWithBoxScores}`, 'info');
  log(`Database now has: ${finalGames[0]?.count || 0} completed games`, 'info');
  log(`Database now has: ${finalBoxScores[0]?.count || 0} box scores`, 'info');
  
  if (totalGames >= 50) {
    log('', 'info');
    log('Ready to train model!', 'success');
    log('Run: node scripts/train-model.js --activate', 'info');
  } else {
    log('', 'warning');
    log('Not enough data. Try a larger date range.', 'warning');
    log('Example: node scripts/fetch-real-nba-data.js --start-date 2023-10-01 --end-date 2024-02-01', 'info');
  }
  
  await prisma.$disconnect();
}

main().catch(error => {
  log(`Fatal error: ${error.message}`, 'error');
  console.error(error);
  process.exit(1);
});
