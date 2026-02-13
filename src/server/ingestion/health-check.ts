import { BaseProvider } from './providers/base-provider';
import { createProvider, ProviderType, getProvider } from './providers';

/**
 * Health Check Service for Data Providers
 * Monitors provider availability and performance
 */

export interface ProviderHealthResult {
  name: string;
  type: ProviderType;
  healthy: boolean;
  latency: number;
  lastCheck: string;
  error?: string;
}

export interface SystemHealthResult {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  providers: ProviderHealthResult[];
  timestamp: string;
}

/**
 * Check health of a specific provider
 */
export async function checkProviderHealth(
  provider: BaseProvider
): Promise<ProviderHealthResult> {
  const startTime = Date.now();

  try {
    const health = await provider.healthCheck();
    return {
      name: provider.getName(),
      type: 'custom', // Will be updated by caller
      healthy: health.healthy,
      latency: health.latency,
      lastCheck: new Date().toISOString(),
    };
  } catch (error) {
    return {
      name: provider.getName(),
      type: 'custom',
      healthy: false,
      latency: Date.now() - startTime,
      lastCheck: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check health of all configured providers
 */
export async function checkAllProvidersHealth(
  configs: { type: ProviderType; name: string; config: { baseUrl: string; apiKey?: string } }[]
): Promise<SystemHealthResult> {
  const results: ProviderHealthResult[] = [];
  let healthyCount = 0;
  let degradedCount = 0;
  let unhealthyCount = 0;

  for (const config of configs) {
    const provider = getProvider(config.type, config.name);
    
    if (!provider) {
      results.push({
        name: config.name,
        type: config.type,
        healthy: false,
        latency: -1,
        lastCheck: new Date().toISOString(),
        error: 'Provider not initialized',
      });
      unhealthyCount++;
      continue;
    }

    const result = await checkProviderHealth(provider);
    result.type = config.type;
    results.push(result);

    if (result.healthy && result.latency < 1000) {
      healthyCount++;
    } else if (result.healthy) {
      degradedCount++;
    } else {
      unhealthyCount++;
    }
  }

  let overall: 'healthy' | 'degraded' | 'unhealthy';
  if (unhealthyCount === configs.length) {
    overall = 'unhealthy';
  } else if (degradedCount > 0 || unhealthyCount > 0) {
    overall = 'degraded';
  } else {
    overall = 'healthy';
  }

  return {
    overall,
    providers: results,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get health status for display
 */
export function formatHealthStatus(health: SystemHealthResult): string {
  const lines = [
    `\n📊 Data Provider Health Status`,
    `Overall: ${health.overall.toUpperCase()}`,
    `Checked: ${new Date(health.timestamp).toLocaleString()}`,
    ``,
    `Providers:`,
  ];

  for (const provider of health.providers) {
    const status = provider.healthy ? '✅' : '❌';
    const latency = provider.latency >= 0 ? `${provider.latency}ms` : 'N/A';
    lines.push(`  ${status} ${provider.name} (${provider.type}): ${latency}`);
    if (provider.error) {
      lines.push(`    └─ Error: ${provider.error}`);
    }
  }

  return lines.join('\n');
}

/**
 * Create health check endpoint response
 */
export function createHealthResponse(health: SystemHealthResult): {
  status: number;
  body: unknown;
} {
  const status = health.overall === 'healthy' ? 200 : 
                 health.overall === 'degraded' ? 200 : 503;

  return {
    status,
    body: {
      status: health.overall,
      providers: health.providers.reduce((acc, p) => {
        acc[p.name] = {
          healthy: p.healthy,
          latency: p.latency,
          error: p.error,
        };
        return acc;
      }, {} as Record<string, unknown>),
      timestamp: health.timestamp,
    },
  };
}

// Default provider configurations for health checks
export const defaultProviderConfigs = [
  {
    type: 'nba-cdn' as ProviderType,
    name: 'nba-cdn',
    config: {
      baseUrl: process.env.NBA_API_URL || 'https://cdn.nba.com',
      apiKey: process.env.NBA_API_KEY,
    },
  },
  {
    type: 'odds-primary' as ProviderType,
    name: 'odds-primary',
    config: {
      baseUrl: process.env.ODDS_API_URL || 'https://api.the-odds-api.com',
      apiKey: process.env.ODDS_API_KEY,
    },
  },
  {
    type: 'odds-secondary' as ProviderType,
    name: 'odds-secondary',
    config: {
      baseUrl: process.env.ODDS_API_BACKUP_URL || 'https://api.odds-api-backup.com',
      apiKey: process.env.ODDS_API_BACKUP_KEY,
    },
  },
];
