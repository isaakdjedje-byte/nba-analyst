import { BaseProvider, DataSourceResult, ProviderConfig } from './base-provider';
import {
  OddsMatch,
  OddsMatchSchema,
  Sport,
  SportSchema,
  HistoricalOdds,
  HistoricalOddsSchema,
} from '../schema/odds-schemas';
import { validateSchemaOrThrow, ValidationContext } from '../schema/validation';

/**
 * Odds Provider
 * Fetches betting odds from odds aggregation APIs
 * Supports multiple bookmakers and market types
 */

export interface OddsFilter {
  sport?: string; // 'basketball_nba', etc.
  league?: string;
  region?: 'us' | 'uk' | 'eu' | 'au';
  markets?: string[]; // 'h2h', 'spreads', 'totals'
  dateFrom?: string;
  dateTo?: string;
  bookmakers?: string[];
}

export class OddsProvider extends BaseProvider {
  private readonly apiVersion = 'v4';

  constructor(config: ProviderConfig) {
    super(config);
  }

  /**
   * Get available sports
   */
  async getSports(): Promise<DataSourceResult<Sport[]>> {
    const traceId = this.generateTraceId();

    try {
      const endpoint = `/${this.apiVersion}/sports`;
      const { data, latency } = await this.makeRequest<unknown[]>(endpoint);

      const context: ValidationContext = {
        source: 'odds-provider',
        operation: 'getSports',
        traceId,
        timestamp: new Date(),
      };

      // Validate array of sports
      const validatedData: Sport[] = [];
      for (let i = 0; i < data.length; i++) {
        const sport = validateSchemaOrThrow(SportSchema, data[i], {
          ...context,
          traceId: `${traceId}-sport-${i}`,
        });
        validatedData.push(sport);
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
      this.logError('getSports', error, traceId);
      throw this.createProviderError('Failed to fetch sports', error, traceId);
    }
  }

  /**
   * Get odds for upcoming games
   */
  async getOdds(filter: OddsFilter = {}): Promise<DataSourceResult<OddsMatch[]>> {
    const traceId = this.generateTraceId();

    try {
      const params = new URLSearchParams();
      
      if (filter.region) params.set('region', filter.region);
      if (filter.markets) params.set('markets', filter.markets.join(','));
      if (filter.bookmakers) params.set('bookmakers', filter.bookmakers.join(','));

      const sport = filter.sport || 'basketball_nba';
      const endpoint = `/${this.apiVersion}/sports/${sport}/odds?${params.toString()}`;
      
      const { data, latency } = await this.makeRequest<unknown[]>(endpoint);

      const context: ValidationContext = {
        source: 'odds-provider',
        operation: 'getOdds',
        traceId,
        timestamp: new Date(),
      };

      // Validate array of odds matches
      const validatedData: OddsMatch[] = [];
      for (let i = 0; i < data.length; i++) {
        const match = validateSchemaOrThrow(OddsMatchSchema, data[i], {
          ...context,
          traceId: `${traceId}-match-${i}`,
        });
        validatedData.push(match);
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
      this.logError('getOdds', error, traceId);
      throw this.createProviderError('Failed to fetch odds', error, traceId);
    }
  }

  /**
   * Get odds for a specific match
   */
  async getMatchOdds(matchId: string): Promise<DataSourceResult<OddsMatch>> {
    const traceId = this.generateTraceId();

    try {
      const endpoint = `/${this.apiVersion}/events/${matchId}/odds`;
      const { data, latency } = await this.makeRequest<unknown>(endpoint);

      const context: ValidationContext = {
        source: 'odds-provider',
        operation: 'getMatchOdds',
        traceId,
        timestamp: new Date(),
      };

      const validatedData = validateSchemaOrThrow(OddsMatchSchema, data, context);

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
      this.logError('getMatchOdds', error, traceId);
      throw this.createProviderError('Failed to fetch match odds', error, traceId);
    }
  }

  /**
   * Get historical odds for a match
   */
  async getHistoricalOdds(
    matchId: string,
    bookmaker?: string
  ): Promise<DataSourceResult<HistoricalOdds>> {
    const traceId = this.generateTraceId();

    try {
      const params = new URLSearchParams();
      if (bookmaker) params.set('bookmaker', bookmaker);

      const endpoint = `/${this.apiVersion}/events/${matchId}/history?${params.toString()}`;
      const { data, latency } = await this.makeRequest<unknown>(endpoint);

      const context: ValidationContext = {
        source: 'odds-provider',
        operation: 'getHistoricalOdds',
        traceId,
        timestamp: new Date(),
      };

      const validatedData = validateSchemaOrThrow(HistoricalOddsSchema, data, context);

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
      this.logError('getHistoricalOdds', error, traceId);
      throw this.createProviderError('Failed to fetch historical odds', error, traceId);
    }
  }

  /**
   * Get odds for NBA games specifically
   */
  async getNBAOdds(
    markets: string[] = ['h2h', 'spreads', 'totals'],
    region: string = 'us'
  ): Promise<DataSourceResult<OddsMatch[]>> {
    return this.getOdds({
      sport: 'basketball_nba',
      markets,
      region: region as 'us' | 'uk' | 'eu' | 'au',
    });
  }

  /**
   * Fetch all data (main entry point for ingestion)
   */
  async fetchData(): Promise<DataSourceResult<OddsMatch[]>> {
    const traceId = this.generateTraceId();

    try {
      // Get current NBA odds
      const result = await this.getNBAOdds();
      
      return {
        data: result.data,
        metadata: {
          source: this.config.name,
          timestamp: new Date(),
          traceId,
        },
      };
    } catch (error) {
      this.logError('fetchData', error, traceId);
      throw this.createProviderError('Failed to fetch odds data', error, traceId);
    }
  }

  /**
   * Health check for Odds Provider
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const startTime = Date.now();

    try {
      // Try to fetch sports as a simple health check
      await this.getSports();
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
    console.error(`[${traceId}] Odds Provider Error in ${operation}:`, error);
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
