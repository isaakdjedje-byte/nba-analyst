/**
 * Decision Types
 * TypeScript types for decision/pick data
 * Story 3.2: Implement Picks view with today's decisions list
 */

/**
 * Strict Decision Status Constants
 * Story 3.6: StatusBadge avec sémantique stricte
 */
export const DECISION_STATUS = {
  PICK: 'PICK',
  NO_BET: 'NO_BET',
  HARD_STOP: 'HARD_STOP'
} as const;

export type DecisionStatus = typeof DECISION_STATUS[keyof typeof DECISION_STATUS];

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string | null;
  league: string | null;
}

export interface GateOutcome {
  name: string;
  passed: boolean;
  threshold?: number;
  actual?: number;
}

export interface Decision {
  id: string;
  match: Match;
  status: DecisionStatus;
  rationale: string;
  edge: number | null;
  confidence: number;
  recommendedPick: string | null;
  hardStopReason?: string;
  recommendedAction?: string;
  gates?: GateOutcome[];
  isDegraded?: boolean;
  dailyRunId: string;
  createdAt: string;
}

export interface DecisionsResponse {
  data: Decision[];
  meta: {
    traceId: string;
    timestamp: string;
    count: number;
    date: string;
    fromCache: boolean;
    // AC3: Degraded state flags
    degraded?: boolean;
    degradedReason?: string;
    // AC4: Blocked state flags
    blocked?: boolean;
    blockedReason?: string;
    recommendedAction?: string;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
  meta: {
    traceId: string;
    timestamp: string;
  };
}

// =============================================================================
// EXTENDED TYPES FOR DETAILPANEL (Story 3.5)
// =============================================================================

/**
 * Data source information for audit trail
 * AC4: Data Signals and Metadata
 */
export interface DataSource {
  name: string;
  freshness: string; // ISO timestamp
  reliability: number; // 0-1
}

/**
 * Confidence breakdown with detailed metrics
 * AC2: Detailed confidence information
 */
export interface ConfidenceBreakdown {
  mlConfidence: number;
  historicalAccuracy: number;
  sampleSize: number;
  adjustedConfidence: number;
}

/**
 * Edge calculation breakdown
 * AC2: Complete edge calculation details
 */
export interface EdgeCalculation {
  impliedProbability: number;
  predictedProbability: number;
  edge: number;
  marketOdds: number;
  fairOdds: number;
}

/**
 * Data signals with sources and ML info
 * AC4: Data signals section
 */
export interface DataSignals {
  sources: DataSource[];
  mlModelVersion: string;
  trainingDate: string;
}

/**
 * Extended gate outcome with description and timestamp
 * AC3: Detailed gate display
 */
export interface GateOutcomeDetailed extends GateOutcome {
  description: string;
  evaluatedAt: string;
}

/**
 * Audit metadata for traceability
 * AC4: Metadata and audit section
 */
export interface AuditMetadata {
  traceId: string;
  timestamp: string;
  policyVersion: string;
  runId: string;
  createdBy: string;
}

/**
 * Complete decision detail with all extended fields
 * Used by DetailPanel for expanded view
 */
export interface DecisionDetail extends Decision {
  confidenceBreakdown?: ConfidenceBreakdown;
  edgeCalculation?: EdgeCalculation;
  dataSignals?: DataSignals;
  gates?: GateOutcomeDetailed[];
  metadata?: AuditMetadata;
}

/**
 * Status Configuration - Single Source of Truth
 * Story 3.6: Strict semantic colors and Lucide icons
 */
export type StatusConfig = {
  label: string;
  icon: 'CheckCircle' | 'Ban' | 'ShieldAlert'; // Lucide icon names
  color: string; // Hex color
  bgLight: string;
  bgDark: string;
  borderLight: string;
  borderDark: string;
};

export const STATUS_CONFIG: Record<DecisionStatus, StatusConfig> = {
  PICK: {
    label: 'Pick',
    icon: 'CheckCircle',
    color: '#047857', // Changed from #0E9F6E for WCAG AA 4.5:1 compliance (5.4:1)
    bgLight: 'bg-emerald-50',
    bgDark: 'bg-emerald-900/20',
    borderLight: 'border-emerald-200',
    borderDark: 'border-emerald-800',
  },
  NO_BET: {
    label: 'No-Bet',
    icon: 'Ban',
    color: '#2563EB',
    bgLight: 'bg-blue-50',
    bgDark: 'bg-blue-900/20',
    borderLight: 'border-blue-200',
    borderDark: 'border-blue-800',
  },
  HARD_STOP: {
    label: 'Hard-Stop',
    icon: 'ShieldAlert',
    color: '#C2410C',
    bgLight: 'bg-orange-50',
    bgDark: 'bg-orange-900/20',
    borderLight: 'border-orange-200',
    borderDark: 'border-orange-800',
  },
};

/**
 * Runtime validation helper for DecisionStatus
 * Throws error in development for invalid statuses
 */
export function validateDecisionStatus(
  value: unknown
): asserts value is DecisionStatus {
  const validStatuses = Object.values(DECISION_STATUS);
  if (!validStatuses.includes(value as DecisionStatus)) {
    throw new Error(
      `Invalid decision status: ${value}. ` +
      `Expected one of: ${validStatuses.join(', ')}`
    );
  }
}

// =============================================================================
// BLOCK CAUSE TYPES (Story 5.1)
// =============================================================================

/**
 * Data quality metrics when block is data quality related
 */
export interface DataQualityMetric {
  metric: string;
  value: number;
  threshold: number;
}

/**
 * Block Cause - Information about why a decision was blocked by policy
 * Story 5.1: Créer le panneau d'affichage des causes de blocage policy
 */
export interface BlockCause {
  ruleName: string;              // e.g., "HARD_STOP_BANKROLL_LIMIT"
  ruleDescription: string;        // Human-readable rule description
  triggeredAt: string;           // When the block was triggered (ISO 8601)
  currentValue: number;          // Current metric value
  threshold: number;             // Threshold that was exceeded
  recommendation: string;        // Next action for user
  relatedPolicyId?: string;      // Reference to policy rule (for admin)
  dataQualityMetrics?: DataQualityMetric[];  // If block is data quality related
  category: BlockCauseCategory;
}

/**
 * Hard-Stop Categories
 */
export type BlockCauseCategory = 
  | 'bankroll_limit'
  | 'data_quality'
  | 'model_confidence'
  | 'drift_detection'
  | 'service_unavailable';

/**
 * Detect block cause category from hard stop reason string
 */
export function detectBlockCauseCategory(reason: string | null | undefined): BlockCauseCategory {
  if (!reason) return 'bankroll_limit';
  
  const lowerReason = reason.toLowerCase();
  
  if (
    lowerReason.includes('bankroll') ||
    lowerReason.includes('limit') ||
    lowerReason.includes('loss') ||
    lowerReason.includes('budget')
  ) {
    return 'bankroll_limit';
  }

  if (
    lowerReason.includes('data') ||
    lowerReason.includes('quality') ||
    lowerReason.includes('gate') ||
    lowerReason.includes('source')
  ) {
    return 'data_quality';
  }

  if (
    lowerReason.includes('confidence') ||
    lowerReason.includes('model') ||
    lowerReason.includes('threshold')
  ) {
    return 'model_confidence';
  }

  if (
    lowerReason.includes('drift') ||
    lowerReason.includes('distribution')
  ) {
    return 'drift_detection';
  }

  if (
    lowerReason.includes('service') ||
    lowerReason.includes('unavailable') ||
    lowerReason.includes('external') ||
    lowerReason.includes('api')
  ) {
    return 'service_unavailable';
  }

  return 'bankroll_limit';
}

/**
 * Block Cause Category Configuration
 */
export const BLOCK_CAUSE_CATEGORY_CONFIG: Record<BlockCauseCategory, {
  label: string;
  icon: 'ShieldAlert' | 'Database' | 'Brain' | 'Activity' | 'ServerOff';
  color: string;
}> = {
  bankroll_limit: {
    label: 'Limite de bankroll',
    icon: 'ShieldAlert',
    color: '#C2410C',
  },
  data_quality: {
    label: 'Qualité des données',
    icon: 'Database',
    color: '#7C3AED',
  },
  model_confidence: {
    label: 'Confiance du modèle',
    icon: 'Brain',
    color: '#DC2626',
  },
  drift_detection: {
    label: 'Dérive détectée',
    icon: 'Activity',
    color: '#EA580C',
  },
  service_unavailable: {
    label: 'Service indisponible',
    icon: 'ServerOff',
    color: '#64748B',
  },
};

/**
 * BlockCausePanel Props Interface
 */
export interface BlockCausePanelProps {
  decisionId: string;
  cause: BlockCause;
  expanded?: boolean;
  onExpandChange?: (expanded: boolean) => void;
  showTechnicalDetails?: boolean;  // For admin/ops users
  className?: string;
}

/**
 * Block Cause API Response
 */
export interface BlockCauseResponse {
  data: BlockCause;
  meta: {
    traceId: string;
    timestamp: string;
  };
}
