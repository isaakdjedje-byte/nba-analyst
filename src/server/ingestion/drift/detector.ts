import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'crypto';

/**
 * Schema Drift Detector
 * Detects changes in data structure over time
 */

export type SchemaFieldType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'array' 
  | 'object' 
  | 'null' 
  | 'undefined' 
  | 'unknown';

export interface SchemaField {
  name: string;
  type: SchemaFieldType;
  required: boolean;
  nullable: boolean;
  nested?: SchemaField[];
}

export interface SchemaSnapshot {
  id: string;
  provider: string;
  schemaName: string;
  version: string;
  createdAt: string;
  fields: SchemaField[];
  hash: string;
}

export interface DriftDetectionResult {
  driftDetected: boolean;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  changes: {
    added: SchemaField[];
    removed: SchemaField[];
    modified: { field: string; oldType: string; newType: string }[];
  };
  baseline: SchemaSnapshot;
  current: SchemaSnapshot;
  timestamp: string;
  traceId: string;
}

// Default baselines directory
const BASELINES_DIR = path.join(process.cwd(), 'src/server/ingestion/drift/baselines');

/**
 * Infer schema structure from data sample
 */
export function inferSchemaStructure(data: unknown, name = 'root'): SchemaField[] {
  const fields: SchemaField[] = [];

  if (data === null) {
    return [{ name, type: 'null', required: true, nullable: true }];
  }

  if (typeof data !== 'object') {
    const type = typeof data as SchemaFieldType;
    return [{ name, type, required: true, nullable: false }];
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return [{ name, type: 'array', required: true, nullable: false }];
    }
    // Infer structure from first element
    const nested = inferSchemaStructure(data[0], 'item');
    return [{ name, type: 'array', required: true, nullable: false, nested }];
  }

  // Object
  const obj = data as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    const fieldType = getFieldType(value);
    const field: SchemaField = {
      name: key,
      type: fieldType,
      required: true,
      nullable: value === null,
    };

    if (fieldType === 'object' && value !== null && !Array.isArray(value)) {
      field.nested = inferSchemaStructure(value, key);
    } else if (fieldType === 'array' && Array.isArray(value) && value.length > 0) {
      field.nested = inferSchemaStructure(value[0], `${key}Item`);
    }

    fields.push(field);
  }

  return fields;
}

function getFieldType(value: unknown): SchemaFieldType {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  
  const type = typeof value;
  switch (type) {
    case 'string':
      // Check if it looks like a date
      if (/^\d{4}-\d{2}-\d{2}T/.test(value as string)) {
        return 'date';
      }
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    default:
      return 'unknown';
  }
}

/**
 * Calculate SHA-256 hash for schema snapshot
 * Provides strong integrity checking for baseline comparison
 * Hash is based only on the schema structure (fields), not metadata
 */
function calculateSnapshotHash(snapshot: Omit<SchemaSnapshot, 'hash'>): string {
  // Only hash the fields structure, not metadata like id, timestamp, etc.
  const str = JSON.stringify(snapshot.fields);
  return createHash('sha256').update(str).digest('hex');
}

/**
 * Create schema snapshot from data
 */
export function createSchemaSnapshot(
  provider: string,
  schemaName: string,
  data: unknown,
  traceId: string
): SchemaSnapshot {
  void traceId;
  const fields = inferSchemaStructure(data);
  const snapshot: Omit<SchemaSnapshot, 'hash'> = {
    id: `${provider}-${schemaName}-${Date.now()}`,
    provider,
    schemaName,
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    fields,
  };

  return {
    ...snapshot,
    hash: calculateSnapshotHash(snapshot),
  };
}

/**
 * Save baseline snapshot to disk
 */
export async function saveBaseline(snapshot: SchemaSnapshot): Promise<void> {
  await fs.mkdir(BASELINES_DIR, { recursive: true });
  
  const filename = `${snapshot.provider}-${snapshot.schemaName}-baseline.json`;
  const filepath = path.join(BASELINES_DIR, filename);
  
  await fs.writeFile(filepath, JSON.stringify(snapshot, null, 2));
}

/**
 * Load baseline snapshot from disk
 */
export async function loadBaseline(
  provider: string,
  schemaName: string
): Promise<SchemaSnapshot | null> {
  try {
    const filename = `${provider}-${schemaName}-baseline.json`;
    const filepath = path.join(BASELINES_DIR, filename);
    
    const data = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(data) as SchemaSnapshot;
  } catch {
    return null;
  }
}

