/**
 * E2E Test Helpers - Mock Ingestion
 * Mock external data sources for daily run pipeline E2E tests
 *
 * Story: 2.10 - Implementer les tests E2E du pipeline daily run
 */

import { TestMatch } from '../fixtures/matches';
import { TestPrediction } from '../fixtures/predictions';

export interface MockServer {
  start(): Promise<void>;
  stop(): Promise<void>;
  getUrl(): string;
  setResponse(path: string, data: unknown): void;
  setError(path: string, error: { status: number; message: string }): void;
}

export interface MockIngestionConfig {
  nbaCdn: {
    matches: TestMatch[];
    delay?: number;
    shouldFail?: boolean;
  };
  espn: {
    matches: TestMatch[];
    delay?: number;
    shouldFail?: boolean;
  };
  oddsProvider: {
    matches: TestMatch[];
    delay?: number;
    shouldFail?: boolean;
  };
}

/**
 * Simple mock HTTP server for testing
 * 
 * NOTE: This is a placeholder implementation. In production E2E tests,
 * you should either:
 * 1. Use Playwright's request interception (preferred)
 * 2. Use MSW (Mock Service Worker) for HTTP mocking
 * 3. Start actual mock HTTP servers with json-server or similar
 * 
 * See Story 2.3 implementation for actual data source integration patterns.
 */
export class MockHttpServer implements MockServer {
  private server: any;
  private responses: Map<string, unknown> = new Map();
  private errors: Map<string, { status: number; message: string }> = new Map();
  private port: number;

  constructor(port: number = 0) {
    this.port = port;
  }

  async start(): Promise<void> {
    // In real implementation, this would start an actual HTTP server
    // For E2E tests, we'll use request intercepting
    console.log(`Mock server started on port ${this.port}`);
  }

  async stop(): Promise<void> {
    console.log('Mock server stopped');
  }

  getUrl(): string {
    return `http://localhost:${this.port}`;
  }

  setResponse(path: string, data: unknown): void {
    this.responses.set(path, data);
  }

  setError(path: string, error: { status: number; message: string }): void {
    this.errors.set(path, error);
  }

  getResponse(path: string): unknown | undefined {
    return this.responses.get(path);
  }

  getError(path: string): { status: number; message: string } | undefined {
    return this.errors.get(path);
  }
}

/**
 * Mock data source responses
 */
export function createNbaCdnResponse(matches: TestMatch[]) {
  return {
    games: matches.map(match => ({
      gameId: match.id,
      homeTeam: {
        id: match.homeTeamId,
        name: match.homeTeam,
        abbreviation: match.homeTeam.split(' ').pop()?.substring(0, 3).toUpperCase() || 'TBD',
      },
      awayTeam: {
        id: match.awayTeamId,
        name: match.awayTeam,
        abbreviation: match.awayTeam.split(' ').pop()?.substring(0, 3).toUpperCase() || 'TBD',
      },
      startTime: match.scheduledAt,
      status: match.status,
      venue: match.venue,
    })),
    meta: {
      totalGames: matches.length,
      date: new Date().toISOString().split('T')[0],
    },
  };
}

export function createEspnResponse(matches: TestMatch[]) {
  return {
    events: matches.map(match => ({
      id: match.id,
      name: `${match.awayTeam} at ${match.homeTeam}`,
      shortName: `${match.awayTeam.substring(0, 3)} @ ${match.homeTeam.substring(0, 3)}`,
      date: match.scheduledAt,
      status: {
        type: { name: match.status },
        period: 0,
        displayClock: '',
      },
      competitions: [{
        homeTeam: { 
          name: match.homeTeam, 
          id: match.homeTeamId,
          score: 0,
        },
        awayTeam: { 
          name: match.awayTeam, 
          id: match.awayTeamId,
          score: 0,
        },
      }],
    })),
    day: {
      date: new Date().toISOString().split('T')[0],
    },
  };
}

export function createOddsResponse(matches: TestMatch[]) {
  return {
    data: matches.map(match => ({
      gameId: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      odds: {
        homeWin: 1.85 + Math.random() * 0.5,
        awayWin: 1.85 + Math.random() * 0.5,
        draw: null, // NBA has no draws
      },
      provider: 'test-odds-provider',
      timestamp: new Date().toISOString(),
    })),
    meta: {
      provider: 'test-odds-provider',
      updatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Mock prediction service response
 */
export function createPredictionResponse(predictions: TestPrediction[]) {
  return {
    predictions: predictions.map(pred => ({
      matchId: pred.matchId,
      winner: pred.winner,
      score: pred.score,
      overUnder: pred.overUnder,
      modelVersion: pred.modelVersion,
      generatedAt: pred.generatedAt,
    })),
    meta: {
      modelVersion: 'v2.1.0',
      generatedAt: new Date().toISOString(),
      totalPredictions: predictions.length,
    },
  };
}

/**
 * Setup mock ingestion for E2E test
 * In real implementation, this would intercept HTTP requests
 */
export async function setupMockIngestion(config: MockIngestionConfig): Promise<{
  nbaCdnServer: MockHttpServer;
  espnServer: MockHttpServer;
  oddsServer: MockHttpServer;
}> {
  const nbaCdnServer = new MockHttpServer(9001);
  const espnServer = new MockHttpServer(9002);
  const oddsServer = new MockHttpServer(9003);

  // Configure responses
  if (!config.nbaCdn.shouldFail) {
    nbaCdnServer.setResponse('/api/games', createNbaCdnResponse(config.nbaCdn.matches));
  } else {
    nbaCdnServer.setError('/api/games', { status: 503, message: 'Service Unavailable' });
  }

  if (!config.espn.shouldFail) {
    espnServer.setResponse('/api/events', createEspnResponse(config.espn.matches));
  } else {
    espnServer.setError('/api/events', { status: 503, message: 'Service Unavailable' });
  }

  if (!config.oddsProvider.shouldFail) {
    oddsServer.setResponse('/api/odds', createOddsResponse(config.oddsProvider.matches));
  } else {
    oddsServer.setError('/api/odds', { status: 503, message: 'Service Unavailable' });
  }

  await Promise.all([
    nbaCdnServer.start(),
    espnServer.start(),
    oddsServer.start(),
  ]);

  return { nbaCdnServer, espnServer, oddsServer };
}

/**
 * Teardown mock ingestion
 */
export async function teardownMockIngestion(servers: {
  nbaCdnServer: MockHttpServer;
  espnServer: MockHttpServer;
  oddsServer: MockHttpServer;
}): Promise<void> {
  await Promise.all([
    servers.nbaCdnServer.stop(),
    servers.espnServer.stop(),
    servers.oddsServer.stop(),
  ]);
}

/**
 * Get environment variables for mock services
 */
export function getMockServiceEnv(servers: {
  nbaCdnServer: MockHttpServer;
  espnServer: MockHttpServer;
  oddsServer: MockHttpServer;
}) {
  return {
    NBA_CDN_URL: servers.nbaCdnServer.getUrl(),
    ESPN_API_URL: servers.espnServer.getUrl(),
    ODDS_PROVIDER_URL: servers.oddsServer.getUrl(),
  };
}
