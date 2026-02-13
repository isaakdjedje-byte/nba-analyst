import { BaseProvider, DataSourceResult, ProviderConfig } from './base-provider';
import {
  OddsMatch,
  OddsMatchSchema,
  Sport,
  SportSchema,
} from '../schema/odds-schemas';
import { validateSchemaOrThrow, ValidationContext } from '../schema/validation';
import { OddsFilter } from './odds-provider';

/**
 * Secondary Odds Provider (Fallback)
 * Alternative odds source when primary provider is unavailable
 */

export class OddsSecondaryProvider extends BaseProvider {
  private readonly apiVersion = 'v1';

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
        source: 'odds-secondary',
        operation: 'getSports',
        traceId,
        timestamp: new Date(),
      };

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

      const sport = filter.sport || 'basketball_nba';
      const endpoint = `/${this.apiVersion}/odds/${sport}?${params.toString()}`;
      
      const { data, latency } = await this.makeRequest<unknown[]>(endpoint);

      const context: ValidationContext = {
        source: 'odds-secondary',
        operation: 'getOdds',
        traceId,
        timestamp: new Date(),
      };

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
   * Fetch all data (main entry point for ingestion)
   */
  async fetchData(): Promise<DataSourceResult<OddsMatch[]>> {
    const traceId = this.generateTraceId();

    try {
      const result = await this.getOdds({
        sport: 'basketball_nba',
        markets: ['h2h', 'spreads', 'totals'],
        region: 'us',
      });
      
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
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const startTime = Date.now();

    try {
      await this.getSports();
      return {
        healthy: true,
        latency: Date.now() - startTime,
      };
    } catch (error) {
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
    console.error(`[${traceId}] Secondary Odds Provider Error in ${operation}:`, error);
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