/**
 * Compare two field structures
 */
function compareFields(
  baseline: SchemaField[],
  current: SchemaField[]
): DriftDetectionResult['changes'] {
  const baselineMap = new Map(baseline.map(f => [f.name, f]));
  const currentMap = new Map(current.map(f => [f.name, f]));

  const added: SchemaField[] = [];
  const removed: SchemaField[] = [];
  const modified: { field: string; oldType: string; newType: string }[] = [];

  // Find added and modified
  for (const [name, field] of currentMap) {
    if (!baselineMap.has(name)) {
      added.push(field);
    } else {
      const baselineField = baselineMap.get(name)!;
      if (baselineField.type !== field.type) {
        modified.push({
          field: name,
          oldType: baselineField.type,
          newType: field.type,
        });
      }
    }
  }

  // Find removed
  for (const [name, field] of baselineMap) {
    if (!currentMap.has(name)) {
      removed.push(field);
    }
  }

  return { added, removed, modified };
}

/**
 * Determine severity of drift
 */
function determineSeverity(changes: DriftDetectionResult['changes']): DriftDetectionResult['severity'] {
  const { added, removed, modified } = changes;
  
  if (removed.length > 0) {
    return 'critical'; // Breaking change
  }
  
  if (modified.length > 0) {
    return 'high'; // Type change
  }
  
  if (added.length > 5) {
    return 'medium';
  }
  
  if (added.length > 0) {
    return 'low';
  }
  
  return 'none';
}

/**
 * Detect drift between baseline and current data
 */
export async function detectDrift(
  provider: string,
  schemaName: string,
  currentData: unknown,
  traceId: string
): Promise<DriftDetectionResult> {
  // Load baseline
  const baseline = await loadBaseline(provider, schemaName);
  
  // Create current snapshot
  const current = createSchemaSnapshot(provider, schemaName, currentData, traceId);
  
  // If no baseline exists, save current and return no drift
  if (!baseline) {
    await saveBaseline(current);
    return {
      driftDetected: false,
      severity: 'none',
      changes: { added: [], removed: [], modified: [] },
      baseline: current,
      current,
      timestamp: new Date().toISOString(),
      traceId,
    };
  }

  // Compare schemas
  const changes = compareFields(baseline.fields, current.fields);
  const driftDetected = changes.added.length > 0 || changes.removed.length > 0 || changes.modified.length > 0;
  const severity = determineSeverity(changes);

  return {
    driftDetected,
    severity,
    changes,
    baseline,
    current,
    timestamp: new Date().toISOString(),
    traceId,
  };
}

/**
 * Validate data against baseline schema
 */
export async function validateAgainstBaseline(
  provider: string,
  schemaName: string,
  data: unknown,
  traceId: string
): Promise<{
  valid: boolean;
  errors: string[];
  drift: DriftDetectionResult;
}> {
  const drift = await detectDrift(provider, schemaName, data, traceId);
  const errors: string[] = [];

  if (drift.driftDetected) {
    if (drift.changes.removed.length > 0) {
      errors.push(`Fields removed: ${drift.changes.removed.map(f => f.name).join(', ')}`);
    }
    if (drift.changes.modified.length > 0) {
      errors.push(`Fields modified: ${drift.changes.modified.map(f => f.field).join(', ')}`);
    }
    if (drift.severity === 'critical' || drift.severity === 'high') {
      return { valid: false, errors, drift };
    }
  }

  return { valid: true, errors, drift };
}

/**
 * List all saved baselines
 */
export async function listBaselines(): Promise<
  { provider: string; schemaName: string; file: string }[]
> {
  try {
    const files = await fs.readdir(BASELINES_DIR);
    return files
      .filter(f => f.endsWith('-baseline.json'))
      .map(f => {
        const match = f.match(/^(.+)-(.+)-baseline\.json$/);
        if (match) {
          return {
            provider: match[1],
            schemaName: match[2],
            file: f,
          };
        }
        return { provider: 'unknown', schemaName: 'unknown', file: f };
      });
  } catch {
    return [];
  }
}

/**
 * Delete a baseline
 */
export async function deleteBaseline(provider: string, schemaName: string): Promise<boolean> {
  try {
    const filename = `${provider}-${schemaName}-baseline.json`;
    const filepath = path.join(BASELINES_DIR, filename);
    await fs.unlink(filepath);
    return true;
  } catch {
    return false;
  }
}
