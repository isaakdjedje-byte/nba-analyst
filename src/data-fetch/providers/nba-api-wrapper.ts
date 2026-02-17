/**
 * NBA API Wrapper
 * Wraps Python nba_api script via child_process
 */

import { spawn } from 'child_process';
import { loadConfig } from '../config/fetch.config';

interface NBAAPIResponse {
  game_id: string;
  boxscore_traditional: Record<string, unknown>;
  boxscore_advanced: Record<string, unknown>;
  player_tracking: Record<string, unknown>;
  shot_charts: { Shot_Chart_Detail?: unknown[] };
  play_by_play: { PlayByPlay?: unknown[] };
  hustle_stats?: Record<string, unknown>;
  matchups?: Record<string, unknown>;
  errors: string[];
}

export class NBAAPIWrapper {
  private config = loadConfig().sources.nbaAPI;

  constructor() {
    if (!this.config.enabled) {
      throw new Error('NBA API provider is disabled');
    }
  }

  /**
   * Fetch game data from NBA API
   */
  async fetchGame(gameId: string): Promise<NBAAPIResponse | null> {
    console.log(`  🏀 Fetching NBA API data for ${gameId}...`);
    
    try {
      const result = await this.runPythonScript<NBAAPIResponse>(['--game-id', gameId]);
      
      if (result.errors && result.errors.length > 0) {
        console.warn(`    ⚠️  API errors: ${result.errors.join(', ')}`);
      }
      
      console.log(`    ✓ Fetched: ${this.summarizeData(result)}`);
      return result;
      
    } catch (error) {
      console.error(`    ❌ NBA API fetch failed: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Fetch all games for a season
   */
  async fetchSeason(season: string): Promise<NBAAPIResponse[]> {
    console.log(`\n🏀 Fetching NBA API season ${season}...`);
    
    try {
      const result = await this.runPythonScript<NBAAPIResponse[] | NBAAPIResponse>(['--season', season]);
      
      if (Array.isArray(result)) {
        console.log(`  ✓ Fetched ${result.length} games`);
        return result;
      }
      
      return [];
      
    } catch (error) {
      console.error(`  ❌ NBA API season fetch failed: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Run Python script and parse JSON output
   */
  private runPythonScript<T = NBAAPIResponse | NBAAPIResponse[]>(args: string[]): Promise<T> {
    return new Promise((resolve, reject) => {
      const pythonScript = this.config.pythonScript;
      const fullArgs = [pythonScript, ...args];
      
      console.log(`    Running: python ${fullArgs.join(' ')}`);
      
      const pythonProcess = spawn('python', fullArgs, {
        cwd: process.cwd(),
      });
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        // Log progress messages from Python
        const lines = data.toString().trim().split('\n');
        lines.forEach((line: string) => {
          if (line.includes('✓') || line.includes('✗') || line.includes('⚠')) {
            console.log(`    ${line}`);
          }
        });
      });
      
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Python script exited with code ${code}: ${stderr}`));
          return;
        }
        
        try {
          const result = JSON.parse(stdout) as T;
          resolve(result);
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${e}`));
        }
      });
      
      pythonProcess.on('error', (error) => {
        reject(new Error(`Failed to start Python: ${error.message}`));
      });
    });
  }

  /**
   * Summarize fetched data
   */
  private summarizeData(data: NBAAPIResponse): string {
    const parts: string[] = [];
    
    if (data.boxscore_traditional) parts.push('boxscore');
    if (data.player_tracking) parts.push('tracking');
    if (data.shot_charts?.Shot_Chart_Detail) {
      parts.push(`${data.shot_charts.Shot_Chart_Detail.length} shots`);
    }
    if (data.play_by_play?.PlayByPlay) {
      parts.push(`${data.play_by_play.PlayByPlay.length} events`);
    }
    if (data.hustle_stats) parts.push('hustle');
    if (data.matchups) parts.push('matchups');
    
    return parts.join(', ') || 'no data';
  }
}
