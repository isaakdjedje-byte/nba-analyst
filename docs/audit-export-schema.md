# Audit Export Schema Documentation

**Story:** 4.5 - Implémenter les métadonnées d'audit exploitables  
**Date:** 2026-02-15  
**Version:** 1.0

---

## Overview

This document describes the export format schemas for audit metadata API endpoints.

## Export API Endpoints

### GET /api/v1/audit/metadata

Query audit metadata with filters.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| traceId | string | No | Exact match on trace ID |
| fromDate | ISO 8601 | No | Start date for date range filter |
| toDate | ISO 8601 | No | End date for date range filter |
| status | string | No | Decision status: PICK, NO_BET, HARD_STOP |
| userId | string | No | Filter by user ID |
| source | string | No | Filter by data source name |
| page | number | No | Page number (default: 1) |
| limit | number | No | Results per page (default: 50, max: 100) |

### GET /api/v1/audit/export

Export audit metadata in CSV or JSON format.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| fromDate | ISO 8601 | No | Start date for date range filter |
| toDate | ISO 8601 | No | End date for date range filter |
| status | string | No | Decision status: PICK, NO_BET, HARD_STOP |
| userId | string | No | Filter by user ID |
| source | string | No | Filter by data source name |
| format | string | No | Export format: csv, json (default: json) |

---

## JSON Export Schema

### Response Envelope

```json
{
  "data": [...],
  "meta": {
    "traceId": "string",
    "timestamp": "ISO 8601",
    "export": {
      "format": "json" | "csv",
      "recordCount": number,
      "fromDate": "ISO 8601" | null,
      "toDate": "ISO 8601" | null
    }
  }
}
```

### Audit Metadata Item

```typescript
interface AuditMetadataResponse {
  id: string;                    // Unique decision ID (UUID)
  traceId: string;               // Trace ID for request tracking
  executedAt: string;             // ISO 8601 timestamp
  modelVersion: string;           // ML model version used
  dataSourceFingerprints: DataSourceFingerprints;  // Array of source fingerprints
  status: 'PICK' | 'NO_BET' | 'HARD_STOP';  // Decision status
  matchId: string;                // Match identifier
  homeTeam: string;              // Home team name
  awayTeam: string;              // Away team name
  confidence: number;           // Confidence score (0-1)
  rationale: string;             // Decision rationale
}
```

### Data Source Fingerprint

```typescript
interface DataSourceFingerprint {
  sourceName: string;      // e.g., "nba-cdn", "espn", "odds-provider"
  sourceVersion: string;  // API version or data version
  fetchTimestamp: string; // ISO 8601 timestamp
  qualityScore: number;    // Quality indicator (0-1)
  recordCount: number;    // Number of records from source
}
```

---

## CSV Export Schema

### Headers

```
id,traceId,executedAt,modelVersion,status,matchId,homeTeam,awayTeam,confidence,rationale,dataSources,sourceVersions,sourceQualityScores
```

### Column Descriptions

| Column | Description | Example |
|--------|-------------|---------|
| id | Decision UUID | abc123-def456-... |
| traceId | Trace ID | trace-20260215-001 |
| executedAt | Execution timestamp | 2026-02-15T10:30:00Z |
| modelVersion | ML model version | v2.1.0 |
| status | Decision status | PICK |
| matchId | Match identifier | nba-2026-02-15-lal-lac |
| homeTeam | Home team | Los Angeles Lakers |
| awayTeam | Away team | Los Angeles Clippers |
| confidence | Confidence score | 0.85 |
| rationale | Decision rationale | Confidence above threshold |
| dataSources | Source names (semicolon-separated) | nba-cdn;espn |
| sourceVersions | Source versions (semicolon-separated) | 2.1.0;1.5.0 |
| sourceQualityScores | Quality scores (semicolon-separated) | 0.95;0.88 |

### CSV Example

```csv
id,traceId,executedAt,modelVersion,status,matchId,homeTeam,awayTeam,confidence,rationale,dataSources,sourceVersions,sourceQualityScores
abc123,trace-20260215-001,2026-02-15T10:30:00Z,v2.1.0,PICK,nba-2026-02-15-lal-lac,Los Angeles Lakers,Los Angeles Clippers,0.85,Confidence above threshold,nba-cdn;espn,2.1.0;1.5.0,0.95;0.88
```

---

## Filtering Examples

### Filter by Date Range

```
GET /api/v1/audit/export?fromDate=2026-01-01T00:00:00Z&toDate=2026-01-31T23:59:59Z&format=json
```

### Filter by Decision Status

```
GET /api/v1/audit/export?status=PICK&format=csv
```

### Filter by Data Source

```
GET /api/v1/audit/metadata?source=nba-cdn&page=1&limit=50
```

### Combined Filters

```
GET /api/v1/audit/export?fromDate=2026-01-01T00:00:00Z&toDate=2026-01-31T23:59:59Z&status=HARD_STOP&source=espn&format=json
```

---

## Audit Actions Logged

The following audit actions are logged for NFR10 compliance:

| Action | Description |
|--------|-------------|
| AUDIT_METADATA_EXPORTED | When audit metadata is exported |
| AUDIT_DATA_EXPORTED | When decision data is exported |
| CONFIG_CHANGE_AUDIT | When policy configuration changes |

---

## Retention Policy

Audit logs are retained for **90+ days** per data retention policy (NFR10).

---

## Error Responses

### 401 Unauthorized

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  },
  "meta": {
    "traceId": "string",
    "timestamp": "ISO 8601"
  }
}
```

### 403 Forbidden

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions. Support, Ops, or Admin role required."
  },
  "meta": {
    "traceId": "string",
    "timestamp": "ISO 8601"
  }
}
```

### 400 Validation Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": [...]
  },
  "meta": {
    "traceId": "string",
    "timestamp": "ISO 8601"
  }
}
```

---

## Rate Limiting

- **Metadata API:** 100 requests/minute per user
- **Export API:** 10 requests/minute per user (to prevent abuse)

---

## Related Documentation

- [Architecture - Observability](../architecture.md#observability)
- [Architecture - NFR10](../architecture.md#nfr10)
- [PRD - FR24](../prd.md#fr24)
