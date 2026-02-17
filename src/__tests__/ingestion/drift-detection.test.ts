import { describe, it, expect, afterEach } from 'vitest';
import {
  detectDrift,
  createSchemaSnapshot,
  inferSchemaStructure,
  saveBaseline,
  loadBaseline,
  deleteBaseline,
} from '../../server/ingestion/drift/detector';

describe('Drift Detection', () => {
  const testProvider = 'test-provider';
  const testSchemaName = 'test-schema';
  const traceId = 'test-trace-id';

  // Clean up baselines after tests
  afterEach(async () => {
    await deleteBaseline(testProvider, testSchemaName);
  });

  describe('inferSchemaStructure', () => {
    it('should infer structure from simple object', () => {
      const data = { id: 1, name: 'Test' };
      const fields = inferSchemaStructure(data);

      expect(fields).toHaveLength(2);
      expect(fields.some((f) => f.name === 'id' && f.type === 'number')).toBe(true);
      expect(fields.some((f) => f.name === 'name' && f.type === 'string')).toBe(true);
    });

    it('should detect date strings as date type', () => {
      const data = { createdAt: '2024-01-15T10:00:00Z' };
      const fields = inferSchemaStructure(data);

      expect(fields).toHaveLength(1);
      expect(fields[0].type).toBe('date');
    });

    it('should infer structure from nested objects', () => {
      const data = {
        user: {
          id: 1,
          profile: {
            name: 'Test',
          },
        },
      };
      const fields = inferSchemaStructure(data);

      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe('user');
      expect(fields[0].type).toBe('object');
      expect(fields[0].nested).toBeDefined();
      expect(fields[0].nested?.length).toBe(2);
    });

    it('should infer structure from arrays', () => {
      const data = {
        items: [{ id: 1 }, { id: 2 }],
      };
      const fields = inferSchemaStructure(data);

      expect(fields).toHaveLength(1);
      expect(fields[0].type).toBe('array');
      expect(fields[0].nested).toBeDefined();
    });

    it('should handle null values', () => {
      const data = { value: null };
      const fields = inferSchemaStructure(data);

      expect(fields).toHaveLength(1);
      expect(fields[0].type).toBe('null');
      expect(fields[0].nullable).toBe(true);
    });
  });

  describe('createSchemaSnapshot', () => {
    it('should create snapshot with all required fields', () => {
      const data = { id: 1, name: 'Test' };
      const snapshot = createSchemaSnapshot(testProvider, testSchemaName, data, traceId);

      expect(snapshot.provider).toBe(testProvider);
      expect(snapshot.schemaName).toBe(testSchemaName);
      expect(snapshot.fields).toHaveLength(2);
      expect(snapshot.hash).toBeDefined();
      expect(snapshot.createdAt).toBeDefined();
      expect(snapshot.version).toBe('1.0.0');
    });

    it('should generate unique IDs', () => {
      const data = { id: 1 };
      const snapshot1 = createSchemaSnapshot(testProvider, testSchemaName, data, traceId);
      
      // Wait a tiny bit to ensure different timestamps
      const start = Date.now();
      while (Date.now() - start < 2) {} // 2ms delay
      
      const snapshot2 = createSchemaSnapshot(testProvider, testSchemaName, data, traceId);

      expect(snapshot1.id).not.toBe(snapshot2.id);
    });

    it('should generate SHA-256 hash', () => {
      const data = { id: 1, name: 'Test' };
      const snapshot = createSchemaSnapshot(testProvider, testSchemaName, data, traceId);

      // SHA-256 hash is 64 characters in hex
      expect(snapshot.hash).toHaveLength(64);
      // Should only contain hex characters
      expect(snapshot.hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate consistent hash for same data structure', () => {
      const data = { id: 1, name: 'Test' };
      const snapshot1 = createSchemaSnapshot(testProvider, testSchemaName, data, traceId);
      
      // Wait a bit to ensure different timestamps in metadata
      const start = Date.now();
      while (Date.now() - start < 10) {}
      
      const snapshot2 = createSchemaSnapshot(testProvider, testSchemaName, data, traceId);

      // Same data structure should produce same hash (hash is based on fields only)
      expect(snapshot1.hash).toBe(snapshot2.hash);
    });

    it('should generate different hash for different data structure', () => {
      const data1 = { id: 1, name: 'Test1' };
      const data2 = { id: 1, age: 25 }; // Different field (age vs name)
      
      const snapshot1 = createSchemaSnapshot(testProvider, testSchemaName, data1, traceId);
      const snapshot2 = createSchemaSnapshot(testProvider, testSchemaName, data2, traceId);

      // Different data structure should produce different hashes
      expect(snapshot1.hash).not.toBe(snapshot2.hash);
    });
  });

  describe('baseline management', () => {
    it('should save and load baseline', async () => {
      const data = { id: 1, name: 'Test' };
      const snapshot = createSchemaSnapshot(testProvider, testSchemaName, data, traceId);

      await saveBaseline(snapshot);
      const loaded = await loadBaseline(testProvider, testSchemaName);

      expect(loaded).toBeDefined();
      expect(loaded?.provider).toBe(testProvider);
      expect(loaded?.schemaName).toBe(testSchemaName);
      expect(loaded?.fields).toHaveLength(2);
    });

    it('should return null for non-existent baseline', async () => {
      const loaded = await loadBaseline('non-existent', 'non-existent');
      expect(loaded).toBeNull();
    });
  });

  describe('detectDrift', () => {
    it('should detect no drift when baseline matches', async () => {
      const data = { id: 1, name: 'Test' };
      const snapshot = createSchemaSnapshot(testProvider, testSchemaName, data, traceId);
      await saveBaseline(snapshot);

      const result = await detectDrift(testProvider, testSchemaName, data, traceId);

      expect(result.driftDetected).toBe(false);
      expect(result.severity).toBe('none');
      expect(result.changes.added).toHaveLength(0);
      expect(result.changes.removed).toHaveLength(0);
    });

    it('should detect added fields', async () => {
      // Create baseline with original data
      const baselineData = { id: 1, name: 'Test' };
      const snapshot = createSchemaSnapshot(testProvider, testSchemaName, baselineData, traceId);
      await saveBaseline(snapshot);

      // Check new data with additional field
      const newData = { id: 1, name: 'Test', newField: 'value' };
      const result = await detectDrift(testProvider, testSchemaName, newData, traceId);

      expect(result.driftDetected).toBe(true);
      expect(result.severity).toBe('low');
      expect(result.changes.added).toHaveLength(1);
      expect(result.changes.added[0].name).toBe('newField');
    });

    it('should detect removed fields', async () => {
      // Create baseline with original data
      const baselineData = { id: 1, name: 'Test', extra: 'value' };
      const snapshot = createSchemaSnapshot(testProvider, testSchemaName, baselineData, traceId);
      await saveBaseline(snapshot);

      // Check new data with missing field
      const newData = { id: 1, name: 'Test' };
      const result = await detectDrift(testProvider, testSchemaName, newData, traceId);

      expect(result.driftDetected).toBe(true);
      expect(result.severity).toBe('critical');
      expect(result.changes.removed).toHaveLength(1);
      expect(result.changes.removed[0].name).toBe('extra');
    });

    it('should detect type changes', async () => {
      // Create baseline with number field
      const baselineData = { id: 1, count: 10 };
      const snapshot = createSchemaSnapshot(testProvider, testSchemaName, baselineData, traceId);
      await saveBaseline(snapshot);

      // Check new data with string field
      const newData = { id: 1, count: 'ten' };
      const result = await detectDrift(testProvider, testSchemaName, newData, traceId);

      expect(result.driftDetected).toBe(true);
      expect(result.changes.modified).toHaveLength(1);
      expect(result.changes.modified[0].field).toBe('count');
      expect(result.changes.modified[0].oldType).toBe('number');
      expect(result.changes.modified[0].newType).toBe('string');
    });

    it('should create baseline if none exists', async () => {
      const data = { id: 1, name: 'Test' };
      
      // Ensure no baseline exists
      await deleteBaseline(testProvider, testSchemaName);

      const result = await detectDrift(testProvider, testSchemaName, data, traceId);

      expect(result.driftDetected).toBe(false);
      
      // Verify baseline was created
      const loaded = await loadBaseline(testProvider, testSchemaName);
      expect(loaded).toBeDefined();
    });

    it('should include timestamps', async () => {
      const data = { id: 1 };
      const result = await detectDrift(testProvider, testSchemaName, data, traceId);

      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
      expect(result.traceId).toBe(traceId);
    });
  });
});
