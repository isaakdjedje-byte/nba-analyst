import {
  BaseProvider,
  ProviderConfig,
  createProvider,
  getProvider,
  getProvidersHealth,
  ProviderType,
} from './providers';
import { detectDrift, validateAgainstBaseline } from './drift/detector';
import { ValidationContext, ValidationResult, validateSchema } from './schema/validation';
import { ZodSchema } from 'zod';
import { sendAlert, createDriftAlert, createFailureAlert, AlertConfig } from './alerting';

/**
 * Ingestion Service
 * Orchestrates data fetching from multiple providers
 */

export interface IngestionConfig {
  providers: {
    type: ProviderType;
    config: ProviderConfig;
    enabled: boolean;
    priority: number;
    fallbackFor?: string; // Name of provider this is fallback for
  }[];
  validation: {
    enabled: boolean;
    strict: boolean;
    driftDetection: boolean;
  };
  alerting: AlertConfig & {
    onDrift: boolean;
    onFailure: boolean;
  };
}

export interface IngestionResult<T = unknown> {
  success: boolean;
  data: T | null;
  errors: IngestionError[];
  metadata: {
    traceId: string;
    timestamp: string;
    provider: string;
    duration: number;
    driftDetected?: boolean;
  };
}

export interface IngestionError {
  provider: string;
  message: string;
  type: 'validation' | 'fetch' | 'drift' | 'timeout' | 'unknown';
  traceId: string;
  recoverable: boolean;
}

export interface MultiProviderResult<T = unknown> {
  success: boolean;
  data: T[];
  byProvider: Record<string, IngestionResult<T>>;
  summary: {
    total: number;
    successful: number;
    failed: number;
    duration: number;
  };
}

/**
 * Ingestion Service
 */
export class IngestionService {
  private config: IngestionConfig;

  constructor(config: IngestionConfig) {
    this.config = config;
    this.initializeProviders();
  }

  /**
   * Initialize all configured providers
   */
  private initializeProviders(): void {
    for (const providerConfig of this.config.providers) {
      if (providerConfig.enabled) {
        try {
          createProvider({
            type: providerConfig.type,
            config: providerConfig.config,
          });
        } catch (error) {
          console.error(
            `Failed to initialize provider ${providerConfig.config.name}:`,
            error
          );
        }
      }
    }
  }

