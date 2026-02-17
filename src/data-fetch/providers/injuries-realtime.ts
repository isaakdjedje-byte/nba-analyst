/**
 * NBA Injuries Real-time Provider
 * Uses nbainjuries or alternative sources
 * Status: Available | Questionable | Out | Doubtful
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { RedisCache } from '../cache/redis-cache';

interface InjuryConfig {
  sources: {
    espn: {
      enabled: boolean;
      baseUrl: string;
    };
    nba: {
      enabled: boolean;
      baseUrl: string;
    };
  };
}

export interface InjuryReport {
  playerId: string;
  playerName: string;
  team: string;
  status: 'Available' | 'Questionable' | 'Out' | 'Doubtful' | 'Probable';
  reason: string;
  reportDate: Date;
  isStarter: boolean;
  impactScore: number; // 0-10
  source: string;
}

// Star players list for impact calculation
const STAR_PLAYERS = [
  'Luka Doncic', 'Nikola Jokic', 'Giannis Antetokounmpo', 'Joel Embiid',
  'Jayson Tatum', 'Kevin Durant', 'Stephen Curry', 'LeBron James',
  'Kawhi Leonard', 'Jimmy Butler', 'Damian Lillard', 'Devin Booker',
  'Anthony Davis', 'Shai Gilgeous-Alexander', 'Donovan Mitchell',
  'Ja Morant', 'Trae Young', 'Tyrese Haliburton', 'Bam Adebayo',
  'Pascal Siakam', 'Scottie Barnes', 'Kristaps Porzingis', 'Jaylen Brown'
];

export class InjuriesRealtimeProvider {
  private config: InjuryConfig;
  private cache: RedisCache;

  constructor(cache: RedisCache) {
    this.cache = cache;
    this.config = {
      sources: {
        espn: {
          enabled: true,
          baseUrl: 'https://www.espn.com/nba/injuries',
        },
        nba: {
          enabled: true,
          baseUrl: 'https://www.nba.com/injury-report',
        },
      },
    };
  }

  /**
   * Fetch all injury reports (17h NBA time)
   */
  async fetchInjuryReports(): Promise<InjuryReport[]> {
    console.log('🏥 Fetching injury reports...');
    
    const reports: InjuryReport[] = [];

    try {
      // Try ESPN first
      if (this.config.sources.espn.enabled) {
        const espnReports = await this.fetchFromESPN();
        reports.push(...espnReports);
      }

      // Try NBA.com as backup
      if (reports.length === 0 && this.config.sources.nba.enabled) {
        const nbaReports = await this.fetchFromNBA();
        reports.push(...nbaReports);
      }

      // Calculate impact scores
      for (const report of reports) {
        report.impactScore = this.calculateImpactScore(report);
        report.isStarter = this.isLikelyStarter(report.playerName);
      }

      // Cache by team
      const teamReports = this.groupByTeam(reports);
      for (const [team, teamInjuries] of Object.entries(teamReports)) {
        await this.cache.cacheInjuries(team, teamInjuries as unknown as Record<string, unknown>);
      }

      console.log(`✅ Fetched ${reports.length} injury reports for ${Object.keys(teamReports).length} teams`);
      return reports;

    } catch (error) {
      console.error('❌ Error fetching injury reports:', error);
      throw error;
    }
  }

  /**
   * Fetch from ESPN
   */
  private async fetchFromESPN(): Promise<InjuryReport[]> {
    const reports: InjuryReport[] = [];
    
    try {
      const response = await axios.get(this.config.sources.espn.baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 30000,
      });

      const $ = cheerio.load(response.data);
      
      // ESPN injury table structure
      $('table tbody tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 4) {
          const playerName = $(cells[0]).text().trim();
          const status = $(cells[2]).text().trim();
          const reason = $(cells[3]).text().trim();
          
          // Get team from header
          const teamHeader = $(row).closest('div').prev('div').text().trim();
          const team = this.extractTeamName(teamHeader);

          if (playerName && status) {
            reports.push({
              playerId: `${team}_${playerName.replace(/\s+/g, '_')}`,
              playerName,
              team,
              status: this.normalizeStatus(status),
              reason,
              reportDate: new Date(),
              isStarter: false,
              impactScore: 0,
              source: 'espn',
            });
          }
        }
      });

    } catch (error) {
      console.warn('⚠️ ESPN fetch failed:', (error as Error).message);
    }

    return reports;
  }

  /**
   * Fetch from NBA.com
   */
  private async fetchFromNBA(): Promise<InjuryReport[]> {
    const reports: InjuryReport[] = [];
    
    try {
      const response = await axios.get(this.config.sources.nba.baseUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        timeout: 30000,
      });

      const $ = cheerio.load(response.data);
      
      // NBA.com injury table structure
      $('.injury-report table tbody tr').each((_, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 3) {
          const playerName = $(cells[0]).text().trim();
          const team = $(cells[1]).text().trim();
          const status = $(cells[2]).text().trim();
          const reason = $(cells[3])?.text().trim() || 'Not specified';

          if (playerName && status) {
            reports.push({
              playerId: `${team}_${playerName.replace(/\s+/g, '_')}`,
              playerName,
              team,
              status: this.normalizeStatus(status),
              reason,
              reportDate: new Date(),
              isStarter: false,
              impactScore: 0,
              source: 'nba.com',
            });
          }
        }
      });

    } catch (error) {
      console.warn('⚠️ NBA.com fetch failed:', (error as Error).message);
    }

    return reports;
  }

  /**
   * Normalize status to standard format
   */
  private normalizeStatus(status: string): InjuryReport['status'] {
    const normalized = status.toLowerCase().trim();
    
    if (normalized.includes('out')) return 'Out';
    if (normalized.includes('doubtful')) return 'Doubtful';
    if (normalized.includes('questionable')) return 'Questionable';
    if (normalized.includes('probable')) return 'Probable';
    
    return 'Available';
  }

  /**
   * Extract team name from header
   */
  private extractTeamName(header: string): string {
    // Remove " Injury Report" suffix
    return header.replace(/\s*Injury Report\s*$/i, '').trim();
  }

  /**
   * Check if player is likely a starter
   */
  private isLikelyStarter(playerName: string): boolean {
    // Simple heuristic: star players are starters
    return STAR_PLAYERS.includes(playerName);
  }

  /**
   * Calculate impact score (0-10)
   */
  private calculateImpactScore(report: InjuryReport): number {
    let score = 0;

    // Status impact
    switch (report.status) {
      case 'Out':
        score += 8;
        break;
      case 'Doubtful':
        score += 6;
        break;
      case 'Questionable':
        score += 3;
        break;
      case 'Probable':
        score += 1;
        break;
    }

    // Player importance
    if (this.isLikelyStarter(report.playerName)) {
      score += 2;
    }

    return Math.min(score, 10);
  }

  /**
   * Group reports by team
   */
  private groupByTeam(reports: InjuryReport[]): Record<string, InjuryReport[]> {
    const grouped: Record<string, InjuryReport[]> = {};
    
    for (const report of reports) {
      if (!grouped[report.team]) {
        grouped[report.team] = [];
      }
      grouped[report.team].push(report);
    }

    return grouped;
  }

  /**
   * Get injury impact for a game
   */
  async getGameInjuryImpact(homeTeam: string, awayTeam: string): Promise<{
    homeStarsOut: number;
    awayStarsOut: number;
    homeImpactScore: number;
    awayImpactScore: number;
    impactDiff: number;
  }> {
    const [homeInjuries, awayInjuries] = await Promise.all([
      this.cache.getInjuries(homeTeam),
      this.cache.getInjuries(awayTeam),
    ]);

    const homeReports = (homeInjuries as unknown as InjuryReport[] | null) ?? [];
    const awayReports = (awayInjuries as unknown as InjuryReport[] | null) ?? [];

    const homeStarsOut = homeReports.filter(
      (r: InjuryReport) => this.isLikelyStarter(r.playerName) && r.status === 'Out'
    ).length;

    const awayStarsOut = awayReports.filter(
      (r: InjuryReport) => this.isLikelyStarter(r.playerName) && r.status === 'Out'
    ).length;

    const homeImpactScore = homeReports.reduce(
      (sum: number, r: InjuryReport) => sum + r.impactScore, 0
    );

    const awayImpactScore = awayReports.reduce(
      (sum: number, r: InjuryReport) => sum + r.impactScore, 0
    );

    return {
      homeStarsOut,
      awayStarsOut,
      homeImpactScore,
      awayImpactScore,
      impactDiff: homeImpactScore - awayImpactScore,
    };
  }

  /**
   * Get all active injuries
   */
  async getAllActiveInjuries(): Promise<InjuryReport[]> {
    const keys = await this.cache.getKeys('injuries:*');
    const allInjuries: InjuryReport[] = [];

    for (const key of keys) {
      const teamInjuries = await this.cache.get<InjuryReport[]>(key);
      if (teamInjuries) {
        allInjuries.push(...(teamInjuries as unknown as InjuryReport[]));
      }
    }

    return allInjuries;
  }
}
