/**
 * Policy Configuration UI Types
 * Story 5.2: Interface admin de gestion des paramètres policy
 */

export interface PolicyParameter {
  key: string;
  name: string;
  description: string;
  currentValue: number;
  minValue: number;
  maxValue: number;
  unit: string;
  category: 'edge' | 'confidence' | 'hard_stop' | 'data_quality';
}

export interface PolicyConfigResponse {
  config: {
    confidence: {
      minThreshold: number;
    };
    edge: {
      minThreshold: number;
    };
    drift: {
      maxDriftScore: number;
    };
    hardStops: {
      dailyLossLimit: number;
      consecutiveLosses: number;
      bankrollPercent: number;
    };
  };
  defaults: {
    confidence: {
      minThreshold: number;
    };
    edge: {
      minThreshold: number;
    };
    drift: {
      maxDriftScore: number;
    };
    hardStops: {
      dailyLossLimit: number;
      consecutiveLosses: number;
      bankrollPercent: number;
    };
  };
}

export interface PolicyUpdateRequest {
  confidence?: {
    minThreshold?: number;
  };
  edge?: {
    minThreshold?: number;
  };
  drift?: {
    maxDriftScore?: number;
  };
  hardStops?: {
    dailyLossLimit?: number;
    consecutiveLosses?: number;
    bankrollPercent?: number;
  };
}

export interface PolicyUpdateResponse {
  data: {
    message: string;
    config: PolicyUpdateRequest;
  };
  meta: {
    traceId: string;
    timestamp: string;
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface PolicyConfigError {
  error: {
    code: string;
    message: string;
    details?: {
      errors?: ValidationError[];
    };
  };
  meta: {
    traceId: string;
    timestamp: string;
  };
}

// Audit log types
export interface PolicyChangeAudit {
  id: string;
  timestamp: string;
  adminUserId: string;
  parameterKey: string;
  oldValue: string;
  newValue: string;
  reason?: string;
  traceId: string;
}

export interface AuditHistoryResponse {
  data: {
    logs: PolicyChangeAudit[];
    total: number;
  };
  meta: {
    traceId: string;
    timestamp: string;
  };
}

// UI State types
export type PolicyConfigState = 'idle' | 'loading' | 'success' | 'error' | 'degraded' | 'blocked';

// Category configuration for display
export const POLICY_CATEGORY_CONFIG: Record<PolicyParameter['category'], { label: string; color: string; bgColor: string }> = {
  edge: {
    label: 'Seuil de valeur',
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
  },
  confidence: {
    label: 'Confiance',
    color: 'text-emerald-700 dark:text-emerald-300',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
  },
  hard_stop: {
    label: 'Limite de sécurité',
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
  },
  data_quality: {
    label: 'Qualité des données',
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
  },
};
