/**
 * Fetch NBA API Sample - Test connection and verify data format
 * Before importing all missing data, we check the API response structure
 */

import axios from 'axios';
import { DuckDBStorage } from '../src/data-fetch/storage/duckdb-storage';

// Sample game: 2016-10-25 (first game of 2016-17 season)
const TEST_DATE = '2016-10-25';

interface NBAGame {
  id: string;
  date: string;
  season: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  winner: string;
}

async function fetchSample() {
  console.log('Testing NBA API connection...\n');
  console.log('Fetching sample game from:', TEST_DATE);
  
  try {
    // Using ESPN API for NBA games
    const response = await axios.get(
      'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
      {
        params: { dates: '20161025' },
        timeout: 30000,
      }
    );

    const games = response.data.events || [];
    
    if (games.length === 0) {
      console.log('No games found for this date');
      return;
    }

    console.log(`\nFound ${games.length} games\n`);
    
    // Show first game structure
    const game = games[0];
    console.log('Sample game structure:');
    console.log(JSON.stringify(game, null, 2));
    
    // Parse and show what we can extract
    console.log('\n\n=== Parsed Data ===');
    const parsed = parseGame(game);
    console.log(parsed);
    
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

function parseGame(game: any): Partial<NBAGame> {
  const competition = game.competitions?.[0];
  if (!competition) return {};
  
  const home = competition.competitors?.find((c: any) => c.homeAway === 'home');
  const away = competition.competitors?.find((c: any) => c.homeAway === 'away');
  
  return {
    id: game.id,
    date: game.date,
    home_team: home?.team?.displayName,
    away_team: away?.team?.displayName,
    home_score: parseInt(home?.score || 0),
    away_score: parseInt(away?.score || 0),
    winner: home?.winner === true ? home?.team?.displayName : away?.team?.displayName,
  };
}

fetchSample();
