/**
 * Basketball-Reference Data Provider
 * Scrapes historical NBA data from basketball-reference.com
 */

import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import * as fs from 'fs';
import { loadConfig } from '../config/fetch.config';
import { MasterGame, TeamBoxScore, PlayerStats, PlayEvent, FourFactors } from '../types/game.types';

export class BasketballReferenceProvider {
  private config = loadConfig().sources.basketballReference;
  private lastRequestTime = 0;
  private progressFile = './logs/bref-progress.json';

  constructor() {
    if (!this.config.enabled) {
      throw new Error('Basketball-Reference provider is disabled');
    }
  }

  /**
   * Main entry: fetch all games for a season
   */
  async fetchSeason(season: number): Promise<MasterGame[]> {
    console.log(`\n📊 Fetching Basketball-Reference season ${season}...`);
    console.log(`   ⚠️  Rate limiting: ${this.config.rateLimitMs}ms + jitter between requests`);
    
    // Load checkpoint if exists
    const checkpoint = this.loadCheckpoint(season);
    const startIndex = checkpoint?.last_index || 0;
    
    // Get schedule (list of all games)
    const schedule = await this.fetchSchedule(season);
    const gamesToFetch = schedule.slice(startIndex);
    
    console.log(`  Total games: ${schedule.length}, Starting from: ${startIndex}`);
    
    const games: MasterGame[] = checkpoint?.games || [];
    let processed = 0;
    let consecutiveFailures = 0;
    
    for (let i = 0; i < gamesToFetch.length; i++) {
      const gameStub = gamesToFetch[i];
      const absoluteIndex = startIndex + i;
      
      try {
        console.log(`  [${absoluteIndex + 1}/${schedule.length}] ${gameStub.game_id}...`);
        
        // Fetch boxscore
        const boxscoreHtml = await this.fetchWithRetry(
          `${this.config.baseUrl}/boxscores/${gameStub.game_id}.html`
        );
        
        // Fetch play-by-play (optional, don't fail if not available)
        let pbpHtml: string | null = null;
        try {
          pbpHtml = await this.fetchWithRetry(
            `${this.config.baseUrl}/boxscores/pbp/${gameStub.game_id}.html`
          );
        } catch {
          console.warn(`    ⚠️  PBP not available for ${gameStub.game_id}`);
        }
        
        // Parse and merge
        const game = this.parseGame(boxscoreHtml, pbpHtml, gameStub);
        games.push(game);
        consecutiveFailures = 0; // Reset on success
        
        // Checkpoint every N games
        processed++;
        if (processed % loadConfig().checkpoint.interval === 0) {
          this.saveCheckpoint(season, absoluteIndex + 1, games);
          console.log(`    💾 Checkpoint saved (${games.length} games)`);
          
          // Longer pause every 10 games to avoid detection
          console.log(`    ⏱️  Taking a 10s break to avoid rate limiting...`);
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
        
      } catch (error) {
        consecutiveFailures++;
        console.error(`    ❌ Failed: ${gameStub.game_id}`, (error as Error).message);
        this.logError(season, gameStub.game_id, (error as Error).message);
        
        // If too many consecutive failures, take a longer break
        if (consecutiveFailures >= 3) {
          const breakTime = 30000 * consecutiveFailures;
          console.log(`    ⚠️  ${consecutiveFailures} consecutive failures. Taking a ${breakTime/1000}s break...`);
          await new Promise(resolve => setTimeout(resolve, breakTime));
        }
      }
      
      // Rate limiting with jitter
      await this.applyRateLimit();
    }
    
    // Final checkpoint
    this.saveCheckpoint(season, schedule.length, games);
    console.log(`  ✅ Season ${season} complete: ${games.length}/${schedule.length} games`);
    
    return games;
  }

  /**
   * Fetch season schedule
   */
  private async fetchSchedule(season: number): Promise<Array<{ game_id: string; date: Date }>> {
    const url = `${this.config.baseUrl}/leagues/NBA_${season}_games.html`;
    const html = await this.fetchWithRetry(url);
    
    const $ = cheerio.load(html);
    const games: Array<{ game_id: string; date: Date }> = [];
    
    // Schedule table
    $('#schedule tbody tr').each((_, row) => {
      const $row = $(row);
      const dateCell = $row.find('th[data-stat="date_game"] a');
      const boxscoreCell = $row.find('td[data-stat="box_score_text"] a');
      
      if (dateCell.length && boxscoreCell.length) {
        const href = boxscoreCell.attr('href');
        if (href) {
          const gameId = href.replace('/boxscores/', '').replace('.html', '');
          const dateText = dateCell.text().trim();
          const date = this.parseDate(dateText);
          
          games.push({ game_id: gameId, date });
        }
      }
    });
    
    // Sort by date
    games.sort((a, b) => a.date.getTime() - b.date.getTime());
    
    return games;
  }

  /**
   * Parse game data from HTML
   */
  private parseGame(
    boxscoreHtml: string,
    pbpHtml: string | null,
    stub: { game_id: string; date: Date }
  ): MasterGame {
    const $boxscore = cheerio.load(boxscoreHtml);
    
    // Extract teams
    const teams = this.extractTeams($boxscore);
    
    // Extract scores
    const scores = this.extractScores($boxscore);
    
    // Extract box scores
    const homeBoxScore = this.extractTeamBoxScore($boxscore, teams.home);
    const awayBoxScore = this.extractTeamBoxScore($boxscore, teams.away);
    
    // Extract player stats
    const homePlayers = this.extractPlayerStats($boxscore, teams.home);
    const awayPlayers = this.extractPlayerStats($boxscore, teams.away);
    
    // Extract play-by-play
    const playByPlay = pbpHtml ? this.extractPlayByPlay(cheerio.load(pbpHtml)) : [];
    
    return {
      game_id: stub.game_id,
      date: stub.date,
      season: this.extractSeason(stub.game_id),
      home_team: teams.home,
      away_team: teams.away,
      home_score: scores.home,
      away_score: scores.away,
      winner: scores.home > scores.away ? 'HOME' : 'AWAY',
      
      home_boxscore: homeBoxScore,
      away_boxscore: awayBoxScore,
      home_players: homePlayers,
      away_players: awayPlayers,
      play_by_play: playByPlay,
      
      _sources: ['basketball-reference'],
      _data_quality: this.calculateQualityScore(homeBoxScore, awayBoxScore, homePlayers, awayPlayers),
      _fetched_at: new Date(),
    };
  }

  /**
   * Extract team names
   */
  private extractTeams($: cheerio.CheerioAPI): { home: string; away: string } {
    const homeTeam = $('#content .scorebox strong a').eq(1).text().trim();
    const awayTeam = $('#content .scorebox strong a').eq(0).text().trim();
    
    // Fallback if links not found
    if (!homeTeam || !awayTeam) {
      const teamLinks = $('#content .scorebox strong a');
      return {
        away: teamLinks.eq(0).text().trim(),
        home: teamLinks.eq(1).text().trim(),
      };
    }
    
    return { home: homeTeam, away: awayTeam };
  }

  /**
   * Extract final scores
   */
  private extractScores($: cheerio.CheerioAPI): { home: number; away: number } {
    const scores: number[] = [];
    
    $('#content .scorebox .scores .score').each((_, elem) => {
      const scoreText = $(elem).text().trim();
      const score = parseInt(scoreText, 10);
      if (!isNaN(score)) {
        scores.push(score);
      }
    });
    
    if (scores.length >= 2) {
      return { away: scores[0], home: scores[1] };
    }
    
    // Fallback
    const scoreDivs = $('#content .scorebox .scores > div');
    return {
      away: parseInt(scoreDivs.eq(0).text().trim(), 10) || 0,
      home: parseInt(scoreDivs.eq(1).text().trim(), 10) || 0,
    };
  }

  /**
   * Extract team box score
   */
  private extractTeamBoxScore($: cheerio.CheerioAPI, teamName: string): TeamBoxScore {
    // Find the table for this team
    let teamTable: cheerio.Cheerio<AnyNode> | null = null;
    
    $('table.stats_table').each((_, table) => {
      const caption = $(table).find('caption').text().trim();
      if (caption.includes(teamName)) {
        teamTable = $(table);
        return false;
      }
    });
    
    if (!teamTable) {
      throw new Error(`Box score table not found for ${teamName}`);
    }
    
    // Get totals row (usually last row before the footer)
    const totalsRow = teamTable.find('tbody tr.totals, tbody tr:last-child');
    
    const getStat = (stat: string): number => {
      const cell = totalsRow.find(`td[data-stat="${stat}"]`);
      const val = parseFloat(cell.text().trim());
      return isNaN(val) ? 0 : val;
    };
    
    // Four Factors from advanced table
    const fourFactors = this.extractFourFactors($, teamName);
    
    return {
      team: teamName,
      mp: getStat('mp'),
      fg: getStat('fg'),
      fga: getStat('fga'),
      fg_pct: getStat('fg_pct'),
      tp: getStat('fg3'),
      tpa: getStat('fg3a'),
      tp_pct: getStat('fg3_pct'),
      ft: getStat('ft'),
      fta: getStat('fta'),
      ft_pct: getStat('ft_pct'),
      orb: getStat('orb'),
      drb: getStat('drb'),
      trb: getStat('trb'),
      ast: getStat('ast'),
      stl: getStat('stl'),
      blk: getStat('blk'),
      tov: getStat('tov'),
      pf: getStat('pf'),
      pts: getStat('pts'),
      plus_minus: getStat('plus_minus'),
      four_factors: fourFactors,
    };
  }

  /**
   * Extract Four Factors
   */
  private extractFourFactors($: cheerio.CheerioAPI, teamName: string): FourFactors {
    try {
      const advancedTable = $('#div_four_factors table');
      let teamRow: cheerio.Cheerio<AnyNode> | null = null;
      
      advancedTable.find('tbody tr').each((_, row) => {
        const teamCell = $(row).find('td:first-child');
        if (teamCell.text().trim() === teamName) {
          teamRow = $(row);
          return false;
        }
      });
      
      if (teamRow) {
        const getStat = (stat: string): number => {
          const val = parseFloat(teamRow!.find(`td[data-stat="${stat}"]`).text().trim());
          return isNaN(val) ? 0 : val;
        };
        
        return {
          efg_pct: getStat('efg_pct'),
          tov_pct: getStat('tov_pct'),
          orb_pct: getStat('orb_pct'),
          ft_rate: getStat('ft_rate'),
        };
      }
    } catch {
      console.warn('Could not extract Four Factors');
    }
    
    return { efg_pct: 0, tov_pct: 0, orb_pct: 0, ft_rate: 0 };
  }

  /**
   * Extract player stats
   */
  private extractPlayerStats($: cheerio.CheerioAPI, teamName: string): PlayerStats[] {
    const players: PlayerStats[] = [];
    
    $('table.stats_table').each((_, table) => {
      const caption = $(table).find('caption').text().trim();
      if (caption.includes(teamName) && caption.includes('Basic')) {
        $(table).find('tbody tr').each((_, row) => {
          const $row = $(row);
          
          // Skip totals row
          if ($row.hasClass('totals') || $row.hasClass('thead')) {
            return;
          }
          
          const playerCell = $row.find('th[data-stat="player"] a, td[data-stat="player"] a');
          const playerName = playerCell.text().trim();
          
          if (!playerName) return;
          
          const getStat = (stat: string): number => {
            const cell = $row.find(`td[data-stat="${stat}"]`);
            const text = cell.text().trim();
            
            // Handle "Did Not Play" etc.
            if (text === '' || text === 'Did Not Play' || text === 'Not With Team') {
              return 0;
            }
            
            const val = parseFloat(text);
            return isNaN(val) ? 0 : val;
          };
          
          players.push({
            player_id: playerCell.attr('href')?.split('/')?.pop()?.replace('.html', '') || playerName,
            player_name: playerName,
            team: teamName,
            is_starter: !$row.find('td').first().text().includes('Reserves'),
            
            mp: getStat('mp'),
            fg: getStat('fg'),
            fga: getStat('fga'),
            fg_pct: getStat('fg_pct'),
            tp: getStat('fg3'),
            tpa: getStat('fg3a'),
            tp_pct: getStat('fg3_pct'),
            ft: getStat('ft'),
            fta: getStat('fta'),
            ft_pct: getStat('ft_pct'),
            orb: getStat('orb'),
            drb: getStat('drb'),
            trb: getStat('trb'),
            ast: getStat('ast'),
            stl: getStat('stl'),
            blk: getStat('blk'),
            tov: getStat('tov'),
            pf: getStat('pf'),
            pts: getStat('pts'),
            plus_minus: getStat('plus_minus'),
          });
        });
      }
    });
    
    return players;
  }

  /**
   * Extract play-by-play
   */
  private extractPlayByPlay($: cheerio.CheerioAPI): PlayEvent[] {
    const events: PlayEvent[] = [];
    
    $('#pbp tbody tr').each((_, row) => {
      const $row = $(row);
      
      // Skip header rows
      if ($row.hasClass('thead')) {
        return;
      }
      
      const timeCell = $row.find('td').first();
      const time = timeCell.text().trim();
      
      const playCells = $row.find('td');
      if (playCells.length >= 2) {
        const playDesc = playCells.eq(1).text().trim();
        
        if (playDesc && time) {
          events.push({
            event_id: events.length + 1,
            period: this.extractPeriod(time),
            time_remaining: time,
            description: playDesc,
            action: this.classifyAction(playDesc),
          });
        }
      }
    });
    
    return events;
  }

  /**
   * Classify action type from description
   */
  private classifyAction(description: string): string {
    const lower = description.toLowerCase();
    
    if (lower.includes('makes') && lower.includes('shot')) return 'SHOT';
    if (lower.includes('misses')) return 'SHOT';
    if (lower.includes('rebound')) return 'REBOUND';
    if (lower.includes('assist')) return 'ASSIST';
    if (lower.includes('turnover')) return 'TURNOVER';
    if (lower.includes('foul')) return 'FOUL';
    if (lower.includes('enters')) return 'SUB';
    if (lower.includes('timeout')) return 'TIMEOUT';
    if (lower.includes('jump ball')) return 'JUMP_BALL';
    
    return 'OTHER';
  }

  /**
   * Extract period from time string
   */
  private extractPeriod(timeStr: string): number {
    void timeStr;
    // Time format: "12:00" for quarters, "5:00" for OT
    // This is simplified - you'd need more logic for full parsing
    return 1;
  }

  /**
   * Apply rate limiting with jitter to avoid detection
   */
  private async applyRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    
    // Base delay + random jitter (1-3s)
    const jitter = Math.floor(Math.random() * 2000) + 1000;
    const delay = this.config.rateLimitMs + jitter;
    
    if (elapsed < delay) {
      await new Promise(resolve => setTimeout(resolve, delay - elapsed));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Fetch with retry logic and backoff
   */
  private async fetchWithRetry(url: string, retries = 0): Promise<string> {
    try {
      const response: AxiosResponse<string> = await axios.get(url, {
        headers: {
          'User-Agent': this.config.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 30000,
      });
      
      return response.data;
    } catch (error: unknown) {
      // If rate limited (429), wait longer
      const responseStatus = (error as { response?: { status?: number } })?.response?.status;
      if (responseStatus === 429) {
        const delay = Math.pow(3, retries) * 5000 + Math.random() * 5000; // 5s, 15s, 45s...
        console.log(`    ⚠️  Rate limited (429). Waiting ${Math.round(delay/1000)}s before retry ${retries + 1}/${this.config.maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        if (retries < this.config.maxRetries) {
          return this.fetchWithRetry(url, retries + 1);
        }
      }
      
      // Other errors: exponential backoff
      if (retries < this.config.maxRetries) {
        const delay = Math.pow(2, retries) * 2000;
        console.log(`    Retry ${retries + 1}/${this.config.maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, retries + 1);
      }
      throw error;
    }
  }

  /**
   * Parse date string
   */
  private parseDate(dateStr: string): Date {
    // Format: "Tue, Oct 24, 2023"
    const parts = dateStr.split(',');
    if (parts.length >= 2) {
      return new Date(parts.slice(1).join(',').trim());
    }
    return new Date(dateStr);
  }

  /**
   * Extract season from game_id
   */
  private extractSeason(gameId: string): number {
    // Game ID format: 202403010LAL -> 2024
    const year = parseInt(gameId.substring(0, 4), 10);
    return year;
  }

  /**
   * Calculate data quality score
   */
  private calculateQualityScore(
    homeBox: TeamBoxScore,
    awayBox: TeamBoxScore,
    homePlayers: PlayerStats[],
    awayPlayers: PlayerStats[]
  ): number {
    let score = 100;
    
    // Check if box scores are complete
    if (homeBox.pts === 0 || awayBox.pts === 0) score -= 30;
    if (homeBox.fg === 0 || awayBox.fg === 0) score -= 20;
    
    // Check player stats
    if (homePlayers.length < 5 || awayPlayers.length < 5) score -= 20;
    
    // Four factors
    if (homeBox.four_factors.efg_pct === 0) score -= 10;
    if (awayBox.four_factors.efg_pct === 0) score -= 10;
    
    return Math.max(0, score);
  }

  /**
   * Save checkpoint
   */
  private saveCheckpoint(season: number, lastIndex: number, games: MasterGame[]): void {
    const checkpoint = {
      season,
      last_index: lastIndex,
      games,
      timestamp: new Date().toISOString(),
    };
    
    fs.writeFileSync(
      this.progressFile.replace('.json', `-${season}.json`),
      JSON.stringify(checkpoint, null, 2)
    );
  }

  /**
   * Load checkpoint
   */
  private loadCheckpoint(season: number): { last_index: number; games: MasterGame[] } | null {
    try {
      const path = this.progressFile.replace('.json', `-${season}.json`);
      
      if (fs.existsSync(path)) {
        const data = JSON.parse(fs.readFileSync(path, 'utf8'));
        console.log(`  🔄 Resuming from checkpoint: ${data.last_index} games already fetched`);
        return data;
      }
    } catch {
      console.warn('Could not load checkpoint');
    }
    return null;
  }

  /**
   * Log error
   */
  private logError(season: number, gameId: string, error: string): void {
    const errorLog = {
      season,
      game_id: gameId,
      error,
      timestamp: new Date().toISOString(),
    };
    
    fs.appendFileSync(
      './logs/bref-errors.log',
      JSON.stringify(errorLog) + '\n'
    );
  }
}
