/**
 * The Odds API - Real-time Odds Provider
 * Fetches opening and closing lines with line movement detection.
 */

import axios from 'axios';
import { RedisCache } from '../cache/redis-cache';

interface OddsConfig {
  apiKey: string;
  baseUrl: string;
  sport: string;
  regions: string;
  markets: string[];
  bookmakers: string[];
}

interface OddsData {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  commenceTime: Date;
  bookmaker: string;
  market: string; // 'spread', 'totals', 'h2h'
  openLine: number | null;
  closeLine: number | null;
  lineMovement: number;
  homeImpliedProb: number;
  awayImpliedProb: number;
  fetchedAt: Date;
}

interface TheOddsGame {
  id: string;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: TheOddsBookmaker[];
}

interface TheOddsBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: TheOddsMarket[];
}

interface TheOddsMarket {
  key: string;
  last_update: string;
  outcomes: TheOddsOutcome[];
  point?: number;
}

interface TheOddsOutcome {
  name: string;
  price: number;
  point?: number;
}

export class OddsRealtimeProvider {
  private config: OddsConfig;
  private cache: RedisCache;
  private readonly REQUEST_DELAY = 1000; // 1 second between requests

  constructor(cache: RedisCache) {
    this.cache = cache;
    const apiKey = process.env.THE_ODDS_API_KEY;
    if (!apiKey) {
      throw new Error('THE_ODDS_API_KEY is required for OddsRealtimeProvider');
    }

    this.config = {
      apiKey,
      baseUrl: 'https://api.the-odds-api.com/v4',
      sport: 'basketball_nba',
      regions: 'us',
      markets: ['spreads', 'totals', 'h2h'],
      bookmakers: ['draftkings', 'fanduel', 'betmgm', 'caesars', 'pinnacle'],
    };
  }

  /**
   * Fetch current odds (opening lines - 18h)
   */
  async fetchOpeningOdds(): Promise<OddsData[]> {
    console.log('📊 Fetching opening odds from The Odds API...');
    
    try {
      const response = await axios.get(
        `${this.config.baseUrl}/sports/${this.config.sport}/odds`,
        {
          params: {
            apiKey: this.config.apiKey,
            regions: this.config.regions,
            markets: this.config.markets.join(','),
            oddsFormat: 'american',
            dateFormat: 'iso',
          },
          timeout: 30000,
        }
      );

      const games: TheOddsGame[] = response.data;
      const oddsData: OddsData[] = [];

      for (const game of games) {
        const gameOdds = this.parseGameOdds(game);
        oddsData.push(...gameOdds);
        
        // Cache the opening odds
        for (const odds of gameOdds) {
          await this.cache.cacheOdds(`${game.id}:${odds.market}:${odds.bookmaker}`, {
            ...odds,
            lineType: 'opening',
          });
        }
      }

      console.log(`✅ Fetched ${oddsData.length} odds entries for ${games.length} games`);
      return oddsData;

    } catch (error) {
      console.error('❌ Error fetching opening odds:', error);
      throw error;
    }
  }

  /**
   * Fetch closing odds (before games - 20h)
   */
  async fetchClosingOdds(): Promise<OddsData[]> {
    console.log('📊 Fetching closing odds from The Odds API...');
    
    try {
      // Fetch current odds again (closing lines)
      const response = await axios.get(
        `${this.config.baseUrl}/sports/${this.config.sport}/odds`,
        {
          params: {
            apiKey: this.config.apiKey,
            regions: this.config.regions,
            markets: this.config.markets.join(','),
            oddsFormat: 'american',
            dateFormat: 'iso',
          },
          timeout: 30000,
        }
      );

      const games: TheOddsGame[] = response.data;
      const oddsData: OddsData[] = [];

      for (const game of games) {
        const gameOdds = this.parseGameOdds(game);
        
        // Calculate line movement
        for (const odds of gameOdds) {
          const cacheKey = `${game.id}:${odds.market}:${odds.bookmaker}`;
          const openingOdds = await this.cache.getOdds(cacheKey);
          
          if (openingOdds) {
            odds.openLine = Number(openingOdds.openLine ?? openingOdds.closeLine ?? 0);
            odds.lineMovement = odds.closeLine !== null && odds.openLine !== null
              ? odds.closeLine - odds.openLine
              : 0;
          }

          // Cache closing odds
          await this.cache.cacheOdds(cacheKey, {
            ...odds,
            lineType: 'closing',
          });
        }

        oddsData.push(...gameOdds);
      }

      console.log(`✅ Fetched ${oddsData.length} closing odds entries`);
      return oddsData;

    } catch (error) {
      console.error('❌ Error fetching closing odds:', error);
      throw error;
    }
  }

