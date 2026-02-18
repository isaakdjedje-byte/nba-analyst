import { describe, expect, it } from 'vitest';
import { formatRecommendedPick } from './recommended-pick';

describe('formatRecommendedPick', () => {
  it('maps HOME variants to home team name', () => {
    expect(formatRecommendedPick('HOME', 'Lakers', 'Celtics')).toBe('Lakers');
    expect(formatRecommendedPick('HOME_ML', 'Lakers', 'Celtics')).toBe('Lakers');
    expect(formatRecommendedPick('home ml', 'Lakers', 'Celtics')).toBe('Lakers');
  });

  it('maps AWAY variants to away team name', () => {
    expect(formatRecommendedPick('AWAY', 'Lakers', 'Celtics')).toBe('Celtics');
    expect(formatRecommendedPick('AWAY_ML', 'Lakers', 'Celtics')).toBe('Celtics');
    expect(formatRecommendedPick('away ml', 'Lakers', 'Celtics')).toBe('Celtics');
  });

  it('preserves explicit pick labels', () => {
    expect(formatRecommendedPick('Lakers ML', 'Lakers', 'Celtics')).toBe('Lakers ML');
  });

  it('returns null when input is nullish', () => {
    expect(formatRecommendedPick(null, 'Lakers', 'Celtics')).toBeNull();
    expect(formatRecommendedPick(undefined, 'Lakers', 'Celtics')).toBeNull();
  });
});
