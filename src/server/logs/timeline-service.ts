/**
 * Timeline Service
 * Story 4.3: Creer le composant DecisionTimeline pour replay decisionnel
 * 
 * Service to fetch and aggregate timeline events for a decision
 * Follows architecture patterns from Dev Notes
 * 
 * Query decision with full trace from decisions repository
 * Aggregate events from ingestion, ML, policy stages
 */

import { 
  getPolicyDecisionById,
  type PolicyDecisionWithRelations 
} from '@/server/db/repositories/policy-decisions-repository';
import type { 
  DecisionTimeline, 
  TimelineEvent, 
  TimelinePhase,
  TimelinePhaseGroup,
} from '@/features/logs/types';
import { PHASE_ORDER } from '@/features/logs/types';

/**
 * Generate timeline events from persisted decision data.
 */
function generateTimelineEvents(decision: PolicyDecisionWithRelations): TimelineEvent[] {
  const executedAtMs = new Date(decision.executedAt).getTime();
  const publishedAtMs = decision.publishedAt ? new Date(decision.publishedAt).getTime() : executedAtMs;
  const traceId = decision.traceId;

  const policyPassed = decision.confidenceGate
    && decision.edgeGate
    && decision.driftGate
    && !decision.hardStopGate;

  const events: TimelineEvent[] = [
    {
      id: crypto.randomUUID(),
      phase: 'ML_INFERENCE',
      name: 'Model Inference Result',
      description: 'Lecture des sorties ML stockees pour cette decision',
      timestamp: new Date(executedAtMs).toISOString(),
      status: decision.confidence > 0 ? 'success' : 'skipped',
      traceId,
      outputs: {
        confidence: decision.confidence,
        edge: decision.edge,
        modelVersion: decision.modelVersion,
      },
    },
    {
      id: crypto.randomUUID(),
      phase: 'POLICY_EVALUATION',
      name: 'Policy Gates Evaluation',
      description: 'Evaluation des garde-fous de publication',
      timestamp: new Date(executedAtMs).toISOString(),
      status: policyPassed ? 'success' : 'failure',
      traceId,
      outputs: {
        confidenceGate: decision.confidenceGate,
        edgeGate: decision.edgeGate,
        driftGate: decision.driftGate,
        hardStopGate: decision.hardStopGate,
        hardStopReason: decision.hardStopReason,
      },
    },
    {
      id: crypto.randomUUID(),
      phase: 'DECISION_OUTPUT',
      name: 'Decision Publication',
      description: 'Resultat final enregistre et publie',
      timestamp: new Date(publishedAtMs).toISOString(),
      status: 'success',
      traceId,
      outputs: {
        status: decision.status,
        recommendedPick: decision.recommendedPick,
        publishedAt: decision.publishedAt,
      },
    },
  ];

  // Sort events by timestamp
  return events.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

/**
 * Group timeline events by phase
 */
function groupEventsByPhase(events: TimelineEvent[]): TimelinePhaseGroup[] {
  const groups: TimelinePhaseGroup[] = [];

  PHASE_ORDER.forEach((phase) => {
    const phaseEvents = events.filter((e) => e.phase === phase);
    
    if (phaseEvents.length === 0) return;

    const startTime = phaseEvents[0].timestamp;
    const endTime = phaseEvents[phaseEvents.length - 1].timestamp;
    const totalDuration = phaseEvents.reduce((sum, e) => sum + (e.duration || 0), 0);

    const phaseLabels: Record<TimelinePhase, string> = {
      DATA_INGESTION: 'Data Ingestion',
      ML_INFERENCE: 'ML Inference',
      POLICY_EVALUATION: 'Policy Evaluation',
      DECISION_OUTPUT: 'Decision Output',
    };

    groups.push({
      phase,
      phaseLabel: phaseLabels[phase],
      events: phaseEvents,
      startTime,
      endTime,
      totalDuration,
    });
  });

  return groups;
}

/**
 * Get timeline for a specific decision
 * 
 * @param decisionId - The ID of the policy decision
 * @returns DecisionTimeline with all events grouped by phase
 * @throws Error if decision not found
 */
export async function getDecisionTimeline(decisionId: string): Promise<DecisionTimeline> {
  // Fetch decision from repository
  const decision = await getPolicyDecisionById(decisionId);

  if (!decision) {
    throw new Error(`Decision not found: ${decisionId}`);
  }

  // Generate timeline events from decision data
  const events = generateTimelineEvents(decision);

  // Group events by phase
  const phaseGroups = groupEventsByPhase(events);

  // Build the complete timeline
  const timeline: DecisionTimeline = {
    decisionId: decision.id,
    traceId: decision.traceId,
    matchId: decision.matchId,
    matchDate: decision.matchDate.toISOString(),
    homeTeam: decision.homeTeam,
    awayTeam: decision.awayTeam,
    finalStatus: decision.status as 'PICK' | 'NO_BET' | 'HARD_STOP',
    events,
    phaseGroups,
  };

  return timeline;
}

/**
 * Get timeline by traceId
 * 
 * @param traceId - The trace ID of the decision
 * @returns DecisionTimeline with all events grouped by phase
 * @throws Error if decision not found
 */
export async function getDecisionTimelineByTraceId(traceId: string): Promise<DecisionTimeline> {
  const { getPolicyDecisionByTraceId } = await import('@/server/db/repositories/policy-decisions-repository');
  
  const decision = await getPolicyDecisionByTraceId(traceId);

  if (!decision) {
    throw new Error(`Decision not found for traceId: ${traceId}`);
  }

  return getDecisionTimeline(decision.id);
}

const timelineService = {
  getDecisionTimeline,
  getDecisionTimelineByTraceId,
};

export default timelineService;