  /**
   * Parse game odds from The Odds API response
   */
  private parseGameOdds(game: TheOddsGame): OddsData[] {
    const oddsData: OddsData[] = [];

    for (const bookmaker of game.bookmakers) {
      // Only process configured bookmakers
      if (!this.config.bookmakers.includes(bookmaker.key)) continue;

      for (const market of bookmaker.markets) {
        const odds: Partial<OddsData> = {
          gameId: game.id,
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          commenceTime: new Date(game.commence_time),
          bookmaker: bookmaker.key,
          market: market.key,
          fetchedAt: new Date(),
        };

        switch (market.key) {
          case 'spreads':
            // Find spread for each team
            for (const outcome of market.outcomes) {
              if (outcome.point !== undefined) {
                odds.closeLine = outcome.point;
                // Implied probability from price
                const prob = this.americanOddsToProbability(outcome.price);
                if (outcome.name === game.home_team) {
                  odds.homeImpliedProb = prob;
                } else {
                  odds.awayImpliedProb = prob;
                }
              }
            }
            break;

          case 'totals':
            // Over/Under line
            if (market.outcomes[0]?.point !== undefined) {
              odds.closeLine = market.outcomes[0].point;
            }
            break;

          case 'h2h':
            // Moneyline - calculate implied probabilities
            let homePrice = 0;
            
            for (const outcome of market.outcomes) {
              if (outcome.name === game.home_team) {
                homePrice = outcome.price;
                odds.homeImpliedProb = this.americanOddsToProbability(outcome.price);
              } else {
                odds.awayImpliedProb = this.americanOddsToProbability(outcome.price);
              }
            }
            
            // Store as decimal odds for comparison
            odds.closeLine = homePrice;
            break;
        }

        if (odds.closeLine !== undefined) {
          oddsData.push(odds as OddsData);
        }
      }
    }

    return oddsData;
  }

  /**
   * Convert American odds to implied probability
   */
  private americanOddsToProbability(odds: number): number {
    if (odds > 0) {
      return 100 / (odds + 100);
    } else {
      return Math.abs(odds) / (Math.abs(odds) + 100);
    }
  }

  /**
   * Detect sharp line movement
   */
  async detectSharpMovement(gameId: string): Promise<{
    hasSharpMovement: boolean;
    movement: number;
    bookmaker: string;
  } | null> {
    const cachedOdds = await this.cache.getKeys(`odds:${gameId}:*`);
    
    for (const key of cachedOdds) {
      const odds = await this.cache.get<OddsData>(key);
      if (odds && odds.lineMovement !== undefined) {
        // Sharp movement: > 2 points on spread or > 5% on implied prob
        const isSharp = Math.abs(odds.lineMovement) > 2 || 
          Math.abs((odds.homeImpliedProb || 0) - (odds.awayImpliedProb || 0)) > 0.05;
        
        if (isSharp) {
          return {
            hasSharpMovement: true,
            movement: odds.lineMovement,
            bookmaker: odds.bookmaker,
          };
        }
      }
    }

    return null;
  }

  /**
   * Get API usage stats
   */
  async getApiUsage(): Promise<{ requestsRemaining: number; requestsUsed: number } | null> {
    try {
      const response = await axios.get(`${this.config.baseUrl}/sports`, {
        params: { apiKey: this.config.apiKey },
      });

      const headers = response.headers;
      return {
        requestsRemaining: parseInt(headers['x-requests-remaining'] || '0'),
        requestsUsed: parseInt(headers['x-requests-used'] || '0'),
      };
    } catch {
      return null;
    }
  }
}
