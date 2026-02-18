/**
 * Normalize recommended pick labels for display/API responses.
 *
 * Converts legacy directional picks (HOME/AWAY variants) into
 * explicit team names to improve readability.
 */

export function formatRecommendedPick(
  recommendedPick: string | null | undefined,
  homeTeam: string,
  awayTeam: string
): string | null {
  if (!recommendedPick) {
    return null;
  }

  const normalized = recommendedPick.trim().toUpperCase().replace(/\s+/g, '_');

  if (/^HOME(?:_|$)/.test(normalized)) {
    return homeTeam;
  }

  if (/^AWAY(?:_|$)/.test(normalized)) {
    return awayTeam;
  }

  return recommendedPick;
}
