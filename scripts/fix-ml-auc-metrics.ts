/**
 * Normalize persisted ML AUC metrics into [0, 1].
 *
 * Legacy training runs stored AUC using an offset formula that could exceed 1.
 * This script applies a safe correction for out-of-range values.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeLegacyAuc(value: number): number {
  if (value > 1) {
    return clamp01(value - 0.5);
  }
  return clamp01(value);
}

async function main(): Promise<void> {
  const models = await prisma.mLModel.findMany({
    where: {
      OR: [{ auc: { gt: 1 } }, { auc: { lt: 0 } }],
    },
    select: {
      id: true,
      version: true,
      auc: true,
      isActive: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  if (models.length === 0) {
    console.log('No out-of-range AUC values found.');
    return;
  }

  console.log(`Fixing ${models.length} model(s) with out-of-range AUC...`);

  let updated = 0;
  for (const model of models) {
    const corrected = normalizeLegacyAuc(model.auc);
    if (corrected === model.auc) {
      continue;
    }

    await prisma.mLModel.update({
      where: { id: model.id },
      data: { auc: corrected },
    });

    updated++;
    console.log(
      `${model.version}${model.isActive ? ' (active)' : ''}: ${model.auc.toFixed(6)} -> ${corrected.toFixed(6)}`
    );
  }

  console.log(`Done. Updated ${updated} model(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
