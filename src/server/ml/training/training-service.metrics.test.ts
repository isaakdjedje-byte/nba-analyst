import { describe, expect, it } from 'vitest';
import { calculateAUC } from './training-service';

describe('calculateAUC', () => {
  it('returns 1 for perfect ranking', () => {
    const auc = calculateAUC([
      { prob: 0.95, actual: 1 },
      { prob: 0.85, actual: 1 },
      { prob: 0.4, actual: 0 },
      { prob: 0.1, actual: 0 },
    ]);

    expect(auc).toBeCloseTo(1, 8);
  });

  it('returns 0 for perfectly inverted ranking', () => {
    const auc = calculateAUC([
      { prob: 0.95, actual: 0 },
      { prob: 0.85, actual: 0 },
      { prob: 0.4, actual: 1 },
      { prob: 0.1, actual: 1 },
    ]);

    expect(auc).toBeCloseTo(0, 8);
  });

  it('returns 0.5 for tied probabilities', () => {
    const auc = calculateAUC([
      { prob: 0.5, actual: 1 },
      { prob: 0.5, actual: 0 },
      { prob: 0.5, actual: 1 },
      { prob: 0.5, actual: 0 },
    ]);

    expect(auc).toBeCloseTo(0.5, 8);
  });

  it('returns 0.5 when only one class exists', () => {
    expect(
      calculateAUC([
        { prob: 0.9, actual: 1 },
        { prob: 0.7, actual: 1 },
      ])
    ).toBe(0.5);

    expect(
      calculateAUC([
        { prob: 0.2, actual: 0 },
        { prob: 0.1, actual: 0 },
      ])
    ).toBe(0.5);
  });

  it('always returns a bounded value in [0, 1]', () => {
    const auc = calculateAUC([
      { prob: 2, actual: 1 },
      { prob: -3, actual: 0 },
      { prob: Number.NaN, actual: 1 },
      { prob: Number.POSITIVE_INFINITY, actual: 0 },
    ]);

    expect(auc).toBeGreaterThanOrEqual(0);
    expect(auc).toBeLessThanOrEqual(1);
  });
});
