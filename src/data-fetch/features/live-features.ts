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
  homeTravelDistance: number | null;
  awayTravelDistance: number | null;
  
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
    const [homeRest, awayRest] = await Promise.all([
      this.calculateRestDays(homeTeam, gameDate),
      this.calculateRestDays(awayTeam, gameDate),
    ]);

    // Calculate travel distance
    const [homeTravel, awayTravel] = await Promise.all([
      this.calculateTravelDistance(homeTeam, gameDate),
      this.calculateTravelDistance(awayTeam, gameDate),
    ]);

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
      const dateBoundary = gameDate.toISOString().split('T')[0];
      const fetchWinPct = async (team: string, limit: number): Promise<number> => {
        const query = `
          SELECT AVG(CASE WHEN winner = '${team}' THEN 1.0 ELSE 0.0 END) as win_pct
          FROM (
            SELECT winner
            FROM raw_games
            WHERE (home_team = '${team}' OR away_team = '${team}')
              AND date < '${dateBoundary}'
            ORDER BY date DESC
            LIMIT ${limit}
          )
        `;
        const rows = await this.duckdb.query(query).catch(() => [{ win_pct: null }]);
        const value = rows[0]?.win_pct;
        return typeof value === 'number' && Number.isFinite(value) ? value : 0.5;
      };

      const [
        homeWinPct5,
        homeWinPct10,
        homeWinPct20,
        awayWinPct5,
        awayWinPct10,
        awayWinPct20,
      ] = await Promise.all([
        fetchWinPct(homeTeam, 5),
        fetchWinPct(homeTeam, 10),
        fetchWinPct(homeTeam, 20),
        fetchWinPct(awayTeam, 5),
        fetchWinPct(awayTeam, 10),
        fetchWinPct(awayTeam, 20),
      ]);

      const homeElo = 1300 + (homeWinPct20 * 400);
      const awayElo = 1300 + (awayWinPct20 * 400);

      return {
        homeWinPct5,
        homeWinPct10,
        homeWinPct20,
        awayWinPct5,
        awayWinPct10,
        awayWinPct20,
        homeElo,
        awayElo,
        eloDiff: homeElo - awayElo,
      };
    } catch (error) {
      console.warn('Failed to fetch historical context:', error);
      return null;
    }
  }

  /**
   * Calculate rest days for a team
   */
  private async calculateRestDays(team: string, gameDate: Date): Promise<number> {
    const dateBoundary = gameDate.toISOString().split('T')[0];
    const query = `
      SELECT date
      FROM raw_games
      WHERE (home_team = '${team}' OR away_team = '${team}')
        AND date < '${dateBoundary}'
      ORDER BY date DESC
      LIMIT 1
    `;

    const rows = await this.duckdb.query(query).catch(() => []);
    const lastGameDate = rows[0]?.date;
    if (!lastGameDate) return 0;

    const last = new Date(lastGameDate);
    const diffMs = gameDate.getTime() - last.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    return Math.max(0, Math.floor(diffMs / dayMs));
  }

  /**
   * Calculate travel distance
   */
  private async calculateTravelDistance(team: string, gameDate: Date): Promise<number | null> {
    void team;
    void gameDate;
    return null;
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
    const boundedWinPct = Math.min(0.99, Math.max(0.01, context.homeWinPct5));
    const eloAdvantage = context.eloDiff / 400;
    
    // Logistic function for probability
    const logit = Math.log(boundedWinPct / (1 - boundedWinPct)) + eloAdvantage;
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
