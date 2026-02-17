/**
 * Calibrate hybrid system thresholds on real games.
 *
 * Usage: npx tsx scripts/calibrate-hybrid-system.ts [numGames]
 */

import { PrismaClient } from '@prisma/client';
import { HybridPredictionSystem, HybridConfig } from './hybrid-prediction-system';
import { ModelFeatures } from '@/server/ml/features/types';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface TeamState {
  games: number;
  wins: number;
  pointsFor: number;
  pointsAgainst: number;
  last10: number[];
  lastDate?: Date;
}

interface EvalRow {
  features: ModelFeatures;
  pythonFeatures: Record<string, number>;
  actual: 'HOME' | 'AWAY';
}

interface CalibrationResult {
  name: string;
  config: HybridConfig;
  totalGames: number;
  accuracy: number;
  avgLatencyMs: number;
  pythonPct: number;
  tsPct: number;
  fallbackPct: number;
}

function getTeam(map: Map<string, TeamState>, team: string): TeamState {
  if (!map.has(team)) {
    map.set(team, { games: 0, wins: 0, pointsFor: 0, pointsAgainst: 0, last10: [] });
  }
  return map.get(team)!;
}

function average(values: number[], fallback: number): number {
  if (!values.length) return fallback;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function rate(v: number, total: number): number {
  return total > 0 ? v / total : 0.5;
}

function restDays(date: Date, previous?: Date): number {
  if (!previous) return 2;
  const days = Math.round((date.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.min(7, days));
}

async function buildEvalRows(limit: number): Promise<EvalRow[]> {
  const games = await prisma.$queryRaw<Array<{
    id: string;
    game_date: Date;
    season: number;
    home_team_name: string;
    away_team_name: string;
    home_score: number;
    away_score: number;
  }>>`
    SELECT id, game_date, season, home_team_name, away_team_name, home_score, away_score
    FROM games
    WHERE season = 2023
      AND home_score IS NOT NULL
      AND away_score IS NOT NULL
    ORDER BY game_date ASC
    LIMIT ${limit}
  `;

  const rows: EvalRow[] = [];
  const states = new Map<string, TeamState>();

  for (const g of games) {
    const home = getTeam(states, g.home_team_name);
    const away = getTeam(states, g.away_team_name);

    const homeWinRate = rate(home.wins, home.games);
    const awayWinRate = rate(away.wins, away.games);
    const homeForm = average(home.last10, 0.5);
    const awayForm = average(away.last10, 0.5);
    const homeOff = home.games ? home.pointsFor / home.games : 110;
    const homeDef = home.games ? home.pointsAgainst / home.games : 110;
    const awayOff = away.games ? away.pointsFor / away.games : 110;
    const awayDef = away.games ? away.pointsAgainst / away.games : 110;

    const homeRest = restDays(g.game_date, home.lastDate);
    const awayRest = restDays(g.game_date, away.lastDate);
    const daysRestDiff = homeRest - awayRest;

    const eloDiff = (homeWinRate - awayWinRate) * 400;
    const mlHomeProb = Math.max(0.05, Math.min(0.95, 0.5 + (homeWinRate - awayWinRate) * 0.6));

    rows.push({
      features: {
        homeWinRate,
        homeOffensiveRating: homeOff,
        homeDefensiveRating: homeDef,
        homeForm,
        homeRestAdvantage: daysRestDiff,
        awayWinRate,
        awayOffensiveRating: awayOff,
        awayDefensiveRating: awayDef,
        awayForm,
        homeAdvantage: 1,
        h2hAdvantage: 0,
        matchupStrength: (homeWinRate + awayWinRate) / 2,
        isBackToBack: homeRest <= 1 || awayRest <= 1 ? 1 : 0,
        daysRestDiff,
        isPlayoff: 0
      },
      pythonFeatures: {
        elo_diff: eloDiff,
        elo_diff_norm: (eloDiff + 400) / 800,
        home_last10_wins: homeForm,
        away_last10_wins: awayForm,
        spread_num: -2.5,
        over_under: 223,
        ml_home_prob: mlHomeProb,
        ml_away_prob: 1 - mlHomeProb,
        rest_days_home: homeRest,
        rest_days_away: awayRest,
        season_norm: (g.season - 2010) / 15
      },
      actual: g.home_score > g.away_score ? 'HOME' : 'AWAY'
    });

    const homeWon = g.home_score > g.away_score;
    home.games += 1;
    away.games += 1;
    home.pointsFor += g.home_score;
    home.pointsAgainst += g.away_score;
    away.pointsFor += g.away_score;
    away.pointsAgainst += g.home_score;
    if (homeWon) home.wins += 1;
    else away.wins += 1;
    home.last10.push(homeWon ? 1 : 0);
    away.last10.push(homeWon ? 0 : 1);
    if (home.last10.length > 10) home.last10.shift();
    if (away.last10.length > 10) away.last10.shift();
    home.lastDate = g.game_date;
    away.lastDate = g.game_date;
  }

  return rows;
}

async function evaluateConfig(name: string, config: HybridConfig, rows: EvalRow[]): Promise<CalibrationResult> {
  const hybrid = new HybridPredictionSystem(config);
  await hybrid.initialize();

  let correct = 0;
  let totalLatency = 0;
  let tsCount = 0;
  let pyCount = 0;
  let fallbackCount = 0;

  for (const row of rows) {
    const result = await hybrid.predict(row.features, row.pythonFeatures);
    if (result.predictedWinner === row.actual) correct += 1;
    totalLatency += result.latency;
    if (result.modelUsed === 'TypeScript') tsCount += 1;
    else if (result.modelUsed === 'Python') pyCount += 1;
    else fallbackCount += 1;
  }

  const total = rows.length;
  return {
    name,
    config,
    totalGames: total,
    accuracy: correct / total,
    avgLatencyMs: totalLatency / total,
    pythonPct: (pyCount / total) * 100,
    tsPct: (tsCount / total) * 100,
    fallbackPct: (fallbackCount / total) * 100
  };
}

async function main() {
  const n = Number(process.argv[2] || '200');
  const sampleSize = Number.isFinite(n) && n > 100 ? Math.floor(n) : 200;
  const rows = await buildEvalRows(sampleSize);

  const configs: Array<{ name: string; config: HybridConfig }> = [
    {
      name: 'Config 1',
      config: {
        pythonThreshold: 0.70,
        pythonMinConfidence: 0.60,
        fallbackToTypescript: true,
        pythonBaseUrl: 'http://localhost:8000'
      }
    },
    {
      name: 'Config 2',
      config: {
        pythonThreshold: 0.75,
        pythonMinConfidence: 0.65,
        fallbackToTypescript: true,
        pythonBaseUrl: 'http://localhost:8000'
      }
    },
    {
      name: 'Config 3',
      config: {
        pythonThreshold: 0.80,
        pythonMinConfidence: 0.70,
        fallbackToTypescript: true,
        pythonBaseUrl: 'http://localhost:8000'
      }
    }
  ];

  const results: CalibrationResult[] = [];
  for (const entry of configs) {
    console.log(`Evaluating ${entry.name}...`);
    const result = await evaluateConfig(entry.name, entry.config, rows);
    results.push(result);
    console.log(`  Accuracy ${(result.accuracy * 100).toFixed(2)}% | Avg ${result.avgLatencyMs.toFixed(2)}ms | Python ${result.pythonPct.toFixed(1)}%`);
  }

  const scored = results.map(r => ({
    ...r,
    score: (r.accuracy * 100) - (r.avgLatencyMs * 0.05)
  }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  const jsonPath = path.join(process.cwd(), 'hybrid-calibration-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    sampleSize: rows.length,
    results: scored,
    optimal: best
  }, null, 2));

  const mdPath = path.join(process.cwd(), 'HYBRID_CALIBRATION_REPORT.md');
  const md = [
    '# Hybrid Calibration Report',
    '',
    `- Date: ${new Date().toISOString()}`,
    `- Games: ${rows.length}`,
    '',
    '## Config Results',
    '',
    '| Config | Accuracy | Avg Latency | Python % | TypeScript % | Fallback % | Score |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...scored.map(r => `| ${r.name} | ${(r.accuracy * 100).toFixed(2)}% | ${r.avgLatencyMs.toFixed(2)} ms | ${r.pythonPct.toFixed(2)}% | ${r.tsPct.toFixed(2)}% | ${r.fallbackPct.toFixed(2)}% | ${r.score.toFixed(2)} |`),
    '',
    '## Optimal Configuration',
    '',
    `- Winner: **${best.name}**`,
    `- pythonThreshold: ${best.config.pythonThreshold}`,
    `- pythonMinConfidence: ${best.config.pythonMinConfidence}`,
    `- fallbackToTypescript: ${best.config.fallbackToTypescript}`,
    `- Accuracy: ${(best.accuracy * 100).toFixed(2)}%`,
    `- Avg latency: ${best.avgLatencyMs.toFixed(2)} ms`
  ].join('\n');
  fs.writeFileSync(mdPath, md);

  console.log(`Saved: ${jsonPath}`);
  console.log(`Saved: ${mdPath}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Calibration failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
