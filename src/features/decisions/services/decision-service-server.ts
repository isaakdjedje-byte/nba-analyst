/**
 * Decision Service - Server Side
 * Direct database access for Server Components
 * Story 3.2: Implement Picks view with today's decisions list
 */

import { prisma } from '@/server/db/client';
import { formatRecommendedPick } from '@/server/policy/recommended-pick';
import type {
  DecisionsResponse,
  Decision,
  DecisionStatus,
  GateOutcomeDetailed,
  DataSignals,
  AuditMetadata,
} from '../types';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDayRange(date: Date): { start: Date; endExclusive: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const endExclusive = new Date(start);
  endExclusive.setDate(endExclusive.getDate() + 1);
  return { start, endExclusive };
}

function parseDateParamToDayRange(dateParam: string): { start: Date; endExclusive: Date } {
  const datePart = dateParam.split('T')[0] ?? dateParam;
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid date format: ${dateParam}`);
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10) - 1;
  const day = Number.parseInt(match[3], 10);
  const localDate = new Date(year, month, day, 0, 0, 0, 0);

  if (
    Number.isNaN(localDate.getTime()) ||
    localDate.getFullYear() !== year ||
    localDate.getMonth() !== month ||
    localDate.getDate() !== day
  ) {
    throw new Error(`Invalid date value: ${dateParam}`);
  }

  return getDayRange(localDate);
}

function toIso(value: unknown): string | null {
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildGates(decision: {
  confidenceGate: boolean;
  edgeGate: boolean;
  driftGate: boolean;
  hardStopGate: boolean;
  confidence: number;
  edge: number | null;
  executedAt: Date;
}): GateOutcomeDetailed[] {
  const evaluatedAt = toIso(decision.executedAt) ?? new Date().toISOString();

  return [
    {
      name: 'Confiance',
      description: 'Le niveau de confiance doit depasser le seuil policy',
      passed: decision.confidenceGate,
      threshold: 0.58,
      actual: decision.confidence,
      evaluatedAt,
    },
    {
      name: 'Edge',
      description: 'L edge estime doit depasser le minimum policy',
      passed: decision.edgeGate,
      threshold: 0.05,
      actual: decision.edge ?? 0,
      evaluatedAt,
    },
    {
      name: 'Drift',
      description: 'La derive du modele doit rester sous le seuil',
      passed: decision.driftGate,
      threshold: 0.15,
      actual: decision.driftGate ? 0.1 : 0.2,
      evaluatedAt,
    },
    {
      name: 'Hard Stop',
      description: 'Aucune limite de risque ne doit etre depassee',
      passed: decision.hardStopGate,
      threshold: 1,
      actual: decision.hardStopGate ? 0 : 1,
      evaluatedAt,
    },
  ];
}

function buildDataSignals(decision: {
  dataSourceFingerprints: unknown;
  modelVersion: string;
  executedAt: Date;
  createdAt: Date;
}): DataSignals {
  const executedAtIso = toIso(decision.executedAt) ?? decision.createdAt.toISOString();
  const fingerprints = Array.isArray(decision.dataSourceFingerprints)
    ? decision.dataSourceFingerprints as Array<Record<string, unknown>>
    : [];

  const sources = fingerprints
    .map((entry) => {
      const name = typeof entry.sourceName === 'string' ? entry.sourceName : null;
      if (!name) return null;
      const freshness = toIso(entry.fetchTimestamp) ?? executedAtIso;
      const reliability = typeof entry.qualityScore === 'number' ? entry.qualityScore : 0.5;
      return { name, freshness, reliability };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return {
    sources,
    mlModelVersion: decision.modelVersion,
    trainingDate: decision.createdAt.toISOString(),
  };
}

function buildMetadata(decision: {
  traceId: string;
  executedAt: Date;
  modelVersion: string;
  runId: string;
}): AuditMetadata {
  const timestamp = toIso(decision.executedAt) ?? new Date().toISOString();

  return {
    traceId: decision.traceId,
    timestamp,
    policyVersion: decision.modelVersion,
    runId: decision.runId,
    createdBy: 'system',
  };
}

async function getDefaultDecisionDate(): Promise<Date | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const nextDecision = await prisma.policyDecision.findFirst({
    where: {
      matchDate: {
        gte: today,
      },
      NOT: {
        modelVersion: {
          startsWith: 'season-end-',
        },
      },
    },
    orderBy: { matchDate: 'asc' },
    select: { matchDate: true },
  });

  if (nextDecision?.matchDate) {
    return nextDecision.matchDate;
  }

  const latestPastDecision = await prisma.policyDecision.findFirst({
    where: {
      matchDate: {
        lt: today,
      },
      NOT: {
        modelVersion: {
          startsWith: 'season-end-',
        },
      },
    },
    orderBy: { matchDate: 'desc' },
    select: { matchDate: true },
  });

  return latestPastDecision?.matchDate ?? null;
}

/**
 * Fetch decisions directly from database (for Server Components)
 * @param date Optional date filter (ISO string)
 * @param status Optional status filter
 * @returns Decisions response with data and metadata
 */
export async function fetchDecisionsServer(
  date?: string,
  status?: string
): Promise<DecisionsResponse> {
  const traceId = `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = new Date().toISOString();
  
  try {
    // Determine date range
    let dateStart: Date;
    let dateEndExclusive: Date;

    if (date) {
      const parsed = parseDateParamToDayRange(date);
      dateStart = parsed.start;
      dateEndExclusive = parsed.endExclusive;
    } else {
      const baseDate = (await getDefaultDecisionDate()) ?? new Date();
      const range = getDayRange(baseDate);
      dateStart = range.start;
      dateEndExclusive = range.endExclusive;
    }

    // Fetch from database
    const decisions = await prisma.policyDecision.findMany({
      where: {
        matchDate: {
          gte: dateStart,
          lt: dateEndExclusive,
        },
        NOT: {
          modelVersion: {
            startsWith: 'season-end-',
          },
        },
        ...(status ? { status: status as DecisionStatus } : {}),
      },
      include: {
        prediction: {
          select: {
            id: true,
            matchId: true,
            league: true,
          },
        },
      },
      orderBy: {
        matchDate: 'asc',
      },
    });

    // Transform to Decision type
    const transformedDecisions: Decision[] = decisions.map((decision) => ({
      id: decision.id,
      match: {
        id: decision.matchId,
        homeTeam: decision.homeTeam,
        awayTeam: decision.awayTeam,
        startTime: decision.matchDate.toISOString(),
        league: decision.prediction?.league || null,
      },
      status: decision.status as DecisionStatus,
      rationale: decision.rationale,
      edge: decision.edge,
      confidence: decision.confidence,
      recommendedPick: formatRecommendedPick(
        decision.recommendedPick,
        decision.homeTeam,
        decision.awayTeam
      ),
      hardStopReason: decision.hardStopReason ?? undefined,
      gates: buildGates(decision),
      dataSignals: buildDataSignals(decision),
      metadata: buildMetadata(decision),
      dailyRunId: decision.runId,
      createdAt: decision.createdAt.toISOString(),
    }));

    return {
      data: transformedDecisions,
      meta: {
        traceId,
        timestamp,
        count: transformedDecisions.length,
        date: date || formatLocalDate(dateStart),
        fromCache: false,
      },
    };
  } catch (error) {
    console.error('[fetchDecisionsServer] Error:', error);
    throw error;
  }
}
