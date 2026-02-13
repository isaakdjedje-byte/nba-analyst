import { BaseProvider, ProviderConfig } from './base-provider';
import { NBACDNProvider } from './nba-cdn-provider';
import { OddsProvider } from './odds-provider';
import { OddsSecondaryProvider } from './odds-secondary';
import { ESPNProvider } from './espn-provider';

/**
 * Provider Factory
 * Creates and manages data source provider instances
 */

export type ProviderType = 
  | 'nba-cdn'
  | 'espn'
  | 'odds-primary'
  | 'odds-secondary'
  | 'custom';

export interface ProviderFactoryConfig {
  type: ProviderType;
  config: ProviderConfig;
}

import { LRUCache } from 'lru-cache';

// Provider instance cache with TTL (5 minutes)
const providerCache = new LRUCache<string, BaseProvider>({
  max: 50, // Maximum 50 providers cached
  ttl: 1000 * 60 * 5, // 5 minutes TTL
  updateAgeOnGet: true,
});

/**
 * Create a provider instance
 */
export function createProvider(factoryConfig: ProviderFactoryConfig): BaseProvider {
  const { type, config } = factoryConfig;
  const cacheKey = `${type}-${config.name}`;

  // Return cached instance if exists
  if (providerCache.has(cacheKey)) {
    return providerCache.get(cacheKey)!;
  }

  let provider: BaseProvider;

  switch (type) {
    case 'nba-cdn':
      provider = new NBACDNProvider(config);
      break;
    case 'espn':
      provider = new ESPNProvider(config);
      break;
    case 'odds-primary':
      provider = new OddsProvider(config);
      break;
    case 'odds-secondary':
      provider = new OddsSecondaryProvider(config);
      break;
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }

  // Cache the instance
  providerCache.set(cacheKey, provider);
  return provider;
}

/**
 * Get a cached provider or create new one
 */
export function getProvider(type: ProviderType, name: string): BaseProvider | undefined {
  const cacheKey = `${type}-${name}`;
  return providerCache.get(cacheKey);
}

/**
 * Clear provider cache
 */
export function clearProviderCache(): void {
  providerCache.clear();
}

/**
 * Get all cached providers
 */
export function getAllProviders(): BaseProvider[] {
  return Array.from(providerCache.values());
}

/**
 * Get provider health status for all providers
 */
export async function getProvidersHealth(): Promise<
  { name: string; type: ProviderType; healthy: boolean; latency: number }[]
> {
  const results = [];

  for (const [cacheKey, provider] of providerCache) {
    const [type, ...nameParts] = cacheKey.split('-');
    const name = nameParts.join('-');
    
    try {
      const health = await provider.healthCheck();
      results.push({
        name,
        type: type as ProviderType,
        ...health,
      });
    } catch {
      results.push({
        name,
        type: type as ProviderType,
        healthy: false,
        latency: -1,
      });
    }
  }

  return results;
}

// Re-export provider classes
export { BaseProvider } from './base-provider';
export { NBACDNProvider } from './nba-cdn-provider';
export { ESPNProvider } from './espn-provider';
export { OddsProvider } from './odds-provider';
export { OddsSecondaryProvider } from './odds-secondary';

// Re-export types
export type { ProviderConfig, DataSourceResult, ProviderMetadata } from './base-provider';
export type { OddsFilter } from './odds-provider';

// Re-export schemas
export * from '../schema/nba-schemas';
export * from '../schema/odds-schemas';