  /**
   * Ingest data from a specific provider
   */
  async ingestFromProvider<T>(
    providerName: string,
    schema?: ZodSchema<T>
  ): Promise<IngestionResult<T>> {
    const startTime = Date.now();
    const traceId = `ingestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Find provider config
    const providerConfig = this.config.providers.find(
      (p) => p.config.name === providerName
    );

    if (!providerConfig || !providerConfig.enabled) {
      return {
        success: false,
        data: null,
        errors: [
          {
            provider: providerName,
            message: 'Provider not found or disabled',
            type: 'unknown',
            traceId,
            recoverable: false,
          },
        ],
        metadata: {
          traceId,
          timestamp: new Date().toISOString(),
          provider: providerName,
          duration: Date.now() - startTime,
        },
      };
    }

    try {
      // Get provider instance
      const provider = getProvider(providerConfig.type, providerName);
      if (!provider) {
        throw new Error('Provider instance not found');
      }

      // Fetch data
      const fetchResult = await provider.fetchData();

      // Validate if schema provided
      if (schema && this.config.validation.enabled) {
        const validation = this.validateData(
          fetchResult.data,
          schema,
          providerName,
          traceId
        );

        if (!validation.success) {
          return {
            success: false,
            data: null,
            errors: [
              {
                provider: providerName,
                message: `Validation failed: ${validation.errors?.map((e) => e.message).join(', ')}`,
                type: 'validation',
                traceId,
                recoverable: false,
              },
            ],
            metadata: {
              traceId,
              timestamp: new Date().toISOString(),
              provider: providerName,
              duration: Date.now() - startTime,
            },
          };
        }
      }

      // Check for drift if enabled
      let driftDetected = false;
      if (this.config.validation.driftDetection) {
        const driftResult = await detectDrift(
          providerName,
          'data-schema',
          fetchResult.data,
          traceId
        );
        driftDetected = driftResult.driftDetected;

        if (driftDetected && this.config.alerting.onDrift) {
          const alert = createDriftAlert(
            providerName,
            traceId,
            driftResult.severity === 'critical' ? 'critical' : 
              driftResult.severity === 'high' ? 'error' :
              driftResult.severity === 'medium' ? 'warning' : 'info',
            {
              added: driftResult.changes.added.map(f => f.name),
              removed: driftResult.changes.removed.map(f => f.name),
              modified: driftResult.changes.modified.map(m => m.field)
            }
          );
          await sendAlert(this.config.alerting, alert);
        }
      }

      return {
        success: true,
        data: fetchResult.data as T,
        errors: [],
        metadata: {
          traceId,
          timestamp: new Date().toISOString(),
          provider: providerName,
          duration: Date.now() - startTime,
          driftDetected,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      // Send failure alert if enabled
      if (this.config.alerting.onFailure) {
        const alert = createFailureAlert(providerName, traceId, message, true);
        await sendAlert(this.config.alerting, alert);
      }

      // Try fallback if configured
      if (providerConfig.fallbackFor) {
        return this.tryFallback(providerConfig, traceId, startTime, message);
      }

      return {
        success: false,
        data: null,
        errors: [
          {
            provider: providerName,
            message,
            type: 'fetch',
            traceId,
            recoverable: true,
          },
        ],
        metadata: {
          traceId,
          timestamp: new Date().toISOString(),
          provider: providerName,
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Try to fetch from fallback provider
   */
  private async tryFallback<T>(
    providerConfig: IngestionConfig['providers'][0],
    traceId: string,
    startTime: number,
    originalError: string
  ): Promise<IngestionResult<T>> {
    const fallbackName = providerConfig.fallbackFor;
    if (!fallbackName) {
      return {
        success: false,
        data: null,
        errors: [
          {
            provider: providerConfig.config.name,
            message: originalError,
            type: 'fetch',
            traceId,
            recoverable: false,
          },
        ],
        metadata: {
          traceId,
          timestamp: new Date().toISOString(),
          provider: providerConfig.config.name,
          duration: Date.now() - startTime,
        },
      };
    }

    // Find fallback provider config
    const fallbackConfig = this.config.providers.find(
      (p) => p.config.name === fallbackName && p.enabled
    );

    if (!fallbackConfig) {
      return {
        success: false,
        data: null,
        errors: [
          {
            provider: providerConfig.config.name,
            message: `${originalError} (fallback ${fallbackName} not found or disabled)`,
            type: 'fetch',
            traceId,
            recoverable: false,
          },
        ],
        metadata: {
          traceId,
          timestamp: new Date().toISOString(),
          provider: providerConfig.config.name,
          duration: Date.now() - startTime,
        },
      };
    }

    try {
      const fallback = getProvider(fallbackConfig.type, fallbackName);
      if (!fallback) {
        throw new Error('Fallback provider not available');
      }

      const result = await fallback.fetchData();

      return {
        success: true,
        data: result.data as T,
        errors: [
          {
            provider: providerConfig.config.name,
            message: `Primary failed: ${originalError}, used fallback ${fallbackName}`,
            type: 'fetch',
            traceId,
            recoverable: true,
          },
        ],
        metadata: {
          traceId: `${traceId}-fallback`,
          timestamp: new Date().toISOString(),
          provider: fallbackName,
          duration: Date.now() - startTime,
        },
      };
    } catch (fallbackError) {
      const message =
        fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
      return {
        success: false,
        data: null,
        errors: [
          {
            provider: fallbackName,
            message: `Fallback ${fallbackName} also failed: ${message}`,
            type: 'fetch',
            traceId,
            recoverable: false,
          },
        ],
        metadata: {
          traceId: `${traceId}-fallback-failed`,
          timestamp: new Date().toISOString(),
          provider: fallbackName,
          duration: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Validate data against schema
   */
  private validateData<T>(
    data: unknown,
    schema: ZodSchema<T>,
    source: string,
    traceId: string
  ): ValidationResult<T> {
    const context: ValidationContext = {
      source,
      operation: 'ingestion-validation',
      traceId,
      timestamp: new Date(),
    };

    return validateSchema(schema, data, context);
  }

  /**
   * Ingest from all enabled providers
   */
  async ingestFromAll<T>(schema?: ZodSchema<T>): Promise<MultiProviderResult<T>> {
    const startTime = Date.now();
    const results: Record<string, IngestionResult<T>> = {};
    const data: T[] = [];
    let successful = 0;
    let failed = 0;

    const enabledProviders = this.config.providers.filter((p) => p.enabled);

    for (const providerConfig of enabledProviders) {
      const result = await this.ingestFromProvider<T>(
        providerConfig.config.name,
        schema
      );
      results[providerConfig.config.name] = result;

      if (result.success && result.data) {
        data.push(result.data);
        successful++;
      } else {
        failed++;
      }
    }

    return {
      success: failed === 0,
      data,
      byProvider: results,
      summary: {
        total: enabledProviders.length,
        successful,
        failed,
        duration: Date.now() - startTime,
      },
    };
  }

  /**
   * Get health status for all providers
   */
  async getHealthStatus(): Promise<
    { name: string; healthy: boolean; latency: number }[]
  > {
    return getProvidersHealth();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<IngestionConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Create default ingestion service
 */
export function createIngestionService(): IngestionService {
  const config: IngestionConfig = {
    providers: [
      {
        type: 'nba-cdn',
        config: {
          name: 'nba-cdn',
          baseUrl: process.env.NBA_API_URL || '',
          apiKey: process.env.NBA_API_KEY,
          timeout: 10000,
          rateLimit: 60,
        },
        enabled: !!process.env.NBA_API_URL,
        priority: 1,
      },
      {
        type: 'espn',
        config: {
          name: 'espn',
          baseUrl: process.env.ESPN_API_URL || 'https://site.api.espn.com/apis/site/v2/sports',
          apiKey: process.env.ESPN_API_KEY,
          timeout: 10000,
          rateLimit: 60,
        },
        enabled: true,
        priority: 2,
        fallbackFor: 'nba-cdn',
      },
      {
        type: 'odds-primary',
        config: {
          name: 'odds-primary',
          baseUrl: process.env.ODDS_API_URL || '',
          apiKey: process.env.ODDS_API_KEY,
          timeout: 15000,
          rateLimit: 30,
        },
        enabled: !!process.env.ODDS_API_URL,
        priority: 3,
      },
      {
        type: 'odds-secondary',
        config: {
          name: 'odds-secondary',
          baseUrl: process.env.ODDS_API_BACKUP_URL || '',
          apiKey: process.env.ODDS_API_BACKUP_KEY,
          timeout: 15000,
          rateLimit: 20,
        },
        enabled: !!process.env.ODDS_API_BACKUP_URL,
        priority: 4,
        fallbackFor: 'odds-primary',
      },
    ],
    validation: {
      enabled: true,
      strict: true,
      driftDetection: true,
    },
    alerting: {
      enabled: true,
      console: true,
      onDrift: true,
      onFailure: true,
    },
  };

  return new IngestionService(config);
}
