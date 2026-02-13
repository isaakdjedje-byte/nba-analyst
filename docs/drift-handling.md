# Drift Handling Procedures

This document describes the procedures for handling schema drift detected in data ingestion pipelines.

## Overview

Schema drift occurs when the structure of data from external sources changes over time. The drift detection system monitors incoming data and compares it against established baselines to identify:

- **Added fields**: New fields that weren't in the baseline
- **Removed fields**: Fields that existed in the baseline but are missing
- **Modified fields**: Fields with changed data types

## Severity Levels

| Severity | Description | Action Required |
|----------|-------------|-----------------|
| **Critical** | Fields removed - breaking change | **Immediate action required** |
| **High** | Field type changed | Review within 1 hour |
| **Medium** | Many new fields added (>5) | Review within 4 hours |
| **Low** | Few new fields added (≤5) | Review within 24 hours |
| **None** | No drift detected | None |

## Drift Detection Process

### 1. Baseline Creation

Baselines are automatically created on first data ingestion:

```typescript
// First ingestion creates baseline
const result = await detectDrift('nba-cdn', 'schedule', data, traceId);
// result.driftDetected === false (baseline created)
```

### 2. Baseline Storage

Baselines are stored in:
```
src/server/ingestion/drift/baselines/
├── nba-cdn-schedule-baseline.json
├── odds-primary-odds-baseline.json
└── ...
```

### 3. Alerting

When drift is detected, alerts are sent through configured channels:
- Console logs
- Webhook notifications
- Slack messages
- Email (requires configuration)

## Handling Procedures

### Critical Drift (Fields Removed)

1. **Immediately quarantine affected data**
   ```typescript
   const result = await validateAgainstBaseline(provider, schema, data, traceId);
   if (!result.valid) {
     // Do not process data
     return { quarantined: true, errors: result.errors };
   }
   ```

2. **Investigate the change**
   - Check provider API documentation
   - Contact provider support if needed
   - Review if removal was intentional

3. **Update schema validation**
   - If field removal is permanent: Update Zod schemas
   - If temporary: Wait for provider fix

4. **Update baseline**
   ```typescript
   await deleteBaseline(provider, schema);
   // Next ingestion will create new baseline
   ```

### High Drift (Type Changes)

1. **Review type compatibility**
   - Can the new type be coerced to the old type?
   - Will existing code handle the new type?

2. **Update transformation logic**
   ```typescript
   // Add type coercion
   const coercedData = {
     ...data,
     count: Number(data.count), // Ensure numeric
   };
   ```

3. **Update Zod schemas**
   ```typescript
   export const GameSchema = z.object({
     // Update field to accept new type
     score: z.union([z.number(), z.string()]),
   });
   ```

4. **Update baseline**

### Medium/Low Drift (New Fields)

1. **Evaluate new fields**
   - Are they useful for our use case?
   - Do they need to be stored?

2. **Update schemas if needed**
   ```typescript
   export const GameSchema = z.object({
     existingField: z.string(),
     // Add new optional field
     newField: z.string().optional(),
   });
   ```

3. **Update baseline** (optional for low severity)

## Monitoring

### Health Check Endpoint

Check provider health status:
```bash
curl http://localhost:3000/api/ingestion/health
```

### Manual Baseline Review

List all baselines:
```typescript
import { listBaselines } from '@/server/ingestion/drift';

const baselines = await listBaselines();
console.log(baselines);
```

### Delete and Recreate Baseline

If needed, delete and recreate a baseline:
```typescript
import { deleteBaseline, detectDrift } from '@/server/ingestion/drift';

// Delete old baseline
await deleteBaseline('nba-cdn', 'schedule');

// Next ingestion creates new baseline
const result = await detectDrift('nba-cdn', 'schedule', data, traceId);
```

## Best Practices

1. **Regular monitoring**: Check drift detection logs daily
2. **Version baselines**: Consider versioning baseline files in git
3. **Test with real data**: Use sample responses from providers to test schemas
4. **Document changes**: Update this doc when drift handling changes
5. **Automated testing**: Include drift scenarios in integration tests

## Contact

For questions about drift handling:
- Technical issues: Dev team
- Provider API changes: Data engineering team
- Schema updates: Backend team
