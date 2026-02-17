/**
 * Audit Metadata Types
 * 
 * Story 4.5: Implémenter les métadonnées d'audit exploitables
 * Types for data source fingerprints and audit metadata.
 */

import { z } from 'zod';

/**
 * Data source fingerprint interface
 * Captures metadata about each data source used in decision generation
 */
export interface DataSourceFingerprint {
  sourceName: string;      // e.g., "nba-cdn", "espn", "odds-provider"
  sourceVersion: string;   // API version or data version
  fetchTimestamp: Date;    // When data was fetched
  qualityScore: number;    // 0-1 quality indicator
  recordCount: number;     // Number of records from source
}

/**
 * Zod schema for DataSourceFingerprint validation
 */
export const DataSourceFingerprintSchema = z.object({
  sourceName: z.string().min(1),
  sourceVersion: z.string().min(1),
  fetchTimestamp: z.string().datetime(), // ISO date string
  qualityScore: z.number().min(0).max(1),
  recordCount: z.number().int().min(0),
});

/**
 * Type for array of data source fingerprints
 */
export type DataSourceFingerprints = DataSourceFingerprint[];

/**
 * Zod schema for array of DataSourceFingerprints
 */
export const DataSourceFingerprintsSchema = z.array(DataSourceFingerprintSchema);

/**
 * Audit event for sensitive actions (NFR10)
 */
export interface AuditEvent {
  id: string;
  actorId: string;
  action: AuditAction;
  targetId?: string;
  targetType?: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  traceId: string;
  timestamp: Date;
}

/**
 * Audit actions enum
 */
export type AuditAction =
  | 'ROLE_CHANGE'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_REGISTER'
  | 'PASSWORD_CHANGE'
  | 'POLICY_UPDATE'
  | 'DECISION_PUBLISH'
  | 'DECISION_CREATED'
  | 'DECISION_MODIFIED'
  | 'DECISION_DELETED'
  | 'DECISION_ARCHIVED'
  | 'API_ACCESS_DENIED'
  | 'CONFIG_CHANGE'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'MFA_VERIFIED'
  | 'MFA_VERIFICATION_FAILED'
  | 'MFA_BACKUP_CODE_USED'
  | 'DATA_EXPORT_REQUESTED'
  | 'DATA_EXPORT_DOWNLOADED'
  | 'ACCOUNT_DELETION_REQUESTED'
  | 'ACCOUNT_DELETION_COMPLETED'
  | 'ACCOUNT_DELETION_CANCELLED'
  | 'DATA_CLEANUP_COMPLETED'
  | 'INVESTIGATION_VIEWED'
  | 'INVESTIGATION_EXPORT'
  | 'INVESTIGATION_COPY_TRACE'
  // Story 4.5: New audit actions
  | 'AUDIT_METADATA_EXPORTED'
  | 'AUDIT_DATA_EXPORTED'
  | 'CONFIG_CHANGE_AUDIT';

/**
 * Query parameters for audit metadata API
 */
export interface AuditMetadataQueryParams {
  traceId?: string;
  fromDate?: string;  // ISO date string
  toDate?: string;   // ISO date string
  status?: 'PICK' | 'NO_BET' | 'HARD_STOP';
  userId?: string;
  source?: string;
  page?: number;
  limit?: number;
}

/**
 * Audit metadata response item
 */
export interface AuditMetadataResponse {
  id: string;
  traceId: string;
  executedAt: string;
  modelVersion: string;
  dataSourceFingerprints: DataSourceFingerprints;
  status: 'PICK' | 'NO_BET' | 'HARD_STOP';
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  confidence: number;
  rationale: string;
}

/**
 * Paginated audit metadata response
 */
export interface AuditMetadataResult {
  data: AuditMetadataResponse[];
  meta: {
    traceId: string;
    timestamp: string;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

/**
 * Export format enum
 */
export type ExportFormat = 'csv' | 'json';

/**
 * Export parameters
 */
export interface AuditExportParams {
  fromDate?: string;
  toDate?: string;
  status?: 'PICK' | 'NO_BET' | 'HARD_STOP';
  userId?: string;
  source?: string;
  format: ExportFormat;
}
