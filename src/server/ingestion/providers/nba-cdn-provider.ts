import { BaseProvider, DataSourceResult, ProviderConfig } from './base-provider';
import {
  Game,
  GameSchema,
  BoxScore,
  BoxScoreSchema,
  Schedule,
  ScheduleSchema,
  Team,
  TeamSchema,
} from '../schema/nba-schemas';
import { validateSchemaOrThrow, ValidationContext } from '../schema/validation';

/**
 * NBA CDN Provider
 * Fetches NBA game data, schedules, and statistics from official NBA CDN
 */

export interface NBAGameFilter {
  date?: string; // YYYY-MM-DD
  season?: number;
  teamId?: number;
  status?: 'scheduled' | 'in_progress' | 'completed';
}

export class NBACDNProvider extends BaseProvider {
  private readonly apiVersion = 'v1';

  constructor(config: ProviderConfig) {
    super(config);
  }

  /**
   * Get today's games
   */
  async getTodayGames(): Promise<DataSourceResult<Schedule>> {
    const today = new Date().toISOString().split('T')[0];
    return this.getGamesByDate(today);
  }

  /**
   * Get games for a specific date
   */
  async getGamesByDate(date: string): Promise<DataSourceResult<Schedule>> {
    const traceId = this.generateTraceId();

    try {
      const endpoint = `/${this.apiVersion}/games?date=${date}`;
      const { data, latency } = await this.makeRequest<unknown>(endpoint);

      const context: ValidationContext = {
        source: 'nba-cdn',
        operation: 'getGamesByDate',
        traceId,
        timestamp: new Date(),
      };

      // Validate response structure
      const validatedData = validateSchemaOrThrow(ScheduleSchema, data, context);

      return {
        data: validatedData,
        metadata: {
          source: this.config.name,
          timestamp: new Date(),
          traceId,
          latency,
        },
      };
    } catch (error) {
      this.logError('getGamesByDate', error, traceId);
      throw this.createProviderError('Failed to fetch games by date', error, traceId);
    }
  }

  /**
   * Get game details by ID
   */
  async getGameById(gameId: number): Promise<DataSourceResult<Game>> {
    const traceId = this.generateTraceId();

    try {
      const endpoint = `/${this.apiVersion}/games/${gameId}`;
      const { data, latency } = await this.makeRequest<unknown>(endpoint);

      const context: ValidationContext = {
        source: 'nba-cdn',
        operation: 'getGameById',
        traceId,
        timestamp: new Date(),
      };

      const validatedData = validateSchemaOrThrow(GameSchema, data, context);

      return {
        data: validatedData,
        metadata: {
          source: this.config.name,
          timestamp: new Date(),
          traceId,
          latency,
        },
      };
    } catch (error) {
      this.logError('getGameById', error, traceId);
      throw this.createProviderError('Failed to fetch game details', error, traceId);
    }
  }

  /**
   * Get box score for a game
   */
  async getBoxScore(gameId: number): Promise<DataSourceResult<BoxScore>> {
    const traceId = this.generateTraceId();

    try {
      const endpoint = `/${this.apiVersion}/games/${gameId}/boxscore`;
      const { data, latency } = await this.makeRequest<unknown>(endpoint);

      const context: ValidationContext = {
        source: 'nba-cdn',
        operation: 'getBoxScore',
        traceId,
        timestamp: new Date(),
      };

      const validatedData = validateSchemaOrThrow(BoxScoreSchema, data, context);

      return {
        data: validatedData,
        metadata: {
          source: this.config.name,
          timestamp: new Date(),
          traceId,
          latency,
        },
      };
    } catch (error) {
      this.logError('getBoxScore', error, traceId);
      throw this.createProviderError('Failed to fetch box score', error, traceId);
    }
  }

  /**
   * Get all teams
   */
  async getTeams(): Promise<DataSourceResult<Team[]>> {
    const traceId = this.generateTraceId();

    try {
      const endpoint = `/${this.apiVersion}/teams`;
      const { data, latency } = await this.makeRequest<unknown[]>(endpoint);

      const context: ValidationContext = {
        source: 'nba-cdn',
        operation: 'getTeams',
        traceId,
        timestamp: new Date(),
      };

      // Validate array of teams
      const validatedData: Team[] = [];
      for (let i = 0; i < data.length; i++) {
        const team = validateSchemaOrThrow(TeamSchema, data[i], {
          ...context,
          traceId: `${traceId}-team-${i}`,
        });
        validatedData.push(team);
      }

      return {
        data: validatedData,
        metadata: {
          source: this.config.name,
          timestamp: new Date(),
          traceId,
          latency,
        },
      };
    } catch (error) {
      this.logError('getTeams', error, traceId);
      throw this.createProviderError('Failed to fetch teams', error, traceId);
    }
  }

  /**
   * Fetch all data (main entry point for ingestion)
   */
  async fetchData(): Promise<DataSourceResult<Game[]>> {
    const traceId = this.generateTraceId();

    try {
      // Get today's games
      const scheduleResult = await this.getTodayGames();
      const games = scheduleResult.data.games;

      // Fetch detailed data for each game
      const detailedGames: Game[] = [];
      for (const game of games) {
        try {
          const gameResult = await this.getGameById(game.id);
          detailedGames.push(gameResult.data);
        } catch (error) {
          // Log but continue - don't fail entire batch for one game error
          console.warn(`[${traceId}] Failed to fetch game ${game.id}:`, error);
        }
      }

      return {
        data: detailedGames,
        metadata: {
          source: this.config.name,
          timestamp: new Date(),
          traceId,
        },
      };
    } catch (error) {
      this.logError('fetchData', error, traceId);
      throw this.createProviderError('Failed to fetch data', error, traceId);
    }
  }

  /**
   * Health check for NBA CDN
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const startTime = Date.now();

    try {
      // Try to fetch teams as a simple health check
      await this.getTeams();
      return {
        healthy: true,
        latency: Date.now() - startTime,
      };
    } catch {
      return {
        healthy: false,
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * Log error with trace context
   */
  private logError(operation: string, error: unknown, traceId: string): void {
    console.error(`[${traceId}] NBA CDN Error in ${operation}:`, error);
  }

  /**
   * Create standardized provider error
   */
  private createProviderError(
    message: string,
    error: unknown,
    traceId: string
  ): Error {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Error(`${message} [${traceId}]: ${errorMessage}`);
  }
}
