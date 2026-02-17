/**
 * Train TypeScript XGBoost Model on real games
 *
 * Usage:
 *   npx tsx scripts/train-xgboost-ts.ts
 *   npx tsx scripts/train-xgboost-ts.ts 969
 */

import { PrismaClient } from '@prisma/client';
import { XGBoostModel } from '@/server/ml/models/xgboost-model';
import { ModelFeatures } from '@/server/ml/features/types';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface RawGame {
  game_id: string;
  game_date: Date;
  season: number;
  home_team_name: string;
  away_team_name: string;
  home_score: number;
  away_score: number;
}

interface TeamState {
  games: number;
  wins: number;
  pointsFor: number;
  pointsAgainst: number;
  last10: number[];
  lastGameDate?: Date;
}

interface TrainingExample {
  gameId: string;
  features: ModelFeatures;
  label: number;
}

function getOrInit(state: Map<string, TeamState>, team: string): TeamState {
  if (!state.has(team)) {
    state.set(team, {
      games: 0,
      wins: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      last10: []
    });
  }
  return state.get(team)!;
}

function avg(values: number[], fallback: number): number {
  if (!values.length) return fallback;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function safeRate(value: number, total: number, fallback = 0.5): number {
  return total > 0 ? value / total : fallback;
}

function daysBetween(current: Date, previous?: Date): number {
  if (!previous) return 2;
  const ms = current.getTime() - previous.getTime();
  const days = Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
  return Math.min(days, 7);
}

async function buildExamples(limit: number): Promise<TrainingExample[]> {
  const games = await prisma.$queryRaw<RawGame[]>`
    SELECT
      g.id as game_id,
      g.game_date,
      g.season,
      g.home_team_name,
      g.away_team_name,
      g.home_score,
      g.away_score
    FROM games g
    WHERE g.season = 2023
      AND g.home_score IS NOT NULL
      AND g.away_score IS NOT NULL
    ORDER BY g.game_date ASC
    LIMIT ${limit}
  `;

  const teamState = new Map<string, TeamState>();
  const examples: TrainingExample[] = [];

  for (const game of games) {
    const home = getOrInit(teamState, game.home_team_name);
    const away = getOrInit(teamState, game.away_team_name);

    const homeWinRate = safeRate(home.wins, home.games);
    const awayWinRate = safeRate(away.wins, away.games);
    const homeForm = avg(home.last10, 0.5);
    const awayForm = avg(away.last10, 0.5);

    const homeOff = home.games > 0 ? home.pointsFor / home.games : 110;
    const homeDef = home.games > 0 ? home.pointsAgainst / home.games : 110;
    const awayOff = away.games > 0 ? away.pointsFor / away.games : 110;
    const awayDef = away.games > 0 ? away.pointsAgainst / away.games : 110;

    const homeRestDays = daysBetween(game.game_date, home.lastGameDate);
    const awayRestDays = daysBetween(game.game_date, away.lastGameDate);
    const restDiff = homeRestDays - awayRestDays;

    const features: ModelFeatures = {
      homeWinRate,
      homeOffensiveRating: homeOff,
      homeDefensiveRating: homeDef,
      homeForm,
      homeRestAdvantage: restDiff,
      awayWinRate,
      awayOffensiveRating: awayOff,
      awayDefensiveRating: awayDef,
      awayForm,
      homeAdvantage: 1,
      h2hAdvantage: 0,
      matchupStrength: (homeWinRate + awayWinRate) / 2,
      isBackToBack: homeRestDays <= 1 || awayRestDays <= 1 ? 1 : 0,
      daysRestDiff: restDiff,
      isPlayoff: 0
    };

    const homeWon = game.home_score > game.away_score ? 1 : 0;

    examples.push({
      gameId: game.game_id,
      features,
      label: homeWon
    });

    // Update team states AFTER feature creation (no leakage)
    home.games += 1;
    away.games += 1;
    home.pointsFor += game.home_score;
    home.pointsAgainst += game.away_score;
    away.pointsFor += game.away_score;
    away.pointsAgainst += game.home_score;

    if (homeWon === 1) home.wins += 1;
    else away.wins += 1;

    home.last10.push(homeWon === 1 ? 1 : 0);
    away.last10.push(homeWon === 0 ? 1 : 0);
    if (home.last10.length > 10) home.last10.shift();
    if (away.last10.length > 10) away.last10.shift();

    home.lastGameDate = game.game_date;
    away.lastGameDate = game.game_date;
  }

  return examples;
}

async function main() {
  const sampleArg = Number(process.argv[2] || '969');
  const sampleSize = Number.isFinite(sampleArg) && sampleArg > 100 ? Math.floor(sampleArg) : 969;

  console.log('='.repeat(70));
  console.log('TRAINING TYPESCRIPT XGBOOST ON REAL DATA');
  console.log('='.repeat(70));
  console.log(`Requested sample size: ${sampleSize}`);
  console.log();

  const examples = await buildExamples(sampleSize);
  if (examples.length < 100) {
    throw new Error(`Not enough examples (${examples.length}) to train XGBoost`);
  }

  console.log(`Loaded ${examples.length} games with engineered features`);

  // Time-based split for realistic validation
  const splitIndex = Math.floor(examples.length * 0.8);
  const trainData = examples.slice(0, splitIndex);
  const testData = examples.slice(splitIndex);

  console.log(`Training: ${trainData.length}`);
  console.log(`Testing: ${testData.length}`);
  console.log();

  const model = new XGBoostModel({
    nEstimators: 100,
    maxDepth: 4,
    learningRate: 0.1,
    subsample: 0.8,
    colsampleByTree: 0.8
  });

  const trainStart = Date.now();
  const trainResult = model.train(
    trainData.map(d => ({ features: d.features, label: d.label })),
    testData.map(d => ({ features: d.features, label: d.label }))
  );
  const trainMs = Date.now() - trainStart;

  let correct = 0;
  const preds: number[] = [];
  const actuals: number[] = [];

  for (const row of testData) {
    const pred = model.predict(row.features).predictedWinner === 'HOME' ? 1 : 0;
    preds.push(pred);
    actuals.push(row.label);
    if (pred === row.label) correct += 1;
  }

  const accuracy = correct / testData.length;
  const tp = preds.filter((p, i) => p === 1 && actuals[i] === 1).length;
  const fp = preds.filter((p, i) => p === 1 && actuals[i] === 0).length;
  const fn = preds.filter((p, i) => p === 0 && actuals[i] === 1).length;
  const precision = tp / (tp + fp) || 0;
  const recall = tp / (tp + fn) || 0;
  const f1 = (2 * precision * recall) / (precision + recall) || 0;

  console.log('='.repeat(70));
  console.log('XGBOOST TEST METRICS');
  console.log('='.repeat(70));
  console.log(`Accuracy:  ${(accuracy * 100).toFixed(2)}%`);
  console.log(`Precision: ${(precision * 100).toFixed(2)}%`);
  console.log(`Recall:    ${(recall * 100).toFixed(2)}%`);
  console.log(`F1 Score:  ${(f1 * 100).toFixed(2)}%`);
  console.log(`Train time: ${trainMs}ms`);
  console.log(`Iterations: ${trainResult.iterations}`);
  console.log();

  const version = `xgboost-ts-${Date.now()}`;
  const created = await prisma.mLModel.create({
    data: {
      version,
      algorithm: 'xgboost',
      trainingDataStart: new Date('2023-01-01'),
      trainingDataEnd: new Date('2023-12-31'),
      numTrainingSamples: trainData.length,
      numTestSamples: testData.length,
      accuracy,
      precision,
      recall,
      f1Score: f1,
      logLoss: trainResult.valLosses[trainResult.valLosses.length - 1] || trainResult.trainLosses[trainResult.trainLosses.length - 1] || 0,
      auc: 0.0,
      calibrationError: 0.0,
      weightsHash: `xgb-${Date.now()}`,
      isActive: false,
      weights: model.getState() as any,
      description: `TypeScript XGBoost trained on ${examples.length} real 2023 games`
    }
  });

  let activated = false;
  if (accuracy > 0.55) {
    await prisma.mLModel.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });
    await prisma.mLModel.update({
      where: { id: created.id },
      data: { isActive: true, activatedAt: new Date() }
    });
    activated = true;
  }

  const metricsPath = path.join(process.cwd(), 'xgboost-training-metrics.json');
  fs.writeFileSync(metricsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    modelId: created.id,
    version,
    sampleSize: examples.length,
    metrics: {
      accuracy,
      precision,
      recall,
      f1
    },
    train: {
      durationMs: trainMs,
      iterations: trainResult.iterations,
      bestIteration: trainResult.bestIteration
    },
    activated
  }, null, 2));

  console.log(`Model saved: ${version} (${created.id})`);
  console.log(`Activated: ${activated ? 'YES' : 'NO'} (threshold > 55%)`);
  console.log(`Metrics file: ${metricsPath}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Error:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
