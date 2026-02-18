/**
 * Decision Service - Server Side
 * Direct database access for Server Components
 * Story 3.2: Implement Picks view with today's decisions list
 */

import { prisma } from '@/server/db/client';
import { formatRecommendedPick } from '@/server/policy/recommended-pick';
import type { DecisionsResponse, Decision, DecisionStatus } from '../types';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
    let dateEnd: Date;

    if (date) {
      const parsedDate = new Date(date);
      dateStart = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 0, 0, 0);
      dateEnd = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 23, 59, 59, 999);
    } else {
      const baseDate = (await getDefaultDecisionDate()) ?? new Date();
      dateStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0);
      dateEnd = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 23, 59, 59, 999);
    }

    // Fetch from database
    const decisions = await prisma.policyDecision.findMany({
      where: {
        matchDate: {
          gte: dateStart,
          lte: dateEnd,
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
