import { describe, expect, it } from 'vitest';
import {
  validateDecisionLookup,
  validateDecisionsQuery,
  validateRunsQuery,
} from './schemas';

describe('B2B schema validators', () => {
  it('defaults decision lookup to id', () => {
    const result = validateDecisionLookup({});
    expect(result.lookup).toBe('id');
  });

  it('accepts traceId lookup', () => {
    const result = validateDecisionLookup({ lookup: 'traceId' });
    expect(result.lookup).toBe('traceId');
  });

  it('rejects unsupported lookup values', () => {
    expect(() => validateDecisionLookup({ lookup: 'bad' })).toThrow();
  });

  it('rejects decisions query when fromDate is after toDate', () => {
    expect(() =>
      validateDecisionsQuery({
        fromDate: '2026-02-10',
        toDate: '2026-01-10',
      })
    ).toThrow();
  });

  it('enforces run pagination bounds', () => {
    expect(() => validateRunsQuery({ page: 0, limit: 20 })).toThrow();
    expect(() => validateRunsQuery({ page: 1, limit: 101 })).toThrow();
  });
});
