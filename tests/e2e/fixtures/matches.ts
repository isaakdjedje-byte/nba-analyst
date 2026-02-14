/**
 * E2E Test Fixtures - Matches
 * Mock match data for daily run pipeline E2E tests
 *
 * Story: 2.10 - Implementer les tests E2E du pipeline daily run
 */

import { faker } from '@faker-js/faker';

export interface TestMatch {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId: string;
  awayTeamId: string;
  gameDate: string;
  scheduledAt: string;
  league: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  venue?: string;
}

export interface TestMatchWithOdds extends TestMatch {
  odds: {
    homeWin: number;
    awayWin: number;
    draw?: number;
    provider: string;
    timestamp: string;
  };
}

// NBA Teams with IDs (matching real NBA API format)
export const NBA_TEAMS = [
  { id: '1610612739', name: 'Cleveland Cavaliers', abbr: 'CLE' },
  { id: '1610612744', name: 'Golden State Warriors', abbr: 'GSW' },
  { id: '1610612738', name: 'Boston Celtics', abbr: 'BOS' },
  { id: '1610612748', name: 'Miami Heat', abbr: 'MIA' },
  { id: '1610612747', name: 'Los Angeles Lakers', abbr: 'LAL' },
  { id: '1610612756', name: 'Phoenix Suns', abbr: 'PHX' },
  { id: '1610612743', name: 'Denver Nuggets', abbr: 'DEN' },
  { id: '1610612751', name: 'Brooklyn Nets', abbr: 'BKN' },
] as const;

/**
 * Factory: Create a test match
 */
export function createTestMatch(overrides: Partial<TestMatch> = {}): TestMatch {
  const homeTeam = faker.helpers.arrayElement(NBA_TEAMS);
  const awayTeam = faker.helpers.arrayElement(
    NBA_TEAMS.filter(t => t.id !== homeTeam.id)
  );
  const gameDate = faker.date.future({ years: 0.02 }); // ~7 days

  return {
    id: `match-${faker.string.alphanumeric(8)}`,
    homeTeam: homeTeam.name,
    awayTeam: awayTeam.name,
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    gameDate: gameDate.toISOString().split('T')[0],
    scheduledAt: gameDate.toISOString(),
    league: 'NBA',
    status: 'scheduled',
    venue: `${homeTeam.name} Arena`,
    ...overrides,
  };
}

/**
 * Factory: Create multiple test matches
 */
export function createTestMatches(count: number): TestMatch[] {
  return Array.from({ length: count }, () => createTestMatch());
}

/**
 * Predefined test matches for consistent E2E testing
 */
export const TEST_MATCHES = {
  lakersVsWarriors: {
    id: 'match-test-001',
    homeTeam: 'Los Angeles Lakers',
    awayTeam: 'Golden State Warriors',
    homeTeamId: '1610612747',
    awayTeamId: '1610612744',
    gameDate: '2026-02-15',
    scheduledAt: '2026-02-15T20:00:00Z',
    league: 'NBA',
    status: 'scheduled' as const,
    venue: 'Crypto.com Arena',
  },
  celticsVsHeat: {
    id: 'match-test-002',
    homeTeam: 'Boston Celtics',
    awayTeam: 'Miami Heat',
    homeTeamId: '1610612738',
    awayTeamId: '1610612748',
    gameDate: '2026-02-15',
    scheduledAt: '2026-02-15T19:30:00Z',
    league: 'NBA',
    status: 'scheduled' as const,
    venue: 'TD Garden',
  },
  nuggetsVsSuns: {
    id: 'match-test-003',
    homeTeam: 'Denver Nuggets',
    awayTeam: 'Phoenix Suns',
    homeTeamId: '1610612743',
    awayTeamId: '1610612756',
    gameDate: '2026-02-16',
    scheduledAt: '2026-02-16T21:00:00Z',
    league: 'NBA',
    status: 'scheduled' as const,
    venue: 'Ball Arena',
  },
} as const;

/**
 * Standard test match set (3 matches)
 */
export const STANDARD_TEST_MATCHES: TestMatch[] = [
  TEST_MATCHES.lakersVsWarriors,
  TEST_MATCHES.celticsVsHeat,
  TEST_MATCHES.nuggetsVsSuns,
];

/**
 * Convert test match to NBA CDN API format
 */
export function toNbaCdnFormat(match: TestMatch) {
  return {
    gameId: match.id,
    homeTeam: {
      id: match.homeTeamId,
      name: match.homeTeam,
      abbreviation: NBA_TEAMS.find(t => t.name === match.homeTeam)?.abbr || 'TBD',
    },
    awayTeam: {
      id: match.awayTeamId,
      name: match.awayTeam,
      abbreviation: NBA_TEAMS.find(t => t.name === match.awayTeam)?.abbr || 'TBD',
    },
    startTime: match.scheduledAt,
    status: match.status,
  };
}

/**
 * Convert test match to ESPN API format
 */
export function toEspnFormat(match: TestMatch) {
  return {
    id: match.id,
    name: `${match.awayTeam} at ${match.homeTeam}`,
    shortName: `${NBA_TEAMS.find(t => t.name === match.awayTeam)?.abbr} @ ${NBA_TEAMS.find(t => t.name === match.homeTeam)?.abbr}`,
    date: match.scheduledAt,
    status: {
      type: { name: match.status },
    },
    competitions: [{
      homeTeam: { name: match.homeTeam, id: match.homeTeamId },
      awayTeam: { name: match.awayTeam, id: match.awayTeamId },
    }],
  };
}
