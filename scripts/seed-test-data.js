#!/usr/bin/env node
/**
 * Seed Test Data Script
 * 
 * Inserts mock NBA game data for testing the ML system.
 * Usage: node scripts/seed-test-data.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
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
    default:
      console.log(`${colors.cyan}[${timestamp}] ℹ ${message}${colors.reset}`);
  }
}

async function seedTestData() {
  log('Starting test data seeding...', 'info');
  
  try {
    // Check if data already exists
    const existingGames = await prisma.$queryRaw`SELECT COUNT(*) as count FROM games`;
    const count = parseInt(existingGames[0]?.count || 0);
    
    if (count >= 100) {
      log(`Found ${count} games already in database`, 'warning');
      log('Skipping seed. Use --force to override.', 'info');
      return;
    }
    
    // Generate 200 mock games
    const teams = [
      { id: 1, name: 'Lakers', abbreviation: 'LAL', conference: 'West' },
      { id: 2, name: 'Warriors', abbreviation: 'GSW', conference: 'West' },
      { id: 3, name: 'Celtics', abbreviation: 'BOS', conference: 'East' },
      { id: 4, name: 'Heat', abbreviation: 'MIA', conference: 'East' },
      { id: 5, name: 'Nuggets', abbreviation: 'DEN', conference: 'West' },
      { id: 6, name: 'Suns', abbreviation: 'PHX', conference: 'West' },
      { id: 7, name: 'Bucks', abbreviation: 'MIL', conference: 'East' },
      { id: 8, name: '76ers', abbreviation: 'PHI', conference: 'East' },
      { id: 9, name: 'Mavericks', abbreviation: 'DAL', conference: 'West' },
      { id: 10, name: 'Clippers', abbreviation: 'LAC', conference: 'West' },
    ];
    
    log('Generating 200 test games...', 'info');
    
    const startDate = new Date('2023-10-01');
    let gamesCreated = 0;
    let boxScoresCreated = 0;
    
    for (let i = 0; i < 200; i++) {
      const gameDate = new Date(startDate);
      gameDate.setDate(gameDate.getDate() + Math.floor(i / 5)); // ~5 games per day
      
      const homeTeam = teams[i % teams.length];
      const awayTeam = teams[(i + 1) % teams.length];
      
      // Generate random scores (home team advantage)
      const homeAdvantage = 3;
      const randomFactor = (Math.random() - 0.5) * 20;
      const homeScore = Math.round(110 + homeAdvantage + randomFactor);
      const awayScore = Math.round(110 - homeAdvantage + randomFactor);
      
      const gameId = 1000000 + i;
      
      // Insert game
      await prisma.$executeRaw`
        INSERT INTO games (
          id, external_id, season, season_type, game_date, status,
          home_team_id, home_team_name, home_team_abbreviation, home_team_conference,
          away_team_id, away_team_name, away_team_abbreviation, away_team_conference,
          home_score, away_score, fetched_at, updated_at
        ) VALUES (
          ${`game-${gameId}`}, ${gameId}, 2024, 'Regular Season', ${gameDate}, 'completed',
          ${homeTeam.id}, ${homeTeam.name}, ${homeTeam.abbreviation}, ${homeTeam.conference},
          ${awayTeam.id}, ${awayTeam.name}, ${awayTeam.abbreviation}, ${awayTeam.conference},
          ${homeScore}, ${awayScore}, NOW(), NOW()
        )
        ON CONFLICT (external_id) DO NOTHING
      `;
      
      gamesCreated++;
      
      // Insert box score with some randomness in stats
      const homeRebounds = Math.round(45 + (Math.random() - 0.5) * 10);
      const homeAssists = Math.round(25 + (Math.random() - 0.5) * 8);
      const homeFgPct = 0.45 + (Math.random() - 0.5) * 0.1;
      
      await prisma.$executeRaw`
        INSERT INTO box_scores (
          id, game_id,
          home_points, home_rebounds, home_assists, home_steals, home_blocks, home_turnovers,
          home_fg_pct, home_3p_pct, home_ft_pct,
          away_points, away_rebounds, away_assists, away_steals, away_blocks, away_turnovers,
          away_fg_pct, away_3p_pct, away_ft_pct,
          fetched_at
        ) VALUES (
          ${`bs-${gameId}`}, ${`game-${gameId}`},
          ${homeScore}, ${homeRebounds}, ${homeAssists}, 
          ${Math.round(8 + Math.random() * 4)}, ${Math.round(5 + Math.random() * 3)}, ${Math.round(14 + Math.random() * 4)},
          ${homeFgPct}, ${0.35 + (Math.random() - 0.5) * 0.1}, ${0.75 + (Math.random() - 0.5) * 0.1},
          ${awayScore}, ${Math.round(43 + (Math.random() - 0.5) * 10)}, ${Math.round(23 + (Math.random() - 0.5) * 8)},
          ${Math.round(7 + Math.random() * 4)}, ${Math.round(4 + Math.random() * 3)}, ${Math.round(15 + Math.random() * 4)},
          ${0.43 + (Math.random() - 0.5) * 0.1}, ${0.33 + (Math.random() - 0.5) * 0.1}, ${0.73 + (Math.random() - 0.5) * 0.1},
          NOW()
        )
        ON CONFLICT (game_id) DO NOTHING
      `;
      
      boxScoresCreated++;
      
      // Log progress every 50 games
      if ((i + 1) % 50 === 0) {
        log(`Created ${i + 1}/200 games...`, 'info');
      }
    }
    
    log(`✓ Created ${gamesCreated} games`, 'success');
    log(`✓ Created ${boxScoresCreated} box scores`, 'success');
    
    // Verify
    const finalGames = await prisma.$queryRaw`SELECT COUNT(*) as count FROM games`;
    const finalBoxScores = await prisma.$queryRaw`SELECT COUNT(*) as count FROM box_scores`;
    
    log('', 'info');
    log('Database now contains:', 'info');
    log(`  Games: ${finalGames[0]?.count || 0}`, 'info');
    log(`  Box Scores: ${finalBoxScores[0]?.count || 0}`, 'info');
    log('', 'info');
    log('Ready for model training!', 'success');
    log('Run: node scripts/ml-cli.js train --activate', 'info');
    
  } catch (error) {
    log(`Error: ${error.message}`, 'error');
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedTestData();
