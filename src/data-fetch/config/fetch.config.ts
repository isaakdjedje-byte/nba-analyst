/**
 * NBA Deep Data Fetcher Configuration
 * Multi-source: Basketball-Reference + NBA API + ESPN
 */

export interface FetchConfig {
  sources: {
    basketballReference: {
      enabled: boolean;
      baseUrl: string;
      rateLimitMs: number;
      maxRetries: number;
      userAgent: string;
      endpoints: {
        schedule: string;
        boxscore: string;
        playbyplay: string;
        advanced: string;
      };
    };
    nbaAPI: {
      enabled: boolean;
      pythonScript: string;
      rateLimitMs: number;
      maxRetries: number;
    };
    espn: {
      enabled: boolean;
      baseUrl: string;
      useAs: 'primary' | 'backup';
    };
  };
  seasons: number[];
  storage: {
    postgres: {
      enabled: boolean;
    };
    duckdb: {
      enabled: boolean;
      path: string;
    };
  };
  checkpoint: {
    enabled: boolean;
    interval: number;
    progressFile: string;
  };
  features: {
    enabled: boolean;
    generateELO: boolean;
    generateRolling: boolean;
    generateRest: boolean;
    generateFourFactors: boolean;
    generateTracking: boolean;
  };
}

export const defaultConfig: FetchConfig = {
  sources: {
    basketballReference: {
      enabled: true,
      baseUrl: 'https://www.basketball-reference.com',
      rateLimitMs: 6000,  // 6 secondes minimum pour éviter 429
      maxRetries: 5,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      endpoints: {
        schedule: '/leagues/NBA_{season}_games.html',
        boxscore: '/boxscores/{game_id}.html',
        playbyplay: '/boxscores/pbp/{game_id}.html',
        advanced: '/boxscores/shot-chart/{game_id}.html',
      },
    },
    nbaAPI: {
      enabled: true,
      pythonScript: './scripts/nba-api/nba_api_fetcher.py',
      rateLimitMs: 6000,
      maxRetries: 3,
    },
    espn: {
      enabled: true,
      baseUrl: 'https://site.api.espn.com',
      useAs: 'backup',
    },
  },
  seasons: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024],
  storage: {
    postgres: {
      enabled: true,
    },
    duckdb: {
      enabled: true,
      path: './nba-data/analytics.duckdb',
    },
  },
  checkpoint: {
    enabled: true,
    interval: 10,
    progressFile: './logs/fetch-progress.json',
  },
  features: {
    enabled: true,
    generateELO: true,
    generateRolling: true,
    generateRest: true,
    generateFourFactors: true,
    generateTracking: true,
  },
};

export function loadConfig(): FetchConfig {
  try {
    if (fs.existsSync('./config/fetch.config.json')) {
      const custom = JSON.parse(fs.readFileSync('./config/fetch.config.json', 'utf8'));
      return { ...defaultConfig, ...custom };
    }
  } catch {
    console.warn('Could not load custom config, using default');
  }
  return defaultConfig;
}
import * as fs from 'fs';
