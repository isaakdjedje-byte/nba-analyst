export {
  detectDrift,
  validateAgainstBaseline,
  createSchemaSnapshot,
  saveBaseline,
  loadBaseline,
  listBaselines,
  deleteBaseline,
  inferSchemaStructure,
} from './detector';

export type {
  SchemaField,
  SchemaFieldType,
  SchemaSnapshot,
  DriftDetectionResult,
} from './detector';
