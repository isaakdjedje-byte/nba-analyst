/**
 * Seed Predictions From Real Model Outputs
 *
 * Creates predictions for completed games by invoking the active ML model.
 * No synthetic confidence or outcomes are generated.
 */

import { PrismaClient, PredictionStatus, RunStatus } from '@prisma/client';
import { getPredictionService } from '../src/server/ml/prediction/prediction-service';

const prisma = new PrismaClient();

async function loadNbaTeamIdSet(minAppearances: number = 100): Promise<Set<number>> {
  const completedGames = await prisma.game.findMany({
    where: { status: 'completed' },
    select: {
      homeTeamId: true,
      awayTeamId: true,
    },
  });

  const teamAppearanceCounts = new Map<number, number>();
  for (const game of completedGames) {
    teamAppearanceCounts.set(game.homeTeamId, (teamAppearanceCounts.get(game.homeTeamId) ?? 0) + 1);
    teamAppearanceCounts.set(game.awayTeamId, (teamAppearanceCounts.get(game.awayTeamId) ?? 0) + 1);
  }

  const nbaTeamIds = new Set<number>();
  for (const [teamId, appearances] of teamAppearanceCounts.entries()) {
    if (appearances >= minAppearances) {
      nbaTeamIds.add(teamId);
    }
  }

  return nbaTeamIds;
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>;
    const code = typeof record.code === 'string' ? record.code : null;
    const message = typeof record.message === 'string' ? record.message : null;

    if (code && message) {
      return `${code}: ${message}`;
    }

    if (message) {
      return message;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return '[unserializable error object]';
    }
  }

  return String(error);
}

function parseLimitArg(): number {
  const idx = process.argv.indexOf('--limit');
  if (idx !== -1 && process.argv[idx + 1]) {
    const parsed = Number.parseInt(process.argv[idx + 1], 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 200;
}

async function resolveUserId(): Promise<string> {
  const preferredEmail = process.env.PREDICTION_USER_EMAIL;
  if (preferredEmail) {
    const user = await prisma.user.findUnique({ where: { email: preferredEmail } });
    if (user) return user.id;
  }

  const fallbackUser = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });

  if (!fallbackUser) {
    throw new Error('No user found. Create a real user account before seeding predictions.');
  }

  return fallbackUser.id;
}

async function ensureDailyRun(runDate: Date): Promise<string> {
  const normalized = new Date(runDate);
  normalized.setHours(0, 0, 0, 0);

  const run = await prisma.dailyRun.upsert({
    where: { runDate: normalized },
    update: {},
    create: {
      runDate: normalized,
      status: RunStatus.COMPLETED,
      triggeredBy: 'manual',
      traceId: `historical-${normalized.toISOString().slice(0, 10)}`,
      totalMatches: 0,
      predictionsCount: 0,
      picksCount: 0,
      noBetCount: 0,
      hardStopCount: 0,
      completedAt: new Date(),
    },
    select: { id: true },
  });

  return run.id;
}

async function seedPredictions(): Promise<void> {
  const limit = parseLimitArg();
  console.log(`Generating real-model predictions (limit=${limit})...`);

  const userId = await resolveUserId();
  const predictionService = getPredictionService();
  const nbaTeamIds = await loadNbaTeamIdSet();
  console.log(`Resolved NBA team IDs: ${nbaTeamIds.size}`);

  const games = await prisma.game.findMany({
    where: {
      status: 'completed',
      boxScore: { isNot: null },
    },
    orderBy: { gameDate: 'asc' },
    take: limit,
  });

  if (games.length === 0) {
    console.log('No eligible completed games without predictions found.');
    return;
  }

  let created = 0;
  let skipped = 0;
  const skipBreakdown: Record<'already_exists' | 'ineligible_non_nba' | 'error', number> = {
    already_exists: 0,
    ineligible_non_nba: 0,
    error: 0,
  };
  const errorBreakdown = new Map<string, number>();

  const gameMatchIds = games.map((game) => game.externalId.toString());
  const existingPredictions = await prisma.prediction.findMany({
    where: { matchId: { in: gameMatchIds } },
    select: { matchId: true },
  });
  const existingMatchIds = new Set(existingPredictions.map((prediction) => prediction.matchId));

  for (const game of games) {
    try {
      if (existingMatchIds.has(game.externalId.toString())) {
        skipped++;
        skipBreakdown.already_exists++;
        continue;
      }

      if (!nbaTeamIds.has(game.homeTeamId) || !nbaTeamIds.has(game.awayTeamId)) {
        skipped++;
        skipBreakdown.ineligible_non_nba++;
        continue;
      }

      const runId = await ensureDailyRun(game.gameDate);
      const result = await predictionService.predict({
        gameId: game.externalId,
        homeTeamId: game.homeTeamId,
        awayTeamId: game.awayTeamId,
        homeTeamName: game.homeTeamName,
        awayTeamName: game.awayTeamName,
        scheduledAt: game.gameDate,
      });

      await prisma.prediction.create({
        data: {
          matchId: game.externalId.toString(),
          matchDate: game.gameDate,
          league: 'nba',
          homeTeam: game.homeTeamName,
          awayTeam: game.awayTeamName,
          winnerPrediction: result.prediction.winner,
          scorePrediction: `${result.score.predictedHomeScore}-${result.score.predictedAwayScore}`,
          overUnderPrediction: result.overUnder.line,
          confidence: result.prediction.confidence,
          modelVersion: result.model.version,
          featuresHash: null,
          edge: (result.prediction.confidence - 0.5) * 100,
          status: PredictionStatus.confirmed,
          userId,
          runId,
          traceId: result.traceId,
        },
      });

      created++;
      if ((created + skipped) % 20 === 0) {
        console.log(`Processed ${created + skipped}/${games.length}`);
      }
    } catch (error) {
      skipped++;
      skipBreakdown.error++;
      const formattedError = formatError(error);
      errorBreakdown.set(formattedError, (errorBreakdown.get(formattedError) ?? 0) + 1);
      console.warn(`Skipped game ${game.externalId}: ${formattedError}`);
    }
  }

  console.log('Done');
  console.log(`Created predictions: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log('Skip breakdown:');
  console.log(`  already_exists: ${skipBreakdown.already_exists}`);
  console.log(`  ineligible_non_nba: ${skipBreakdown.ineligible_non_nba}`);
  console.log(`  error: ${skipBreakdown.error}`);

  if (errorBreakdown.size > 0) {
    console.log('Error reason breakdown:');
    for (const [reason, count] of [...errorBreakdown.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count}x ${reason}`);
    }
  }
}

seedPredictions()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
