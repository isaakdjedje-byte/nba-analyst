/**
 * ESPN Lineups Provider
 * Fetches starting lineups and detects last-minute changes
 */

import axios from 'axios';
import { RedisCache } from '../cache/redis-cache';

interface LineupConfig {
  baseUrl: string;
}

export interface StartingLineup {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeStarters: Player[];
  awayStarters: Player[];
  lastUpdated: Date;
  isConfirmed: boolean;
}

export interface Player {
  id: string;
  name: string;
  position: string;
  number: string;
}

interface ESPNGame {
  id: string;
  competitions: ESPNCompetition[];
}

interface ESPNCompetition {
  competitors: ESPNCompetitor[];
  status: ESPNStatus;
}

interface ESPNCompetitor {
  id: string;
  team: ESPNTeam;
  lineup?: ESPNLineup[];
}

interface ESPNTeam {
  id: string;
  displayName: string;
  abbreviation: string;
}

interface ESPNLineup {
  athlete: ESPNAthlete;
  position: string;
  starter: boolean;
}

interface ESPNAthlete {
  id: string;
  displayName: string;
  jersey: string;
}

interface ESPNStatus {
  type: {
    state: string;
  };
}

export class ESPNLineupsProvider {
  private config: LineupConfig;
  private cache: RedisCache;

  constructor(cache: RedisCache) {
    this.cache = cache;
    this.config = {
      baseUrl: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba',
    };
  }

  /**
   * Fetch starting lineups for today's games
   */
  async fetchStartingLineups(): Promise<StartingLineup[]> {
    console.log('🏀 Fetching starting lineups from ESPN...');
    
    try {
      const response = await axios.get(`${this.config.baseUrl}/scoreboard`, {
        params: {
          dates: this.getTodayDate(),
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 30000,
      });

      const games: ESPNGame[] = response.data.events || [];
      const lineups: StartingLineup[] = [];

      for (const game of games) {
        const lineup = this.parseGameLineup(game);
        if (lineup) {
          lineups.push(lineup);
          
          // Cache the lineup
          await this.cache.cacheLineup(game.id, lineup as unknown as Record<string, unknown>);

          // Check for last-minute changes
          const cachedLineup = await this.cache.getLineup(game.id);
          if (cachedLineup) {
            const changes = this.detectChanges(cachedLineup as unknown as StartingLineup, lineup);
            if (changes.length > 0) {
              console.log(`⚠️ Lineup changes detected for ${lineup.awayTeam} @ ${lineup.homeTeam}:`);
              changes.forEach(change => console.log(`  - ${change}`));
            }
          }
        }
      }

      console.log(`✅ Fetched lineups for ${lineups.length} games`);
      return lineups;

    } catch (error) {
      console.error('❌ Error fetching lineups:', error);
      throw error;
    }
  }

  /**
   * Fetch lineup for a specific game
   */
  async fetchGameLineup(gameId: string): Promise<StartingLineup | null> {
    try {
      const response = await axios.get(`${this.config.baseUrl}/summary`, {
        params: { event: gameId },
        timeout: 30000,
      });

      const game: ESPNGame = response.data;
      return this.parseGameLineup(game);

    } catch (error) {
      console.error(`❌ Error fetching lineup for game ${gameId}:`, error);
      return null;
    }
  }

  /**
   * Parse ESPN game data into lineup format
   */
  private parseGameLineup(game: ESPNGame): StartingLineup | null {
    if (!game.competitions || game.competitions.length === 0) {
      return null;
    }

    const competition = game.competitions[0];
    const competitors = competition.competitors;

    if (competitors.length !== 2) {
      return null;
    }

    // Determine home and away
    const homeCompetitor = competitors.find(c => c.team.id === competitors[0].team.id) || competitors[0];
    const awayCompetitor = competitors.find(c => c.team.id !== homeCompetitor.team.id) || competitors[1];

    const homeTeam = homeCompetitor.team.displayName;
    const awayTeam = awayCompetitor.team.displayName;

    // Parse lineups
    const homeStarters = this.parseTeamLineup(homeCompetitor);
    const awayStarters = this.parseTeamLineup(awayCompetitor);

    // Check if lineups are confirmed
    const isConfirmed = competition.status?.type?.state === 'pre' && 
      homeStarters.length === 5 && awayStarters.length === 5;

    return {
      gameId: game.id,
      homeTeam,
      awayTeam,
      homeStarters,
      awayStarters,
      lastUpdated: new Date(),
      isConfirmed,
    };
  }

  /**
   * Parse team lineup from ESPN data
   */
  private parseTeamLineup(competitor: ESPNCompetitor): Player[] {
    const lineup = competitor.lineup || [];
    
    return lineup
      .filter(entry => entry.starter)
      .map(entry => ({
        id: entry.athlete.id,
        name: entry.athlete.displayName,
        position: entry.position,
        number: entry.athlete.jersey || '',
      }))
      .slice(0, 5); // Take first 5 starters
  }

  /**
   * Detect changes between old and new lineups
   */
  private detectChanges(oldLineup: StartingLineup, newLineup: StartingLineup): string[] {
    const changes: string[] = [];

    // Compare home starters
    const oldHomeNames = oldLineup.homeStarters.map(p => p.name);
    const newHomeNames = newLineup.homeStarters.map(p => p.name);

    for (const player of newLineup.homeStarters) {
      if (!oldHomeNames.includes(player.name)) {
        changes.push(`[${oldLineup.homeTeam}] IN: ${player.name}`);
      }
    }

    for (const player of oldLineup.homeStarters) {
      if (!newHomeNames.includes(player.name)) {
        changes.push(`[${oldLineup.homeTeam}] OUT: ${player.name}`);
      }
    }

    // Compare away starters
    const oldAwayNames = oldLineup.awayStarters.map(p => p.name);
    const newAwayNames = newLineup.awayStarters.map(p => p.name);

    for (const player of newLineup.awayStarters) {
      if (!oldAwayNames.includes(player.name)) {
        changes.push(`[${oldLineup.awayTeam}] IN: ${player.name}`);
      }
    }

    for (const player of oldLineup.awayStarters) {
      if (!newAwayNames.includes(player.name)) {
        changes.push(`[${oldLineup.awayTeam}] OUT: ${player.name}`);
      }
    }

    return changes;
  }

  /**
   * Get today's date in YYYYMMDD format
   */
  private getTodayDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0].replace(/-/g, '');
  }

  /**
   * Get cached lineups for today
   */
  async getCachedLineups(): Promise<StartingLineup[]> {
    const keys = await this.cache.getKeys('lineup:*');
    const lineups: StartingLineup[] = [];

    for (const key of keys) {
      const lineup = await this.cache.get<StartingLineup>(key);
      if (lineup) {
        lineups.push(lineup);
      }
    }

    return lineups;
  }

  /**
   * Check if lineups are confirmed for a game
   */
  async areLineupsConfirmed(gameId: string): Promise<boolean> {
    const lineup = await this.cache.getLineup(gameId);
    const typedLineup = lineup as unknown as StartingLineup | null;
    return typedLineup?.isConfirmed ?? false;
  }

  /**
   * Get player by ID from lineups
   */
  async getPlayerById(playerId: string): Promise<Player | null> {
    const lineups = await this.getCachedLineups();
    
    for (const lineup of lineups) {
      const player = [...lineup.homeStarters, ...lineup.awayStarters]
        .find(p => p.id === playerId);
      if (player) return player;
    }

    return null;
  }
}
