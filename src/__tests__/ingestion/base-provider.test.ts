import { describe, it, expect } from 'vitest';
import {
  BaseProvider,
  ProviderConfig,
  DataSourceResult,
} from '../../server/ingestion/providers/base-provider';

// Mock implementation for testing
class TestProvider extends BaseProvider {
  async fetchData(): Promise<DataSourceResult> {
    return {
      data: { test: true },
      metadata: {
        source: this.config.name,
        timestamp: new Date(),
        traceId: 'test-trace-id',
      },
    };
  }

  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    return { healthy: true, latency: 100 };
  }
}

describe('BaseProvider', () => {
  const mockConfig: ProviderConfig = {
    name: 'test-provider',
    baseUrl: 'https://api.test.com',
    apiKey: 'test-key',
    timeout: 5000,
    rateLimit: 100,
  };

  it('should initialize with config', () => {
    const provider = new TestProvider(mockConfig);
    expect(provider.getName()).toBe('test-provider');
  });

  it('should throw if config is missing required fields', () => {
    expect(() => new TestProvider({} as ProviderConfig)).toThrow('Provider name is required');
  });

  it('should throw if baseUrl is missing', () => {
    expect(() => new TestProvider({ name: 'test' } as ProviderConfig)).toThrow('Provider baseUrl is required');
  });

  it('should return provider metadata', () => {
    const provider = new TestProvider(mockConfig);
    const metadata = provider.getMetadata();
    expect(metadata).toEqual({
      name: 'test-provider',
      baseUrl: 'https://api.test.com',
      timeout: 5000,
      rateLimit: 100,
    });
  });

  it('should generate unique trace IDs', () => {
    const provider = new TestProvider(mockConfig);
    const traceId1 = provider.generateTraceId();
    const traceId2 = provider.generateTraceId();
    expect(traceId1).toBeTruthy();
    expect(traceId2).toBeTruthy();
    expect(traceId1).not.toBe(traceId2);
  });

  it('should track request latency', async () => {
    const provider = new TestProvider(mockConfig);
    const startTime = Date.now();
    await provider.fetchData();
    const latency = provider.getLastLatency();
    expect(latency).toBeGreaterThanOrEqual(0);
    expect(latency).toBeLessThan(Date.now() - startTime + 100);
  });

  it('should implement health check', async () => {
    const provider = new TestProvider(mockConfig);
    const health = await provider.healthCheck();
    expect(health.healthy).toBe(true);
    expect(health.latency).toBe(100);
  });

  it('should apply default values', () => {
    const minimalConfig: ProviderConfig = {
      name: 'minimal',
      baseUrl: 'https://api.test.com',
    };
    const provider = new TestProvider(minimalConfig);
    const metadata = provider.getMetadata();
    expect(metadata.timeout).toBe(10000);
    expect(metadata.rateLimit).toBe(60);
  });
});
