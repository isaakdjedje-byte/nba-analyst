/**
 * Data Merger
 * Combines data from multiple sources into unified MasterGame objects
 */

import { MasterGame, PlayEvent, TeamBoxScore, PlayerStats } from '../types/game.types';

interface ShotChartRow {
  PLAYER_NAME: string;
  PERIOD: number;
  MINUTES_REMAINING: number;
  SECONDS_REMAINING: number;
  LOC_X: number;
  LOC_Y: number;
  SHOT_ZONE_BASIC: string;
  SHOT_DISTANCE: number;
  SHOT_MADE_FLAG: number;
}

interface PlayerTrackRow {
  PLAYER_NAME: string;
  AVG_SPEED?: number;
  DIST_MILES?: number;
  TOUCHES?: number;
  PASSES?: number;
  SECONDARY_ASSISTS?: number;
  FREE_THROW_ASSISTS?: number;
}

interface HustleRow {
  PLAYER_NAME: string;
  CONTESTED_SHOTS?: number;
  DEFLECTIONS?: number;
  LOOSE_BALLS_RECOVERED?: number;
  CHARGES_DRAWN?: number;
  SCREEN_ASSISTS?: number;
}

interface BRefGame {
  game_id: string;
  date: Date;
  season: number;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  winner: 'HOME' | 'AWAY';
  home_boxscore: TeamBoxScore;
  away_boxscore: TeamBoxScore;
  home_players: PlayerStats[];
  away_players: PlayerStats[];
  play_by_play: PlayEvent[];
  _data_quality: number;
}

interface NBAAPIResponse {
  game_id: string;
  boxscore_traditional: Record<string, unknown>;
  boxscore_advanced: Record<string, unknown>;
  player_tracking: { PlayerTrack?: PlayerTrackRow[] };
  shot_charts: {
    Shot_Chart_Detail: ShotChartRow[];
  };
  play_by_play: {
    PlayByPlay: Array<Record<string, unknown>>;
  };
  hustle_stats?: { PlayerHustleStats?: HustleRow[] };
  matchups?: Record<string, unknown>;
  errors: string[];
}

export class DataMerger {
  /**
   * Merge B-Ref and NBA API data into unified MasterGame
   */
  mergeGame(
    bRefData: BRefGame,
    nbaAPIData?: NBAAPIResponse | null
  ): MasterGame {
    // Start with B-Ref as base (always available)
    const masterGame: MasterGame = {
      ...bRefData,
      _sources: ['basketball-reference'],
      _fetched_at: new Date(),
    };

    // Enrich with NBA API data if available
    if (nbaAPIData) {
      this.enrichWithNBAAPIData(masterGame, nbaAPIData);
      masterGame._sources.push('nba-api');
    }

    // Update quality score
    masterGame._data_quality = this.calculateFinalQualityScore(masterGame);

    return masterGame;
  }

  /**
   * Enrich MasterGame with NBA API tracking data
   */
  private enrichWithNBAAPIData(
    game: MasterGame,
    nbaData: NBAAPIResponse
  ): void {
    // Add shot charts with coordinates to play-by-play
    if (nbaData.shot_charts?.Shot_Chart_Detail) {
      this.enrichShotsWithCoordinates(game, nbaData.shot_charts.Shot_Chart_Detail);
    }

    // Add tracking stats to players
    if (nbaData.player_tracking) {
      this.enrichPlayerTracking(game, nbaData.player_tracking);
    }

    // Add hustle stats if available
    if (nbaData.hustle_stats) {
      this.enrichHustleStats(game, nbaData.hustle_stats);
    }
  }

  /**
   * Enrich play-by-play shots with coordinates from shot charts
   */
  private enrichShotsWithCoordinates(game: MasterGame, shots: ShotChartRow[]): void {
    // Create a map of shots by player and time for matching
    const shotMap = new Map<string, ShotChartRow>();
    
    shots.forEach(shot => {
      const key = `${shot.PLAYER_NAME}_${shot.PERIOD}_${shot.MINUTES_REMAINING}_${shot.SECONDS_REMAINING}`;
      shotMap.set(key, shot);
    });

    // Try to match play-by-play events with shot coordinates
    game.play_by_play = game.play_by_play.map(event => {
      if (event.action === 'SHOT' && event.player) {
        // Try to find matching shot by player and approximate time
        const matchingShot = this.findMatchingShot(event, shotMap);
        
        if (matchingShot) {
          return {
            ...event,
            shot_x: matchingShot.LOC_X,
            shot_y: matchingShot.LOC_Y,
            shot_zone: this.classifyShotZone(matchingShot.SHOT_ZONE_BASIC),
            shot_distance: matchingShot.SHOT_DISTANCE,
            shot_made: matchingShot.SHOT_MADE_FLAG === 1,
          };
        }
      }
      return event;
    });
  }

