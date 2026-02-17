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
 * Generate timeline events from a policy decision
 * This aggregates events from ingestion, ML inference, policy evaluation, and decision output
 * 
 * In a real implementation, this would query additional tables for:
 * - Data ingestion events (from data sources)
 * - ML inference outputs (from predictions)
 * - Policy evaluation results (from policy engine)
 * - Gate evaluation details
 * 
 * For now, we generate mock timeline data based on the decision record
 */
function generateTimelineEvents(decision: PolicyDecisionWithRelations): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const baseTimestamp = new Date(decision.executedAt).getTime();
  const traceId = decision.traceId;

  // Phase 1: Data Ingestion
  const ingestionEvents: TimelineEvent[] = [
    {
      id: crypto.randomUUID(),
      phase: 'DATA_INGESTION',
      name: 'Match Data Fetch',
      description: 'Récupération des données du match depuis les sources externes',
      timestamp: new Date(baseTimestamp - 5000).toISOString(),
      duration: 1200,
      status: 'success',
      traceId,
      inputs: { matchId: decision.matchId },
      outputs: { 
        homeTeam: decision.homeTeam, 
        awayTeam: decision.awayTeam,
        matchDate: decision.matchDate 
      },
      details: { source: 'ESPN API', fetchedAt: new Date(baseTimestamp - 5000).toISOString() }
    },
    {
      id: crypto.randomUUID(),
      phase: 'DATA_INGESTION',
      name: 'Historical Data Enrichment',
      description: 'Enrichissement avec les données historiques',
      timestamp: new Date(baseTimestamp - 3800).toISOString(),
      duration: 800,
      status: 'success',
      traceId,
      inputs: { matchId: decision.matchId },
      outputs: { historicalGames: 15, formData: 'retrieved' },
      details: { cacheHit: true }
    },
  ];
  events.push(...ingestionEvents);

  // Phase 2: ML Inference
  const mlEvents: TimelineEvent[] = [
    {
      id: crypto.randomUUID(),
      phase: 'ML_INFERENCE',
      name: 'Confidence Prediction',
      description: 'Prédiction du score de confiance par le modèle ML',
      timestamp: new Date(baseTimestamp - 3000).toISOString(),
      duration: 450,
      status: 'success',
      traceId,
      inputs: { 
        homeTeam: decision.homeTeam, 
        awayTeam: decision.awayTeam,
        historicalData: 'enriched'
      },
      outputs: { confidence: decision.confidence },
      details: { modelVersion: decision.modelVersion }
    },
    {
      id: crypto.randomUUID(),
      phase: 'ML_INFERENCE',
      name: 'Edge Calculation',
      description: 'Calcul du paramètre edge pour le picks',
      timestamp: new Date(baseTimestamp - 2550).toISOString(),
      duration: 200,
      status: decision.edge !== null ? 'success' : 'skipped',
      traceId,
      inputs: { confidence: decision.confidence },
      outputs: decision.edge !== null ? { edge: decision.edge } : undefined,
      details: decision.edge !== null ? { calculation: 'standard' } : { reason: 'confidence below threshold' }
    },
  ];
  events.push(...mlEvents);

  // Phase 3: Policy Evaluation
  const policyEvents: TimelineEvent[] = [
    {
      id: crypto.randomUUID(),
      phase: 'POLICY_EVALUATION',
      name: 'Confidence Gate Evaluation',
      description: 'Évaluation de la gate de confiance',
      timestamp: new Date(baseTimestamp - 2350).toISOString(),
      duration: 50,
      status: decision.confidenceGate ? 'success' : 'failure',
      traceId,
      inputs: { confidence: decision.confidence, threshold: 0.65 },
      outputs: { passed: decision.confidenceGate, threshold: 0.65 },
      details: { gateName: 'confidence_gate' }
    },
    {
      id: crypto.randomUUID(),
      phase: 'POLICY_EVALUATION',
      name: 'Edge Gate Evaluation',
      description: 'Évaluation de la gate edge',
      timestamp: new Date(baseTimestamp - 2300).toISOString(),
      duration: 40,
      status: decision.edgeGate ? 'success' : 'skipped',
      traceId,
      inputs: { edge: decision.edge, threshold: 0.05 },
      outputs: decision.edge !== null ? { passed: decision.edgeGate, threshold: 0.05 } : undefined,
      details: decision.edge !== null ? { gateName: 'edge_gate' } : { reason: 'edge not calculated' }
    },
    {
      id: crypto.randomUUID(),
      phase: 'POLICY_EVALUATION',
      name: 'Drift Gate Evaluation',
      description: 'Évaluation de la gate de drift',
      timestamp: new Date(baseTimestamp - 2260).toISOString(),
      duration: 60,
      status: decision.driftGate ? 'success' : 'failure',
      traceId,
      inputs: { driftScore: 0.02, threshold: 0.1 },
      outputs: { passed: decision.driftGate, driftScore: 0.02 },
      details: { gateName: 'drift_gate' }
    },
    {
      id: crypto.randomUUID(),
      phase: 'POLICY_EVALUATION',
      name: 'Hard Stop Gate Evaluation',
      description: 'Évaluation de la gate hard stop',
      timestamp: new Date(baseTimestamp - 2200).toISOString(),
      duration: 100,
      status: decision.hardStopGate ? 'failure' : 'success',
      traceId,
      inputs: { hardStopConditions: ['injury', 'weather', 'rest'] },
      outputs: { 
        passed: !decision.hardStopGate, 
        reason: decision.hardStopReason 
      },
      details: { gateName: 'hard_stop_gate' }
    },
  ];
  events.push(...policyEvents);

  // Phase 4: Decision Output
  const outputEvents: TimelineEvent[] = [
    {
      id: crypto.randomUUID(),
      phase: 'DECISION_OUTPUT',
      name: 'Final Decision Computation',
      description: 'Calcul de la décision finale basée sur les évaluations',
      timestamp: new Date(baseTimestamp - 2100).toISOString(),
      duration: 30,
      status: 'success',
      traceId,
      inputs: { 
        confidenceGate: decision.confidenceGate,
        edgeGate: decision.edgeGate,
        driftGate: decision.driftGate,
        hardStopGate: decision.hardStopGate
      },
      outputs: { 
        status: decision.status,
        recommendedPick: decision.recommendedPick,
        rationale: decision.rationale
      },
      details: { policyVersion: 'v1.0' }
    },
    {
      id: crypto.randomUUID(),
      phase: 'DECISION_OUTPUT',
      name: 'Decision Recording',
      description: 'Enregistrement de la décision dans la base de données',
      timestamp: new Date(baseTimestamp - 2070).toISOString(),
      duration: 70,
      status: 'success',
      traceId,
      inputs: { 
        decisionId: decision.id,
        status: decision.status
      },
      outputs: { 
        recorded: true,
        recordId: decision.id
      },
      details: { database: 'postgresql' }
    },
  ];
  events.push(...outputEvents);

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
