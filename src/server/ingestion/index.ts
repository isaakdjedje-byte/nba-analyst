// Ingestion Module
// Provides data ingestion from multiple sources with validation and drift detection

// Providers
export {
  BaseProvider,
  NBACDNProvider,
  OddsProvider,
  OddsSecondaryProvider,
  createProvider,
  getProvider,
  getAllProviders,
  clearProviderCache,
  getProvidersHealth,
} from './providers';

export type {
  ProviderConfig,
  ProviderType,
  ProviderFactoryConfig,
  DataSourceResult,
  ProviderMetadata,
} from './providers';

// Schemas
export {
  validateSchema,
  validateSchemaOrThrow,
  validateStream,
  createValidationMiddleware,
  generateValidationReport,
  isSchemaValidationError,
  SchemaValidationError,
} from './schema/validation';

export type {
  ValidationResult,
  ValidationError,
  ValidationContext,
} from './schema/validation';

export * from './schema/nba-schemas';
export * from './schema/odds-schemas';

// Drift Detection
export {
  detectDrift,
  validateAgainstBaseline,
  createSchemaSnapshot,
  saveBaseline,
  loadBaseline,
  listBaselines,
  deleteBaseline,
  inferSchemaStructure,
} from './drift';

export type {
  SchemaField,
  SchemaFieldType,
  SchemaSnapshot,
  DriftDetectionResult,
} from './drift';

// Health Checks
export {
  checkProviderHealth,
  checkAllProvidersHealth,
  formatHealthStatus,
  createHealthResponse,
  defaultProviderConfigs,
} from './health-check';

export type {
  ProviderHealthResult,
  SystemHealthResult,
} from './health-check';

// Alerting
export {
  sendAlert,
  createDriftAlert,
  createFailureAlert,
} from './alerting';

export type {
  AlertConfig,
  AlertPayload,
  AlertSeverity,
} from './alerting';

// Ingestion Service
export {
  IngestionService,
  createIngestionService,
} from './ingestion-service';

export type {
  IngestionConfig,
  IngestionResult,
  IngestionError,
  MultiProviderResult,
} from './ingestion-service';
