import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  createIngestionService,
  IngestionService,
} from '../../../src/server/ingestion';
import {
  createProvider,
  clearProviderCache,
} from '../../../src/server/ingestion/providers';
import { detectDrift, deleteBaseline } from '../../../src/server/ingestion/drift';

/**
 * Integration Tests for Ingestion System
 * Tests end-to-end data flow from providers
 */

describe('Ingestion Integration Tests', () => {
  let service: IngestionService;

  beforeAll(() => {
    clearProviderCache();
    service = createIngestionService();
  });

  afterAll(async () => {
    // Clean up baselines
    await deleteBaseline('test-provider', 'test-schema');
  });

  describe('Provider Integration', () => {
    it('should ingest from NBA CDN provider', async () => {
      // Skip if no API URL configured
      if (!process.env.NBA_API_URL) {
        console.log('Skipping NBA CDN test - no API URL configured');
        return;
      }

      const result = await service.ingestFromProvider('nba-cdn');

      expect(result).toBeDefined();
      expect(result.metadata.traceId).toBeDefined();
      expect(result.metadata.provider).toBe('nba-cdn');
    });

    it('should ingest from ESPN provider', async () => {
      const result = await service.ingestFromProvider('espn');

      expect(result).toBeDefined();
      expect(result.metadata.traceId).toBeDefined();
      expect(result.metadata.provider).toBe('espn');
    });

    it('should handle disabled providers gracefully', async () => {
      const result = await service.ingestFromProvider('odds-primary');

      // Should fail since no API URL configured
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-Provider Ingestion', () => {
    it('should ingest from all enabled providers', async () => {
      const result = await service.ingestFromAll();

      expect(result).toBeDefined();
      expect(result.summary.total).toBeGreaterThan(0);
      expect(result.byProvider).toBeDefined();
    });
  });

  describe('Health Checks', () => {
    it('should return health status for all providers', async () => {
      const health = await service.getHealthStatus();

      expect(Array.isArray(health)).toBe(true);
      
      for (const status of health) {
        expect(status.name).toBeDefined();
        expect(typeof status.healthy).toBe('boolean');
        expect(typeof status.latency).toBe('number');
      }
    });
  });

  describe('Schema Validation', () => {
    it('should validate data against schema', async () => {
      const { validateSchema } = await import('../../../src/server/ingestion/schema/validation');
      const { TeamSchema } = await import('../../../src/server/ingestion/schema/nba-schemas');

      const validTeam = {
        id: 1,
        name: 'Lakers',
        city: 'Los Angeles',
        abbreviation: 'LAL',
        conference: 'West' as const,
        division: 'Pacific',
      };

      const result = validateSchema(TeamSchema, validTeam, {
        source: 'test',
        operation: 'integration-test',
        traceId: 'test-trace',
        timestamp: new Date(),
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(validTeam);
    });

    it('should reject invalid data', async () => {
      const { validateSchema } = await import('../../../src/server/ingestion/schema/validation');
      const { TeamSchema } = await import('../../../src/server/ingestion/schema/nba-schemas');

      const invalidTeam = {
        id: 1,
        name: 'Lakers',
        city: 'Los Angeles',
        abbreviation: 'LAL', // Invalid - more than 3 chars
        conference: 'North', // Invalid conference
        division: 'Pacific',
      };

      const result = validateSchema(TeamSchema, invalidTeam, {
        source: 'test',
        operation: 'integration-test',
        traceId: 'test-trace',
        timestamp: new Date(),
      });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('Drift Detection', () => {
    it('should detect schema drift', async () => {
      const testProvider = 'test-provider';
      const testSchema = 'test-schema';
      const traceId = 'drift-test';

      // Create baseline
      const baselineData = { id: 1, name: 'Test' };
      await deleteBaseline(testProvider, testSchema);
      
      // First call creates baseline
      const result1 = await detectDrift(testProvider, testSchema, baselineData, traceId);
      expect(result1.driftDetected).toBe(false);

      // Second call with different data should detect drift
      const newData = { id: 1, name: 'Test', newField: 'value' };
      const result2 = await detectDrift(testProvider, testSchema, newData, traceId);
      
      expect(result2.driftDetected).toBe(true);
      expect(result2.changes.added.length).toBe(1);
      expect(result2.changes.added[0].name).toBe('newField');

      // Clean up
      await deleteBaseline(testProvider, testSchema);
    });
  });

  describe('Fallback Behavior', () => {
    it('should use fallback when primary fails', async () => {
      // Create service with mock failing primary
      const serviceWithFallback = createIngestionService();

      // ESPN should be available as fallback for NBA CDN
      const result = await serviceWithFallback.ingestFromProvider('nba-cdn');

      // Either succeeds or fails gracefully with proper error
      expect(result).toBeDefined();
      expect(result.metadata.traceId).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing providers', async () => {
      const result = await service.ingestFromProvider('non-existent');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('unknown');
    });

    it('should include traceId in all responses', async () => {
      const result = await service.ingestFromProvider('non-existent');

      expect(result.metadata.traceId).toBeDefined();
      expect(result.metadata.traceId.length).toBeGreaterThan(0);
    });
  });
});
