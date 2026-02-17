/**
 * Live Features Engineering
 * Real-time features for ML predictions
 */

import { RedisCache } from '../cache/redis-cache';
import { OddsRealtimeProvider } from '../providers/odds-realtime';
import { InjuriesRealtimeProvider } from '../providers/injuries-realtime';
import { ESPNLineupsProvider } from '../providers/espn-lineups';
import { DuckDBStorage } from '../storage/duckdb-storage';

interface LiveFeatures {
  // Line movement
  spreadMovement: number;
  sharpIndicator: boolean;
  
  // Injury impact
  homeStarsOut: number;
  awayStarsOut: number;
  homeInjuryImpact: number;
  awayInjuryImpact: number;
  injuryImpactDiff: number;
  
  // Market inefficiency
  modelVsMarketDiff: number;
  closingLineValue: number;
  
  // Context
  homeBackToBack: boolean;
  awayBackToBack: boolean;
  homeRestDays: number;
  awayRestDays: number;
  restDaysDiff: number;
  homeTravelDistance: number;
  awayTravelDistance: number;
  
  // Lineup confirmation
  lineupsConfirmed: boolean;
  lastMinuteChanges: boolean;
}

interface HistoricalContext {
  homeWinPct5: number;
  homeWinPct10: number;
  homeWinPct20: number;
  awayWinPct5: number;
  awayWinPct10: number;
  awayWinPct20: number;
  homeElo: number;
  awayElo: number;
  eloDiff: number;
}

interface OddsFeatures {
  spreadMovement: number;
  lineMovement: number;
  isSharp: boolean;
  homeImpliedProb?: number;
}

export class LiveFeatureEngineering {
  private cache: RedisCache;
  private oddsProvider: OddsRealtimeProvider;
  private injuriesProvider: InjuriesRealtimeProvider;
  private lineupsProvider: ESPNLineupsProvider;
  private duckdb: DuckDBStorage;

  constructor(cache: RedisCache) {
    this.cache = cache;
    this.oddsProvider = new OddsRealtimeProvider(cache);
    this.injuriesProvider = new InjuriesRealtimeProvider(cache);
    this.lineupsProvider = new ESPNLineupsProvider(cache);
    this.duckdb = new DuckDBStorage();
  }

  /**
   * Initialize connections
   */
  async init(): Promise<void> {
    await this.cache.connect();
    await this.duckdb.init();
  }

  /**
   * Calculate live features for a game
   */
  async calculateLiveFeatures(
    gameId: string,
    homeTeam: string,
    awayTeam: string,
    gameDate: Date
  ): Promise<LiveFeatures> {
    console.log(`⚙️  Calculating live features for ${homeTeam} vs ${awayTeam}...`);

    // Fetch all real-time data in parallel
    const [
      oddsData,
      injuryImpact,
      lineups,
      historicalContext
    ] = await Promise.all([
      this.fetchOddsData(gameId),
      this.injuriesProvider.getGameInjuryImpact(homeTeam, awayTeam),
      this.lineupsProvider.fetchGameLineup(gameId),
      this.fetchHistoricalContext(homeTeam, awayTeam, gameDate)
    ]);

    // Calculate rest days
    const homeRest = this.calculateRestDays(homeTeam, gameDate);
    const awayRest = this.calculateRestDays(awayTeam, gameDate);

    // Calculate travel distance
    const homeTravel = this.calculateTravelDistance(homeTeam, gameDate);
    const awayTravel = this.calculateTravelDistance(awayTeam, gameDate);

    // Build feature set
    const features: LiveFeatures = {
      // Line movement
      spreadMovement: oddsData?.spreadMovement || 0,
      sharpIndicator: oddsData?.isSharp || false,
      
      // Injury impact
      homeStarsOut: injuryImpact.homeStarsOut,
      awayStarsOut: injuryImpact.awayStarsOut,
      homeInjuryImpact: injuryImpact.homeImpactScore,
      awayInjuryImpact: injuryImpact.awayImpactScore,
      injuryImpactDiff: injuryImpact.impactDiff,
      
      // Market inefficiency
      modelVsMarketDiff: this.calculateModelVsMarketDiff(historicalContext, oddsData),
      closingLineValue: oddsData?.lineMovement || 0,
      
      // Context
      homeBackToBack: homeRest === 0,
      awayBackToBack: awayRest === 0,
      homeRestDays: homeRest,
      awayRestDays: awayRest,
      restDaysDiff: homeRest - awayRest,
      homeTravelDistance: homeTravel,
      awayTravelDistance: awayTravel,
      
      // Lineup confirmation
      lineupsConfirmed: lineups?.isConfirmed || false,
      lastMinuteChanges: false, // Will be detected separately
    };

    // Cache the features
    await this.cache.set(`features:${gameId}`, features, 'live');

    return features;
  }

