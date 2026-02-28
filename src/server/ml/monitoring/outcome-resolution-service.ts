import { PredictionStatus } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { createMonitoringService } from '@/server/ml/monitoring/monitoring-service';

export interface OutcomeResolutionResult {
  scanned: number;
  resolved: number;
  skipped: number;
  errors: number;
}

function getActualWinner(homeScore: number, awayScore: number): 'HOME' | 'AWAY' {
  return homeScore > awayScore ? 'HOME' : 'AWAY';
}

function parseExternalMatchId(matchId: string): number | null {
  const parsed = Number.parseInt(matchId, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

/**
 * Resolve historical prediction outcomes against completed games and update monitoring logs.
 */
export async function resolvePredictionOutcomes(limit: number = 500): Promise<OutcomeResolutionResult> {
  const monitoring = createMonitoringService();

  const candidates = await prisma.prediction.findMany({
    where: {
      status: { in: [PredictionStatus.pending, PredictionStatus.processed] },
      winnerPrediction: { not: null },
      matchDate: { lt: new Date() },
    },
    orderBy: { matchDate: 'asc' },
    take: limit,
    select: {
      id: true,
      matchId: true,
      winnerPrediction: true,
    },
  });

  let resolved = 0;
  let skipped = 0;
  let errors = 0;

  for (const prediction of candidates) {
    try {
      const externalId = parseExternalMatchId(prediction.matchId);
      if (!externalId) {
        skipped++;
        continue;
      }

      const game = await prisma.game.findUnique({
        where: { externalId },
        select: {
          status: true,
          homeScore: true,
          awayScore: true,
        },
      });

      if (!game || game.status !== 'completed' || game.homeScore === null || game.awayScore === null) {
        skipped++;
        continue;
      }

      if (game.homeScore === game.awayScore) {
        skipped++;
        continue;
      }

      const actualWinner = getActualWinner(game.homeScore, game.awayScore);
      await monitoring.recordOutcome(prediction.id, actualWinner, game.homeScore, game.awayScore);

      await prisma.prediction.update({
        where: { id: prediction.id },
        data: { status: PredictionStatus.confirmed },
      });

      resolved++;
    } catch (error) {
      errors++;
      console.error('[OutcomeResolution] Failed to resolve prediction outcome', {
        predictionId: prediction.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    scanned: candidates.length,
    resolved,
    skipped,
    errors,
  };
}
