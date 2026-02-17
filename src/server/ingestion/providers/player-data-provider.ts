import { BaseProvider, DataSourceResult, ProviderConfig } from './base-provider';
import {
  PlayerProfile,
  PlayerProfileSchema,
  TeamRoster,
  TeamRosterSchema,
  InjuryReport,
  InjuryReportSchema,
  ExtendedBoxScore,
  ExtendedBoxScoreSchema,
} from '../schema/player-schemas';
import { validateSchemaOrThrow, ValidationContext } from '../schema/validation';

/**
 * Player Data Provider
 * Fetches player data, rosters, and stats from NBA CDN
 */

export interface PlayerFilter {
  teamId?: number;
  season?: number;
  playerId?: number;
}

export class PlayerDataProvider extends BaseProvider {
  private readonly apiVersion = 'v1';

  constructor(config: ProviderConfig) {
    super(config);
  }

  /**
   * Fetch data (required abstract method implementation)
   * Returns current season rosters for all teams
   */
  async fetchData(): Promise<DataSourceResult<TeamRoster[]>> {
    const traceId = this.generateTraceId();

    try {
      // Get all teams first
      const teamsEndpoint = `/${this.apiVersion}/teams`;
      const { data: teamsData } = await this.makeRequest<unknown[]>(teamsEndpoint);
      
      const currentSeason = new Date().getFullYear();
      const rosters: TeamRoster[] = [];
      
      // Fetch roster for each team
      for (const team of teamsData) {
        try {
          const teamId = (team as { id: number }).id;
          const rosterResult = await this.getTeamRoster(teamId, currentSeason);
          rosters.push(rosterResult.data);
        } catch (error) {
          console.warn(`[${traceId}] Failed to fetch roster for team:`, error);
        }
      }

      return {
        data: rosters,
        metadata: {
          source: this.config.name,
          timestamp: new Date(),
          traceId,
        },
      };
    } catch (error) {
      this.logError('fetchData', error, traceId);
      throw this.createProviderError('Failed to fetch player data', error, traceId);
    }
  }

  /**
   * Get team roster for a season
   */
  async getTeamRoster(teamId: number, season: number): Promise<DataSourceResult<TeamRoster>> {
    const traceId = this.generateTraceId();

    try {
      const endpoint = `/${this.apiVersion}/teams/${teamId}/players?season=${season}`;
      const { data, latency } = await this.makeRequest<unknown>(endpoint);

      const context: ValidationContext = {
        source: 'nba-cdn',
        operation: 'getTeamRoster',
        traceId,
        timestamp: new Date(),
      };

      const rosterData = {
        teamId,
        season,
        players: data,
      };

      const validatedData = validateSchemaOrThrow(TeamRosterSchema, rosterData, context);

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
      this.logError('getTeamRoster', error, traceId);
      throw this.createProviderError('Failed to fetch team roster', error, traceId);
    }
  }

  /**
   * Get player profile/info
   */
  async getPlayerProfile(playerId: number): Promise<DataSourceResult<PlayerProfile>> {
    const traceId = this.generateTraceId();

    try {
      const endpoint = `/${this.apiVersion}/players/${playerId}`;
      const { data, latency } = await this.makeRequest<unknown>(endpoint);

      const context: ValidationContext = {
        source: 'nba-cdn',
        operation: 'getPlayerProfile',
        traceId,
        timestamp: new Date(),
      };

      const validatedData = validateSchemaOrThrow(PlayerProfileSchema, data, context);

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
      this.logError('getPlayerProfile', error, traceId);
      throw this.createProviderError('Failed to fetch player profile', error, traceId);
    }
  }

  /**
   * Get extended box score with player stats
   */
  async getExtendedBoxScore(gameId: number): Promise<DataSourceResult<ExtendedBoxScore>> {
    const traceId = this.generateTraceId();

    try {
      const endpoint = `/${this.apiVersion}/games/${gameId}/boxscore`;
      const { data, latency } = await this.makeRequest<unknown>(endpoint);

      const context: ValidationContext = {
        source: 'nba-cdn',
        operation: 'getExtendedBoxScore',
        traceId,
        timestamp: new Date(),
      };

      const validatedData = validateSchemaOrThrow(ExtendedBoxScoreSchema, data, context);

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
      this.logError('getExtendedBoxScore', error, traceId);
      throw this.createProviderError('Failed to fetch extended box score', error, traceId);
    }
  }

  /**
   * Get injury report for a date
   */
  async getInjuryReport(date: string): Promise<DataSourceResult<InjuryReport[]>> {
    const traceId = this.generateTraceId();

    try {
      const endpoint = `/${this.apiVersion}/injuries?date=${date}`;
      const { data, latency } = await this.makeRequest<unknown[]>(endpoint);

      const context: ValidationContext = {
        source: 'nba-cdn',
        operation: 'getInjuryReport',
        traceId,
        timestamp: new Date(),
      };

      const validatedData: InjuryReport[] = [];
      for (let i = 0; i < data.length; i++) {
        const report = validateSchemaOrThrow(InjuryReportSchema, data[i], {
          ...context,
          traceId: `${traceId}-injury-${i}`,
        });
        validatedData.push(report);
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
      this.logError('getInjuryReport', error, traceId);
      throw this.createProviderError('Failed to fetch injury report', error, traceId);
    }
  }

  /**
   * Health check for Player Data Provider
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const startTime = Date.now();

    try {
      // Try to fetch a well-known player profile (LeBron James)
      await this.getPlayerProfile(2544);
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
    console.error(`[${traceId}] Player Data Error in ${operation}:`, error);
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
