import { BaseProvider, DataSourceResult, ProviderConfig } from './base-provider';
import {
  Game,
  GameSchema,
  Team,
  TeamSchema,
} from '../schema/nba-schemas';
import { validateSchemaOrThrow, ValidationContext } from '../schema/validation';

/**
 * ESPN Provider
 * Fetches NBA data from ESPN API as a secondary/backup data source
 */

export interface ESPNGameFilter {
  date?: string; // YYYY-MM-DD
  team?: string;
  status?: 'pre' | 'in' | 'post';
}

export interface ESPNNewsFilter {
  team?: string;
  player?: string;
  limit?: number;
}

export class ESPNProvider extends BaseProvider {
  private readonly apiVersion = 'v1';
  private readonly eastTeams = new Set([
    'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DET', 'IND', 'MIA', 'MIL',
    'NYK', 'ORL', 'PHI', 'TOR', 'WAS',
  ]);

  constructor(config: ProviderConfig) {
    super(config);
  }

  private formatDateForESPN(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  private normalizeAbbreviation(value: unknown): string {
    const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (raw.length >= 3) {
      return raw.slice(0, 3);
    }
    if (raw.length > 0) {
      return raw.padEnd(3, 'X');
    }
    return 'UNK';
  }

  private getConferenceFromAbbr(abbr: string): 'East' | 'West' {
    return this.eastTeams.has(abbr) ? 'East' : 'West';
  }

  /**
   * Get NBA scoreboard for a date
   */
  async getScoreboard(date?: string): Promise<DataSourceResult<Game[]>> {
    const traceId = this.generateTraceId();
    const dateQuery = date
      ? date.replace(/-/g, '')
      : `${this.formatDateForESPN(new Date())}-${this.formatDateForESPN(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))}`;

    try {
      const endpoint = `/basketball/nba/scoreboard?dates=${dateQuery}&limit=1000`;
      const { data, latency } = await this.makeRequest<unknown>(endpoint);

      const context: ValidationContext = {
        source: 'espn',
        operation: 'getScoreboard',
        traceId,
        timestamp: new Date(),
      };

      // ESPN returns events array, normalize to Game schema
      const normalizedData = this.normalizeESPNData(data);

      // Validate each game
      const validatedGames: Game[] = [];
      for (let i = 0; i < normalizedData.length; i++) {
        try {
          const game = validateSchemaOrThrow(GameSchema, normalizedData[i], {
            ...context,
            traceId: `${traceId}-game-${i}`,
          });
          validatedGames.push(game);
        } catch (error) {
          console.warn(`[${traceId}] Failed to validate ESPN game ${i}:`, error);
        }
      }

      return {
        data: validatedGames,
        metadata: {
          source: this.config.name,
          timestamp: new Date(),
          traceId,
          latency,
        },
      };
    } catch (error) {
      this.logError('getScoreboard', error, traceId);
      throw new Error(`[${traceId}] ESPN getScoreboard failed`);
    }
  }

  /**
   * Get team information
   */
  async getTeams(): Promise<DataSourceResult<Team[]>> {
    const traceId = this.generateTraceId();

    try {
      const endpoint = '/basketball/nba/teams';
      const { data, latency } = await this.makeRequest<unknown>(endpoint);

      const context: ValidationContext = {
        source: 'espn',
        operation: 'getTeams',
        traceId,
        timestamp: new Date(),
      };

      // Normalize ESPN team data
      const normalizedData = this.normalizeESPNTeamData(data);

      // Validate each team
      const validatedTeams: Team[] = [];
      for (let i = 0; i < normalizedData.length; i++) {
        const team = validateSchemaOrThrow(TeamSchema, normalizedData[i], {
          ...context,
          traceId: `${traceId}-team-${i}`,
        });
        validatedTeams.push(team);
      }

      return {
        data: validatedTeams,
        metadata: {
          source: this.config.name,
          timestamp: new Date(),
          traceId,
          latency,
        },
      };
    } catch (error) {
      this.logError('getTeams', error, traceId);
      throw this.createProviderError('Failed to fetch ESPN teams', error, traceId);
    }
  }

  /**
   * Get news/headlines
   */
  async getNews(filter: ESPNNewsFilter = {}): Promise<DataSourceResult<unknown[]>> {
    const traceId = this.generateTraceId();

    try {
      const params = new URLSearchParams();
      if (filter.limit) params.set('limit', filter.limit.toString());
      
      const endpoint = `/basketball/nba/news?${params.toString()}`;
      const { data, latency } = await this.makeRequest<unknown[]>(endpoint);

      return {
        data,
        metadata: {
          source: this.config.name,
          timestamp: new Date(),
          traceId,
          latency,
        },
      };
    } catch (error) {
      this.logError('getNews', error, traceId);
      throw this.createProviderError('Failed to fetch ESPN news', error, traceId);
    }
  }

  /**
   * Normalize ESPN event data to Game schema
   */
  private normalizeESPNData(data: unknown): unknown[] {
    // ESPN returns { events: [...] }
    if (typeof data === 'object' && data !== null && 'events' in data) {
      const events = (data as { events: unknown[] }).events;
      return events.map((event) => this.normalizeEvent(event));
    }
    return [];
  }

  /**
   * Normalize single ESPN event
   */
  private normalizeEvent(event: unknown): unknown {
    if (typeof event !== 'object' || event === null) {
      return null;
    }

    const e = event as Record<string, unknown>;
    
    // Extract teams from competition
    const competition = (e.competitions as unknown[] || [])[0] as Record<string, unknown> || {};
    const competitors = (competition.competitors as unknown[]) || [];
    
    const homeCompetitor = competitors.find((c: unknown) => 
      (c as Record<string, unknown>).homeAway === 'home'
    ) as Record<string, unknown>;
    const awayCompetitor = competitors.find((c: unknown) => 
      (c as Record<string, unknown>).homeAway === 'away'
    ) as Record<string, unknown>;

    const homeTeam = homeCompetitor?.team as Record<string, unknown>;
    const awayTeam = awayCompetitor?.team as Record<string, unknown>;

    // Map status
    const status = (e.status as Record<string, unknown>)?.type as Record<string, unknown>;
    const statusState = (status?.state as string) || 'pre';
    const mappedStatus = this.mapESPNStatus(statusState);

    // Extract scores
    const homeScore = homeCompetitor?.score ? parseInt(homeCompetitor.score as string, 10) : undefined;
    const awayScore = awayCompetitor?.score ? parseInt(awayCompetitor.score as string, 10) : undefined;

    const homeAbbr = this.normalizeAbbreviation(homeTeam.abbreviation);
    const awayAbbr = this.normalizeAbbreviation(awayTeam.abbreviation);

    return {
      id: parseInt(e.id as string, 10) || 0,
      season: new Date().getFullYear(),
      seasonType: 'Regular Season',
      status: mappedStatus,
      date: e.date as string,
      homeTeam: homeTeam ? {
        id: parseInt(homeTeam.id as string, 10) || 0,
        name: (homeTeam.name as string) || '',
        city: (homeTeam.location as string) || '',
          abbreviation: homeAbbr,
          conference: this.getConferenceFromAbbr(homeAbbr),
          division: '',
        } : undefined,
      awayTeam: awayTeam ? {
        id: parseInt(awayTeam.id as string, 10) || 0,
        name: (awayTeam.name as string) || '',
        city: (awayTeam.location as string) || '',
          abbreviation: awayAbbr,
          conference: this.getConferenceFromAbbr(awayAbbr),
          division: '',
        } : undefined,
      homeScore,
      awayScore,
    };
  }

  /**
   * Normalize ESPN team data
   */
  private normalizeESPNTeamData(data: unknown): unknown[] {
    if (typeof data === 'object' && data !== null && 'sports' in data) {
      const sports = (data as { sports: unknown[] }).sports;
      const leagues = ((sports[0] as Record<string, unknown>)?.leagues as unknown[]) || [];
      const teams = ((leagues[0] as Record<string, unknown>)?.teams as unknown[]) || [];
      
      return teams.map((t: unknown) => {
        const team = (t as Record<string, unknown>).team as Record<string, unknown>;
        const abbr = this.normalizeAbbreviation(team.abbreviation);

        return {
          id: parseInt(team.id as string, 10) || 0,
          name: (team.name as string) || '',
          city: (team.location as string) || '',
          abbreviation: abbr,
          conference: this.getConferenceFromAbbr(abbr),
          division: '',
        };
      });
    }
    return [];
  }

  /**
   * Map ESPN status to our GameStatus
   */
  private mapESPNStatus(espnStatus: string): string {
    const statusMap: Record<string, string> = {
      'pre': 'scheduled',
      'in': 'in_progress',
      'post': 'completed',
    };
    return statusMap[espnStatus] || 'scheduled';
  }

  /**
   * Fetch all data (main entry point for ingestion)
   */
  async fetchData(): Promise<DataSourceResult<Game[]>> {
    const traceId = this.generateTraceId();

    try {
      // Get today's scoreboard
      const result = await this.getScoreboard();
      
      return {
        data: result.data,
        metadata: {
          source: this.config.name,
          timestamp: new Date(),
          traceId,
        },
      };
    } catch (error) {
      this.logError('fetchData', error, traceId);
      throw this.createProviderError('Failed to fetch ESPN data', error, traceId);
    }
  }

  /**
   * Health check for ESPN
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const startTime = Date.now();

    try {
      // Try to fetch teams as a simple health check
      await this.getTeams();
      return {
        healthy: true,
        latency: Date.now() - startTime,
      };
    } catch {
      return {
        healthy: false,
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * Log error with trace context
   */
  private logError(operation: string, error: unknown, traceId: string): void {
    console.error(`[${traceId}] ESPN Error in ${operation}:`, error);
  }

  /**
   * Create standardized provider error
   */
  private createProviderError(
    message: string,
    error: unknown,
    traceId: string
  ): Error {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Error(`${message} [${traceId}]: ${errorMessage}`);
  }
}
