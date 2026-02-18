import { prisma } from '@/server/db/client';
import { DEFAULT_POLICY_CONFIG, getPolicyConfig, updatePolicyConfig } from '@/server/policy/config';
import { createVersionSnapshot } from '@/server/policy/versioning';
import type { PolicyConfig } from '@/server/policy/types';

interface ThresholdSample {
  confidence: number;
  edge: number;
  correct: boolean;
}

export interface AdaptiveThresholdResult {
  applied: boolean;
  reason?: string;
  overrides?: Pick<PolicyConfig, 'confidence' | 'edge'>;
  sampleSize: number;
  selectedCount: number;
  precision: number;
}

export interface AdaptiveThresholdPersistenceResult {
  changed: boolean;
  reason: string;
  adaptive: AdaptiveThresholdResult;
  config?: PolicyConfig;
  snapshotVersion?: number;
}

export interface AdaptiveThresholdReport {
  current: {
    confidenceMinThreshold: number;
    edgeMinThreshold: number;
  };
  recommendation: AdaptiveThresholdResult;
  latestAppliedSnapshot: {
    id: string;
    version: number;
    createdAt: string;
    createdBy: string;
    changeReason?: string;
  } | null;
}

async function getPersistedOrRuntimePolicyConfig(): Promise<PolicyConfig> {
  const latestSnapshot = await prisma.policyVersionSnapshot.findFirst({
    orderBy: { createdAt: 'desc' },
    select: {
      configJson: true,
    },
  });

  if (latestSnapshot?.configJson) {
    return latestSnapshot.configJson as unknown as PolicyConfig;
  }

  return getPolicyConfig().getConfig();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value > 1 && value <= 100) return value / 100;
  return clamp(value, 0, 1);
}

function normalizeEdge(value: number | null): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;

  let normalized = Math.abs(value);
  if (normalized > 1) {
    normalized = normalized / 100;
  }

  return clamp(normalized, 0, 1);
}

function buildGrid(start: number, end: number, step: number): number[] {
  const values: number[] = [];
  for (let current = start; current <= end + 1e-9; current += step) {
    values.push(Number(current.toFixed(3)));
  }
  return values;
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const ratio = idx - lo;
  return sorted[lo] * (1 - ratio) + sorted[hi] * ratio;
}

export async function computeAdaptivePolicyThresholds(
  lookbackDays: number = 120
): Promise<AdaptiveThresholdResult> {
  const activeModel = await prisma.mLModel.findFirst({
    where: { isActive: true },
    select: { version: true },
    orderBy: { createdAt: 'desc' },
  });

  const queryResolvedRows = async (modelVersion?: string) => {
    if (modelVersion) {
      return prisma.$queryRaw<{
        confidence: number;
        edge: number | null;
        correct: boolean | null;
      }[]>`
        SELECT
          pl.confidence,
          p.edge,
          pl.correct
        FROM prediction_logs pl
        INNER JOIN predictions p
          ON p.id = pl.prediction_id
        WHERE pl.resolved_at IS NOT NULL
          AND pl.created_at > NOW() - (${lookbackDays} * INTERVAL '1 day')
          AND p.model_version NOT LIKE 'season-end-%'
          AND p.model_version = ${modelVersion}
      `;
    }

    return prisma.$queryRaw<{
      confidence: number;
      edge: number | null;
      correct: boolean | null;
    }[]>`
      SELECT
        pl.confidence,
        p.edge,
        pl.correct
      FROM prediction_logs pl
      INNER JOIN predictions p
        ON p.id = pl.prediction_id
      WHERE pl.resolved_at IS NOT NULL
        AND pl.created_at > NOW() - (${lookbackDays} * INTERVAL '1 day')
        AND p.model_version NOT LIKE 'season-end-%'
    `;
  };

  let resolvedRows = await queryResolvedRows(activeModel?.version);
  if (resolvedRows.length < 30) {
    resolvedRows = await queryResolvedRows();
  }

  const samples: ThresholdSample[] = resolvedRows
    .map((row) => {
      const confidence = normalizeConfidence(row.confidence);
      const edge = normalizeEdge(row.edge);
      const correct = Boolean(row.correct);

      if (edge === null) {
        return null;
      }

      return { confidence, edge, correct };
    })
    .filter((row): row is ThresholdSample => row !== null);

  if (samples.length < 30) {
    return {
      applied: false,
      reason: 'insufficient_resolved_samples',
      sampleSize: samples.length,
      selectedCount: 0,
      precision: 0,
    };
  }

  const confidenceGrid = buildGrid(0.58, 0.72, 0.01);
  const edgeGrid = buildGrid(0.02, 0.12, 0.01);

  const minSelections = Math.max(15, Math.floor(samples.length * 0.08));
  const minPrecision = 0.53;

  let best:
    | {
        confidenceMin: number;
        edgeMin: number;
        selected: number;
        precision: number;
        score: number;
      }
    | undefined;

  for (const confidenceMin of confidenceGrid) {
    for (const edgeMin of edgeGrid) {
      let selected = 0;
      let wins = 0;

      for (const sample of samples) {
        if (sample.confidence >= confidenceMin && sample.edge >= edgeMin) {
          selected++;
          if (sample.correct) {
            wins++;
          }
        }
      }

      if (selected < minSelections) continue;

      const precision = wins / selected;
      if (precision < minPrecision) continue;

      const score = selected * (precision - 0.5);

      if (!best || score > best.score || (score === best.score && precision > best.precision)) {
        best = {
          confidenceMin,
          edgeMin,
          selected,
          precision,
          score,
        };
      }
    }
  }

  if (!best) {
    const winningSamples = samples.filter((sample) => sample.correct);
    if (winningSamples.length >= 30) {
      const confidenceMin = clamp(
        quantile(winningSamples.map((s) => s.confidence), 0.4),
        0.58,
        DEFAULT_POLICY_CONFIG.confidence.minThreshold
      );
      const edgeMin = clamp(
        quantile(winningSamples.map((s) => s.edge), 0.4),
        0.02,
        DEFAULT_POLICY_CONFIG.edge.minThreshold
      );

      let selected = 0;
      let wins = 0;
      for (const sample of samples) {
        if (sample.confidence >= confidenceMin && sample.edge >= edgeMin) {
          selected++;
          if (sample.correct) wins++;
        }
      }

      return {
        applied: true,
        overrides: {
          confidence: { minThreshold: confidenceMin },
          edge: { minThreshold: edgeMin },
        },
        sampleSize: samples.length,
        selectedCount: selected,
        precision: selected > 0 ? Number((wins / selected).toFixed(4)) : 0,
      };
    }

    return {
      applied: false,
      reason: 'no_candidate_met_constraints',
      sampleSize: samples.length,
      selectedCount: 0,
      precision: 0,
    };
  }

  const confidenceMin = clamp(
    best.confidenceMin,
    0.58,
    DEFAULT_POLICY_CONFIG.confidence.minThreshold
  );
  const edgeMin = clamp(best.edgeMin, 0.02, DEFAULT_POLICY_CONFIG.edge.minThreshold);

  return {
    applied: true,
    overrides: {
      confidence: { minThreshold: confidenceMin },
      edge: { minThreshold: edgeMin },
    },
    sampleSize: samples.length,
    selectedCount: best.selected,
    precision: Number(best.precision.toFixed(4)),
  };
}

function nearlyEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

export async function applyAdaptiveThresholdsToPolicyConfig(params?: {
  lookbackDays?: number;
  actorId?: string;
}): Promise<AdaptiveThresholdPersistenceResult> {
  const lookbackDays = params?.lookbackDays ?? 120;
  const actorId = params?.actorId ?? 'system-adaptive-thresholds';

  const adaptive = await computeAdaptivePolicyThresholds(lookbackDays);
  if (!adaptive.applied || !adaptive.overrides) {
    return {
      changed: false,
      reason: adaptive.reason ?? 'adaptive_not_applied',
      adaptive,
    };
  }

  const currentConfig = await getPersistedOrRuntimePolicyConfig();
  const targetConfidence = adaptive.overrides.confidence.minThreshold;
  const targetEdge = adaptive.overrides.edge.minThreshold;

  const confidenceUnchanged = nearlyEqual(currentConfig.confidence.minThreshold, targetConfidence);
  const edgeUnchanged = nearlyEqual(currentConfig.edge.minThreshold, targetEdge);

  if (confidenceUnchanged && edgeUnchanged) {
    return {
      changed: false,
      reason: 'thresholds_unchanged',
      adaptive,
      config: currentConfig,
    };
  }

  const fullConfig: PolicyConfig = {
    confidence: { minThreshold: targetConfidence },
    edge: { minThreshold: targetEdge },
    drift: { maxDriftScore: currentConfig.drift.maxDriftScore },
    hardStops: {
      dailyLossLimit: currentConfig.hardStops.dailyLossLimit,
      consecutiveLosses: currentConfig.hardStops.consecutiveLosses,
      bankrollPercent: currentConfig.hardStops.bankrollPercent,
    },
  };

  const updatedConfig = updatePolicyConfig(fullConfig);

  const snapshot = await createVersionSnapshot({
    config: updatedConfig,
    createdBy: actorId,
    changeReason: `Adaptive thresholds auto-applied (lookbackDays=${lookbackDays}, sampleSize=${adaptive.sampleSize}, selected=${adaptive.selectedCount}, precision=${adaptive.precision.toFixed(4)})`,
  });

  return {
    changed: true,
    reason: 'thresholds_updated',
    adaptive,
    config: updatedConfig,
    snapshotVersion: snapshot.version,
  };
}

export async function getAdaptiveThresholdReport(
  lookbackDays: number = 120
): Promise<AdaptiveThresholdReport> {
  const [recommendation, latestSnapshot] = await Promise.all([
    computeAdaptivePolicyThresholds(lookbackDays),
    prisma.policyVersionSnapshot.findFirst({
      where: {
        changeReason: {
          startsWith: 'Adaptive thresholds auto-applied',
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        version: true,
        createdAt: true,
        createdBy: true,
        changeReason: true,
      },
    }),
  ]);

  const currentConfig = await getPersistedOrRuntimePolicyConfig();

  return {
    current: {
      confidenceMinThreshold: currentConfig.confidence.minThreshold,
      edgeMinThreshold: currentConfig.edge.minThreshold,
    },
    recommendation,
    latestAppliedSnapshot: latestSnapshot
      ? {
          id: latestSnapshot.id,
          version: latestSnapshot.version,
          createdAt: latestSnapshot.createdAt.toISOString(),
          createdBy: latestSnapshot.createdBy,
          changeReason: latestSnapshot.changeReason ?? undefined,
        }
      : null,
  };
}
