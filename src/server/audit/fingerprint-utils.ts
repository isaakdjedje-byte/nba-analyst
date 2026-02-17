/**
 * Data Source Fingerprint Utilities
 * 
 * Story 4.5: Implémenter les métadonnées d'audit exploitables
 * Utility functions for capturing and managing data source fingerprints.
 */

import type { DataSourceFingerprint, DataSourceFingerprints } from '@/server/audit/types';

/**
 * Create a data source fingerprint from ingestion metadata
 */
export function createSourceFingerprint(params: {
  sourceName: string;
  sourceVersion: string;
  fetchTimestamp?: Date;
  qualityScore?: number;
  recordCount?: number;
}): DataSourceFingerprint {
  return {
    sourceName: params.sourceName,
    sourceVersion: params.sourceVersion,
    fetchTimestamp: params.fetchTimestamp ?? new Date(),
    qualityScore: params.qualityScore ?? 1.0,
    recordCount: params.recordCount ?? 0,
  };
}

/**
 * Create fingerprints from multiple providers
 */
export function createFingerprintsFromIngestion(
  providerResults: Array<{
    providerName: string;
    providerVersion: string;
    success: boolean;
    recordCount?: number;
    qualityScore?: number;
  }>,
  fetchTimestamp?: Date
): DataSourceFingerprints {
  const timestamp = fetchTimestamp ?? new Date();
  
  return providerResults
    .filter(result => result.success)
    .map(result => createSourceFingerprint({
      sourceName: result.providerName,
      sourceVersion: result.providerVersion,
      fetchTimestamp: timestamp,
      qualityScore: result.qualityScore,
      recordCount: result.recordCount,
    }));
}

/**
 * Get a summary of source fingerprints for audit logging
 */
export function getFingerprintSummary(fingerprints: DataSourceFingerprints): string {
  if (!fingerprints || fingerprints.length === 0) {
    return 'No sources';
  }
  
  const sources = fingerprints.map(f => `${f.sourceName}@${f.sourceVersion}`).join(', ');
  return sources;
}

/**
 * Check if fingerprints contain a specific source
 */
export function hasSource(fingerprints: DataSourceFingerprints, sourceName: string): boolean {
  return fingerprints.some(f => f.sourceName === sourceName);
}

/**
 * Get the overall quality score from multiple sources (average)
 */
export function getOverallQualityScore(fingerprints: DataSourceFingerprints): number {
  if (!fingerprints || fingerprints.length === 0) {
    return 0;
  }
  
  const total = fingerprints.reduce((sum, f) => sum + f.qualityScore, 0);
  return total / fingerprints.length;
}
