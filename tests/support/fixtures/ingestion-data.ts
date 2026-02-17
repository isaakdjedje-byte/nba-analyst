/**
 * Data Factories for Ingestion Tests
 * Generates test data for odds and NBA data ingestion
 */

import { faker } from '@faker-js/faker';

export interface OddsData {
  gameId: string;
  homeTeam: string;
  awayTeam: string;
  homeOdds: number;
  awayOdds: number;
  drawOdds?: number;
  timestamp: string;
  provider: string;
}

export interface NbaGameData {
  gameId: string;
  homeTeam: { id: string; name: string; abbreviation: string };
  awayTeam: { id: string; name: string; abbreviation: string };
  homeScore: number;
  awayScore: number;
  status: 'scheduled' | 'in_progress' | 'finished';
  startTime: string;
}

export interface DriftReport {
  id: string;
  schema: 'odds' | 'nba' | 'players';
  detectedAt: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  unexpectedFields: string[];
  missingFields?: string[];
  sampleData?: Record<string, unknown>;
}

/**
 * Factory: Create valid odds data
 */
export function createOddsData(overrides: Partial<OddsData> = {}): OddsData {
  const teams = [
    { name: 'Lakers', abbr: 'LAL' },
    { name: 'Warriors', abbr: 'GSW' },
    { name: 'Celtics', abbr: 'BOS' },
    { name: 'Heat', abbr: 'MIA' },
    { name: 'Nuggets', abbr: 'DEN' },
    { name: 'Suns', abbr: 'PHX' },
  ];

  const homeTeam = faker.helpers.arrayElement(teams);
  const awayTeam = faker.helpers.arrayElement(teams.filter(t => t.name !== homeTeam.name));

  return {
    gameId: faker.string.uuid(),
    homeTeam: homeTeam.name,
    awayTeam: awayTeam.name,
    homeOdds: faker.number.float({ min: 1.1, max: 5.0, fractionDigits: 2 }),
    awayOdds: faker.number.float({ min: 1.1, max: 5.0, fractionDigits: 2 }),
    drawOdds: faker.helpers.maybe(() => faker.number.float({ min: 2.0, max: 10.0, fractionDigits: 2 })),
    timestamp: new Date().toISOString(),
    provider: faker.helpers.arrayElement(['bet365', 'draftkings', 'fanduel', 'pinnacle']),
    ...overrides,
  };
}

/**
 * Factory: Create valid NBA game data
 */
export function createNbaGameData(overrides: Partial<NbaGameData> = {}): NbaGameData {
  const teams = [
    { id: '1610612739', name: 'Cleveland Cavaliers', abbr: 'CLE' },
    { id: '1610612744', name: 'Golden State Warriors', abbr: 'GSW' },
    { id: '1610612738', name: 'Boston Celtics', abbr: 'BOS' },
    { id: '1610612748', name: 'Miami Heat', abbr: 'MIA' },
  ];

  const homeTeam = faker.helpers.arrayElement(teams);
  const awayTeam = faker.helpers.arrayElement(teams.filter(t => t.id !== homeTeam.id));

  return {
    gameId: `00224${faker.string.numeric(5)}`,
    homeTeam: {
      id: homeTeam.id,
      name: homeTeam.name,
      abbreviation: homeTeam.abbr,
    },
    awayTeam: {
      id: awayTeam.id,
      name: awayTeam.name,
      abbreviation: awayTeam.abbr,
    },
    homeScore: faker.number.int({ min: 80, max: 150 }),
    awayScore: faker.number.int({ min: 80, max: 150 }),
    status: faker.helpers.arrayElement(['scheduled', 'in_progress', 'finished']),
    startTime: faker.date.future().toISOString(),
    ...overrides,
  };
}

/**
 * Factory: Create drift report
 */
export function createDriftReport(overrides: Partial<DriftReport> = {}): DriftReport {
  return {
    id: `drift-${faker.string.alphanumeric(8)}`,
    schema: faker.helpers.arrayElement(['odds', 'nba', 'players']),
    detectedAt: new Date().toISOString(),
    severity: faker.helpers.arrayElement(['low', 'medium', 'high', 'critical']),
    unexpectedFields: [faker.string.alpha(8), faker.string.alpha(8)],
    ...overrides,
  };
}

/**
 * Factory: Create invalid odds data (for negative testing)
 */
export function createInvalidOddsData(type: 'missing_fields' | 'wrong_types' | 'extra_fields'): Record<string, unknown> {
  switch (type) {
    case 'missing_fields':
      return {
        // Missing gameId, homeTeam, awayTeam
        homeOdds: 1.85,
        timestamp: new Date().toISOString(),
      };

    case 'wrong_types':
      return {
        gameId: 123, // Should be string
        homeTeam: 'Lakers',
        awayTeam: 'Warriors',
        homeOdds: 'not_a_number', // Should be number
        timestamp: 'invalid_date',
      };

    case 'extra_fields':
      return {
        gameId: faker.string.uuid(),
        homeTeam: 'Lakers',
        awayTeam: 'Warriors',
        homeOdds: 1.85,
        awayOdds: 2.10,
        timestamp: new Date().toISOString(),
        unexpectedField1: 'value1',
        unexpectedField2: { nested: 'data' },
        anotherUnexpected: 12345,
      };

    default:
      return {};
  }
}

/**
 * Factory: Create provider health status
 */
export function createProviderHealth(provider: string): {
  provider: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: string;
  responseTimeMs: number;
  errorRate: number;
} {
  const status = faker.helpers.arrayElement(['healthy', 'degraded', 'unhealthy'] as const);
  return {
    provider,
    status,
    lastCheck: new Date().toISOString(),
    responseTimeMs: status === 'healthy'
      ? faker.number.int({ min: 50, max: 500 })
      : faker.number.int({ min: 500, max: 5000 }),
    errorRate: status === 'healthy'
      ? faker.number.float({ min: 0, max: 0.01, fractionDigits: 4 })
      : faker.number.float({ min: 0.05, max: 0.5, fractionDigits: 4 }),
  };
}

/**
 * Factory: Create ingestion log entry
 */
export function createIngestionLogEntry(overrides: Partial<{
  id: string;
  provider: string;
  recordsProcessed: number;
  recordsFailed: number;
  durationMs: number;
  timestamp: string;
  status: 'success' | 'partial' | 'failed';
}> = {}) {
  const status = faker.helpers.arrayElement(['success', 'partial', 'failed'] as const);
  const recordsProcessed = faker.number.int({ min: 10, max: 1000 });

  return {
    id: `log-${faker.string.alphanumeric(10)}`,
    provider: faker.helpers.arrayElement(['odds-provider', 'nba-cdn', 'secondary-odds']),
    recordsProcessed,
    recordsFailed: status === 'success' ? 0 : faker.number.int({ min: 1, max: recordsProcessed / 10 }),
    durationMs: faker.number.int({ min: 100, max: 5000 }),
    timestamp: faker.date.recent().toISOString(),
    status,
    ...overrides,
  };
}
