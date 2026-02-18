/**
 * Backfill prediction_logs from historical predictions.
 *
 * This script is idempotent:
 * - Inserts only predictions that do not already have a prediction_log row
 * - Resolves outcomes for completed games with known scores
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Backfilling prediction_logs from predictions...');

  const inserted = await prisma.$executeRawUnsafe(`
    INSERT INTO prediction_logs (
      id,
      prediction_id,
      model_version,
      algorithm,
      features,
      predicted_probability,
      predicted_winner,
      confidence,
      latency_ms,
      created_at
    )
    SELECT
      CONCAT('log-backfill-', p.id) AS id,
      p.id AS prediction_id,
      p.model_version,
      COALESCE(m.algorithm, 'unknown') AS algorithm,
      '{}'::jsonb AS features,
      CASE
        WHEN p.winner_prediction = 'HOME' THEN p.confidence
        WHEN p.winner_prediction = 'AWAY' THEN 1 - p.confidence
        ELSE 0.5
      END AS predicted_probability,
      p.winner_prediction AS predicted_winner,
      p.confidence,
      0 AS latency_ms,
      p.created_at
    FROM predictions p
    LEFT JOIN ml_models m ON m.version = p.model_version
    WHERE p.winner_prediction IN ('HOME', 'AWAY')
      AND NOT EXISTS (
        SELECT 1
        FROM prediction_logs l
        WHERE l.prediction_id = p.id
      )
  `);

  console.log(`Inserted prediction_logs rows: ${inserted}`);

  console.log('Resolving outcomes for completed games...');
  const resolved = await prisma.$executeRawUnsafe(`
    UPDATE prediction_logs l
    SET
      actual_winner = CASE WHEN g.home_score > g.away_score THEN 'HOME' ELSE 'AWAY' END,
      home_score = g.home_score,
      away_score = g.away_score,
      resolved_at = COALESCE(l.resolved_at, NOW()),
      correct = (l.predicted_winner = CASE WHEN g.home_score > g.away_score THEN 'HOME' ELSE 'AWAY' END)
    FROM predictions p
    JOIN games g
      ON p.match_id ~ '^[0-9]+$'
     AND g.external_id = CAST(p.match_id AS INT)
    WHERE l.prediction_id = p.id
      AND g.status = 'completed'
      AND g.home_score IS NOT NULL
      AND g.away_score IS NOT NULL
      AND g.home_score <> g.away_score
      AND l.actual_winner IS NULL
  `);

  console.log(`Resolved outcome rows: ${resolved}`);

  const totals = await prisma.$queryRawUnsafe<{ logs: number; resolved: number }[]>(`
    SELECT
      COUNT(*)::int AS logs,
      COUNT(actual_winner)::int AS resolved
    FROM prediction_logs
  `);

  console.log('Done:', totals[0]);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