  /**
   * Fetch odds data for a game
   */
  private async fetchOddsData(gameId: string): Promise<OddsFeatures | null> {
    try {
      // Check cached odds
      const cachedOdds = await this.cache.getOdds(gameId);
      
      if (!cachedOdds) {
        return null;
      }

      // Detect sharp movement
      const sharpMovement = await this.oddsProvider.detectSharpMovement(gameId);

      return {
        spreadMovement: Number(cachedOdds.lineMovement ?? 0),
        lineMovement: Number(cachedOdds.lineMovement ?? 0),
        isSharp: sharpMovement?.hasSharpMovement || false,
      };
    } catch (error) {
      console.warn('Failed to fetch odds data:', error);
      return null;
    }
  }

  /**
   * Fetch historical context for teams
   */
  private async fetchHistoricalContext(
    homeTeam: string,
    awayTeam: string,
    gameDate: Date
  ): Promise<HistoricalContext | null> {
    try {
      // Query DuckDB for recent performance
      const homeQuery = `
        SELECT 
          AVG(CASE WHEN winner = '${homeTeam}' THEN 1.0 ELSE 0.0 END) as win_pct_5
        FROM (
          SELECT winner
          FROM raw_games
          WHERE (home_team = '${homeTeam}' OR away_team = '${homeTeam}')
            AND date < '${gameDate.toISOString().split('T')[0]}'
          ORDER BY date DESC
          LIMIT 5
        )
      `;

      const awayQuery = `
        SELECT 
          AVG(CASE WHEN winner = '${awayTeam}' THEN 1.0 ELSE 0.0 END) as win_pct_5
        FROM (
          SELECT winner
          FROM raw_games
          WHERE (home_team = '${awayTeam}' OR away_team = '${awayTeam}')
            AND date < '${gameDate.toISOString().split('T')[0]}'
          ORDER BY date DESC
          LIMIT 5
        )
      `;

      const [homeResult, awayResult] = await Promise.all([
        this.duckdb.query(homeQuery).catch(() => [{ win_pct_5: 0.5 }]),
        this.duckdb.query(awayQuery).catch(() => [{ win_pct_5: 0.5 }]),
      ]);

      return {
        homeWinPct5: Number(homeResult[0]?.win_pct_5 || 0.5),
        homeWinPct10: Number(homeResult[0]?.win_pct_5 || 0.5),
        homeWinPct20: Number(homeResult[0]?.win_pct_5 || 0.5),
        awayWinPct5: Number(awayResult[0]?.win_pct_5 || 0.5),
        awayWinPct10: Number(awayResult[0]?.win_pct_5 || 0.5),
        awayWinPct20: Number(awayResult[0]?.win_pct_5 || 0.5),
        homeElo: 1500,
        awayElo: 1500,
        eloDiff: 0,
      };
    } catch (error) {
      console.warn('Failed to fetch historical context:', error);
      return null;
    }
  }

  /**
   * Calculate rest days for a team
   */
  private calculateRestDays(team: string, gameDate: Date): number {
    void team;
    void gameDate;
    // This would query the last game played by the team
    // For now, return a default value
    return 2; // Default 2 days rest
  }

  /**
   * Calculate travel distance
   */
  private calculateTravelDistance(team: string, gameDate: Date): number {
    void team;
    void gameDate;
    // This would calculate distance from previous game location
    // For now, return a default value
    return 0; // Home game
  }

  /**
   * Calculate model vs market difference
   */
  private calculateModelVsMarketDiff(
    context: HistoricalContext | null,
    oddsData: OddsFeatures | null | undefined
  ): number {
    if (!context) return 0;

    // Simple heuristic: compare win probabilities
    const modelWinProb = this.calculateWinProbability(context);
    const marketWinProb = oddsData?.homeImpliedProb || 0.5;

    return (modelWinProb - marketWinProb) * 100; // Return percentage difference
  }

  /**
   * Calculate win probability from historical context
   */
  private calculateWinProbability(context: HistoricalContext): number {
    // Simple model based on win % and home advantage
    const homeAdvantage = 0.6; // Home teams win ~60% in NBA
    const winPct = context.homeWinPct5;
    const eloAdvantage = context.eloDiff / 400;
    
    // Logistic function for probability
    const logit = Math.log(winPct / (1 - winPct)) + eloAdvantage + Math.log(homeAdvantage / (1 - homeAdvantage));
    return 1 / (1 + Math.exp(-logit));
  }

  /**
   * Calculate live features for all today's games
   */
  async calculateAllLiveFeatures(): Promise<Record<string, LiveFeatures>> {
    console.log('⚙️  Calculating live features for all games...');

    // Get all cached lineups (represents today's games)
    const lineups = await this.lineupsProvider.getCachedLineups();
    const features: Record<string, LiveFeatures> = {};

    for (const lineup of lineups) {
      const gameFeatures = await this.calculateLiveFeatures(
        lineup.gameId,
        lineup.homeTeam,
        lineup.awayTeam,
        new Date()
      );
      features[lineup.gameId] = gameFeatures;
    }

    console.log(`✅ Calculated features for ${Object.keys(features).length} games`);
    return features;
  }

  /**
   * Get cached features for a game
   */
  async getCachedFeatures(gameId: string): Promise<LiveFeatures | null> {
    return this.cache.get<LiveFeatures>(`features:${gameId}`);
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    await this.duckdb.close();
  }
}

export default LiveFeatureEngineering;
