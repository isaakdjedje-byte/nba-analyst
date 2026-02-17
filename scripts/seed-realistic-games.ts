/**
 * Seed Realistic Games
 * 
 * Inserts realistic NBA game data for training TypeScript models
n * Based on actual team strengths and seasonal patterns
 * 
 * Usage: npx tsx scripts/seed-realistic-games.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Realistic team data (win rates from recent seasons)
const TEAMS = [
  { name: 'Boston Celtics', abbr: 'BOS', conference: 'East', winRate: 0.70 },
  { name: 'Denver Nuggets', abbr: 'DEN', conference: 'West', winRate: 0.65 },
  { name: 'Milwaukee Bucks', abbr: 'MIL', conference: 'East', winRate: 0.60 },
  { name: 'Phoenix Suns', abbr: 'PHX', conference: 'West', winRate: 0.60 },
  { name: 'Golden State Warriors', abbr: 'GSW', conference: 'West', winRate: 0.55 },
  { name: 'Los Angeles Lakers', abbr: 'LAL', conference: 'West', winRate: 0.52 },
  { name: 'Miami Heat', abbr: 'MIA', conference: 'East', winRate: 0.55 },
  { name: 'Philadelphia 76ers', abbr: 'PHI', conference: 'East', winRate: 0.58 },
  { name: 'Cleveland Cavaliers', abbr: 'CLE', conference: 'East', winRate: 0.57 },
  { name: 'Memphis Grizzlies', abbr: 'MEM', conference: 'West', winRate: 0.55 },
  { name: 'Sacramento Kings', abbr: 'SAC', conference: 'West', winRate: 0.54 },
  { name: 'New York Knicks', abbr: 'NYK', conference: 'East', winRate: 0.53 },
  { name: 'Dallas Mavericks', abbr: 'DAL', conference: 'West', winRate: 0.52 },
  { name: 'LA Clippers', abbr: 'LAC', conference: 'West', winRate: 0.50 },
  { name: 'New Orleans Pelicans', abbr: 'NOP', conference: 'West', winRate: 0.48 },
  { name: 'Indiana Pacers', abbr: 'IND', conference: 'East', winRate: 0.47 },
  { name: 'Orlando Magic', abbr: 'ORL', conference: 'East', winRate: 0.46 },
  { name: 'Oklahoma City Thunder', abbr: 'OKC', conference: 'West', winRate: 0.60 },
  { name: 'Minnesota Timberwolves', abbr: 'MIN', conference: 'West', winRate: 0.57 },
  { name: 'Atlanta Hawks', abbr: 'ATL', conference: 'East', winRate: 0.45 },
  { name: 'Toronto Raptors', abbr: 'TOR', conference: 'East', winRate: 0.44 },
  { name: 'Chicago Bulls', abbr: 'CHI', conference: 'East', winRate: 0.43 },
  { name: 'Houston Rockets', abbr: 'HOU', conference: 'West', winRate: 0.40 },
  { name: 'Utah Jazz', abbr: 'UTA', conference: 'West', winRate: 0.42 },
  { name: 'Portland Trail Blazers', abbr: 'POR', conference: 'West', winRate: 0.35 },
  { name: 'San Antonio Spurs', abbr: 'SAS', conference: 'West', winRate: 0.30 },
  { name: 'Detroit Pistons', abbr: 'DET', conference: 'East', winRate: 0.28 },
  { name: 'Charlotte Hornets', abbr: 'CHA', conference: 'East', winRate: 0.27 },
  { name: 'Washington Wizards', abbr: 'WAS', conference: 'East', winRate: 0.25 },
  { name: 'Brooklyn Nets', abbr: 'BKN', conference: 'East', winRate: 0.32 },
];

async function seedGames() {
  console.log('Seeding realistic NBA games for training...');
  console.log('');

  // Delete existing games from 2023 to avoid duplicates
  const deleted = await prisma.game.deleteMany({
    where: {
      season: 2023,
    },
  });
  console.log(`Deleted ${deleted.count} existing games from 2023`);

  const games = [];
  const season = 2023;
  const startDate = new Date('2023-10-24');
  let gameId = 22300001;

  // Generate games for each team (home & away)
  for (let day = 0; day < 150; day++) { // 150 days of games
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + day);
    
    // Skip if no games this day (random)
    if (Math.random() > 0.6) continue;
    
    // Generate 3-8 games per day
    const numGames = Math.floor(Math.random() * 6) + 3;
    
    for (let g = 0; g < numGames; g++) {
      // Pick two random teams
      const homeTeam = TEAMS[Math.floor(Math.random() * TEAMS.length)];
      let awayTeam = TEAMS[Math.floor(Math.random() * TEAMS.length)];
      
      // Ensure different teams
      while (awayTeam.name === homeTeam.name) {
        awayTeam = TEAMS[Math.floor(Math.random() * TEAMS.length)];
      }
      
      // Calculate realistic scores based on team strengths
      const homeAdvantage = 3; // Home court advantage
      const expectedHomeScore = 105 + (homeTeam.winRate * 20) + homeAdvantage;
      const expectedAwayScore = 105 + (awayTeam.winRate * 20);
      
      // Add randomness
      const homeScore = Math.round(expectedHomeScore + (Math.random() * 20 - 10));
      const awayScore = Math.round(expectedAwayScore + (Math.random() * 20 - 10));
      
      // Create game
      games.push({
        id: `game-${gameId}`,
        externalId: gameId,
        season: season,
        seasonType: 'Regular Season',
        gameDate: currentDate,
        status: 'Final',
        homeTeamId: TEAMS.indexOf(homeTeam) + 1,
        homeTeamName: homeTeam.name,
        homeTeamAbbreviation: homeTeam.abbr,
        homeTeamConference: homeTeam.conference,
        awayTeamId: TEAMS.indexOf(awayTeam) + 1,
        awayTeamName: awayTeam.name,
        awayTeamAbbreviation: awayTeam.abbr,
        awayTeamConference: awayTeam.conference,
        homeScore: homeScore,
        awayScore: awayScore,
        arena: `${homeTeam.name} Arena`,
        attendance: Math.floor(15000 + Math.random() * 5000),
        duration: 138 + Math.floor(Math.random() * 20),
        isPlayoffGame: false,
        fetchedAt: new Date(),
        updatedAt: new Date(),
      });
      
      gameId++;
      
      if (games.length >= 500) break; // Stop at 500 games
    }
    
    if (games.length >= 500) break;
  }

  console.log(`Creating ${games.length} games...`);

  // Insert games in batches
  const batchSize = 50;
  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);
    await prisma.game.createMany({
      data: batch,
    });
    console.log(`  Created ${Math.min(i + batchSize, games.length)}/${games.length} games`);
  }

  console.log('');
  console.log('✅ Seeding complete!');
  console.log(`  Total games: ${games.length}`);
  console.log(`  Season: ${season}`);
  console.log('');
  console.log('You can now train TypeScript models with:');
  console.log('  npx tsx scripts/train-ml-model.ts --start-date 2023-10-01 --end-date 2024-06-01 --activate');
}

seedGames()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