  /**
   * Find matching shot for a play-by-play event
   */
  private findMatchingShot(event: PlayEvent, shotMap: Map<string, ShotChartRow>): ShotChartRow | null {
    // Simple matching by player name (in production, use player IDs)
    // This is a simplified version
    for (const [key, shot] of shotMap.entries()) {
      if (key.includes(event.player || '') && 
          shot.PERIOD === event.period) {
        return shot;
      }
    }
    return null;
  }

  /**
   * Classify shot zone from NBA API zone string
   */
  private classifyShotZone(zone: string): string {
    const zone_lower = zone.toLowerCase();
    
    if (zone_lower.includes('paint') || zone_lower.includes('restricted')) {
      return 'PAINT';
    } else if (zone_lower.includes('mid')) {
      return 'MID_RANGE';
    } else if (zone_lower.includes('corner') && zone_lower.includes('3')) {
      return 'CORNER_3';
    } else if (zone_lower.includes('3')) {
      return 'ABOVE_BREAK_3';
    }
    
    return 'OTHER';
  }

  /**
   * Enrich player stats with tracking data
   */
  private enrichPlayerTracking(game: MasterGame, tracking: { PlayerTrack?: PlayerTrackRow[] }): void {
    if (!tracking?.PlayerTrack) return;

    const trackingMap = new Map<string, PlayerTrackRow>();
    
    (tracking.PlayerTrack || []).forEach((track) => {
      trackingMap.set(track.PLAYER_NAME, track);
    });

    // Enrich home players
    game.home_players = game.home_players.map(player => {
      const track = trackingMap.get(player.player_name);
      if (track) {
        return {
          ...player,
          avg_speed: track.AVG_SPEED,
          distance_miles: track.DIST_MILES,
          touches: track.TOUCHES,
          passes: track.PASSES,
          secondary_assists: track.SECONDARY_ASSISTS,
          free_throw_assists: track.FREE_THROW_ASSISTS,
        };
      }
      return player;
    });

    // Enrich away players
    game.away_players = game.away_players.map(player => {
      const track = trackingMap.get(player.player_name);
      if (track) {
        return {
          ...player,
          avg_speed: track.AVG_SPEED,
          distance_miles: track.DIST_MILES,
          touches: track.TOUCHES,
          passes: track.PASSES,
          secondary_assists: track.SECONDARY_ASSISTS,
          free_throw_assists: track.FREE_THROW_ASSISTS,
        };
      }
      return player;
    });
  }

  /**
   * Enrich with hustle stats
   */
  private enrichHustleStats(game: MasterGame, hustle: { PlayerHustleStats?: HustleRow[] }): void {
    if (!hustle?.PlayerHustleStats) return;

    const hustleMap = new Map<string, HustleRow>();
    
    (hustle.PlayerHustleStats || []).forEach((stat) => {
      hustleMap.set(stat.PLAYER_NAME, stat);
    });

    const enrichWithHustle = (player: PlayerStats): PlayerStats => {
      const h = hustleMap.get(player.player_name);
      if (h) {
        return {
          ...player,
          contested_shots: h.CONTESTED_SHOTS,
          deflections: h.DEFLECTIONS,
          loose_balls_recovered: h.LOOSE_BALLS_RECOVERED,
          charges_drawn: h.CHARGES_DRAWN,
          screen_assists: h.SCREEN_ASSISTS,
        } as unknown as PlayerStats;
      }
      return player;
    };

    game.home_players = game.home_players.map(enrichWithHustle);
    game.away_players = game.away_players.map(enrichWithHustle);
  }

  /**
   * Calculate final quality score after merging
   */
  private calculateFinalQualityScore(game: MasterGame): number {
    let score = game._data_quality;
    
    // Boost score if we have NBA API data
    if (game._sources.includes('nba-api')) {
      score += 10;
    }
    
    // Check for shot coordinates
    const hasShotCoords = game.play_by_play.some(e => e.shot_x !== undefined);
    if (hasShotCoords) {
      score += 5;
    }
    
    // Check for tracking data
    const hasTracking = game.home_players.some(p => p.avg_speed !== undefined);
    if (hasTracking) {
      score += 5;
    }
    
    return Math.min(100, score);
  }

  /**
   * Validate merged data
   */
  validateGame(game: MasterGame): { valid: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check core data
    if (!game.game_id) issues.push('Missing game_id');
    if (!game.date) issues.push('Missing date');
    if (!game.home_team || !game.away_team) issues.push('Missing team names');
    if (game.home_score === undefined || game.away_score === undefined) {
      issues.push('Missing scores');
    }
    
    // Check box scores
    if (!game.home_boxscore || !game.away_boxscore) {
      issues.push('Missing box scores');
    }
    
    // Check for reasonable values
    if (game.home_score < 0 || game.away_score < 0) {
      issues.push('Negative scores');
    }
    if (game.home_score > 200 || game.away_score > 200) {
      issues.push('Suspiciously high scores');
    }
    
    return {
      valid: issues.length === 0,
      issues,
    };
  }
}
