# Policy Engine Documentation

> **Story 2.5**: Single source of truth for Pick/No-Bet/Hard-Stop decisions
> **Last Updated**: 2026-02-13

## Overview

The Policy Engine is the **single source of truth** for all betting decisions in the NBA Analyst system. It evaluates predictions against configurable policy gates and produces consistent outcomes (PICK, NO_BET, or HARD_STOP).

## Architecture

```
src/server/policy/
├── engine.ts              # Main orchestration
├── types.ts               # Domain types
├── config.ts              # Configuration and defaults
├── gates/
│   ├── types.ts          # Gate interface
│   ├── confidence-gate.ts
│   ├── edge-gate.ts
│   ├── drift-gate.ts
│   ├── hard-stop-gate.ts
│   └── index.ts
└── services/
    └── policy-service.ts
```

## Policy Gates

### 1. Confidence Gate
- **Purpose**: Ensures prediction confidence meets minimum threshold
- **Default Threshold**: 0.65 (65%)
- **Severity**: Non-blocking (results in NO_BET if failed)

### 2. Edge Gate
- **Purpose**: Validates that the bet has sufficient edge
- **Default Threshold**: 0.05 (5%)
- **Severity**: Non-blocking (results in NO_BET if failed)

### 3. Drift Gate
- **Purpose**: Checks model drift score is within acceptable range
- **Default Threshold**: 0.15 (15%)
- **Severity**: Non-blocking (results in NO_BET if failed)

### 4. Hard-Stop Gate (CRITICAL)
- **Purpose**: Enforces risk management limits
- **Default Limits**:
  - Daily Loss: €1000
  - Consecutive Losses: 5
  - Bankroll at Risk: 10%
- **Severity**: BLOCKING - immediately stops all evaluation

**CRITICAL**: Hard-stop gate is evaluated FIRST and short-circuits all other gates if triggered (NFR13: 100% enforcement).

## Decision Logic

```
1. HARD_STOP: If hardStopGate.passed === false → DecisionStatus.HARD_STOP
2. NO_BET:    If confidenceGate.passed === false OR edgeGate.passed === false OR driftGate.passed === false → DecisionStatus.NO_BET
3. PICK:      If ALL gates pass → DecisionStatus.PICK
```

## API Endpoints

### POST /api/v1/policy/evaluate

Evaluate a prediction against policy gates.

**Authentication**: Required (any authenticated user)

**Request**:
```json
{
  "prediction": {
    "id": "pred-001",
    "matchId": "match-nba-001",
    "runId": "run-2026-02-13",
    "userId": "user-001",
    "confidence": 0.72,
    "edge": 0.08,
    "driftScore": 0.05,
    "modelVersion": "v1.0.0"
  },
  "context": {
    "runId": "run-2026-02-13",
    "dailyLoss": 0,
    "consecutiveLosses": 0,
    "currentBankroll": 10000
  }
}
```

**Response**:
```json
{
  "data": {
    "decisionId": "dec-001",
    "status": "PICK",
    "rationale": "PICK: All gates passed...",
    "gateOutcomes": {
      "confidence": { "passed": true, "score": 0.72, "threshold": 0.65 },
      "edge": { "passed": true, "score": 0.08, "threshold": 0.05 },
      "drift": { "passed": true, "score": 0.05, "threshold": 0.15 },
      "hardStop": { "passed": true }
    },
    "recommendedAction": "Proceed with bet..."
  },
  "meta": {
    "traceId": "abc-123",
    "timestamp": "2026-02-13T12:00:00.000Z"
  }
}
```

### GET /api/v1/policy/config

Get current policy configuration.

**Authentication**: Required

### PUT /api/v1/policy/config

Update policy configuration.

**Authentication**: Required (admin/ops role only)

## Configuration

Default configuration (defined in `src/server/policy/config.ts`):

```typescript
const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  confidence: { minThreshold: 0.65 },
  edge: { minThreshold: 0.05 },
  drift: { maxDriftScore: 0.15 },
  hardStops: {
    dailyLossLimit: 1000,
    consecutiveLosses: 5,
    bankrollPercent: 0.10
  }
};
```

## Error Handling

The policy engine uses typed domain errors:

- `PolicyError`: Base error class
- `PolicyViolationError`: Raised when policy is violated
- `DataQualityError`: Raised when data quality is insufficient
- `ConfigurationError`: Raised for invalid configuration

All errors are mapped to normalized API error envelopes with traceId for observability.

## Testing

### Unit Tests
Located alongside source files:
- `src/server/policy/gates/*.test.ts`
- `src/server/policy/engine.test.ts`

### Integration Tests
- `tests/integration/policy/evaluation-flow.test.ts`

## Key Requirements (NFRs)

- **NFR13**: Hard-stop enforcement is 100% - zero exceptions allowed
- **FR7**: Policy gates applied to all opportunities
- **FR8**: No-bet is a first-class output
- **FR9**: Hard-stops enforced without exception

## HardStopTracker (Story 2.6)

> **Story 2.6**: Hard-stop state management with persistence

The `HardStopTracker` class manages hard-stop state across daily runs with database persistence.

### Location
`src/server/policy/hardstop-tracker.ts`

### Class Interface

```typescript
class HardStopTracker {
  constructor(config: HardStopsConfig, prisma: PrismaClient);
  
  // Initialize tracker (loads state from DB or creates initial state)
  async initialize(): Promise<void>;
  
  // Check if hard-stop is currently active
  async isActive(): Promise<boolean>;
  
  // Get current hard-stop state
  async getState(): Promise<HardStopStateData>;
  
  // Update daily loss amount
  async updateDailyLoss(amount: number): Promise<void>;
  
  // Update state after decision (tracks consecutive losses)
  async updateAfterDecision(
    decisionStatus: 'PICK' | 'NO_BET' | 'HARD_STOP',
    outcome?: 'WIN' | 'LOSS',
    currentBankroll?: number
  ): Promise<void>;
  
  // Activate hard-stop
  async activate(reason: string): Promise<void>;
  
  // Reset state (admin action with audit)
  async reset(reason: string, actorId: string): Promise<void>;
  
  // Get recommended action based on current state
  getRecommendedAction(): string;
}
```

### State Data Structure

```typescript
interface HardStopStateData {
  isActive: boolean;
  dailyLoss: number;
  consecutiveLosses: number;
  bankrollPercent: number;
  lastResetAt: Date;
  triggeredAt?: Date;
  triggerReason?: string;
}
```

### Integration with Daily Run

The HardStopTracker is integrated into the daily run pipeline (`src/jobs/daily-run-job.ts`):

1. **Pre-run check**: If hard-stop is already active, the run is blocked immediately
2. **Per-decision check**: Before each decision, hard-stop state is checked
3. **Mid-run activation**: If hard-stop triggers during run, remaining decisions are blocked
4. **Alerting**: Critical alerts are sent when hard-stop activates

### API Endpoints (Story 2.6)

#### GET /api/v1/policy/hardstop/status

Returns current hard-stop state for monitoring.

#### POST /api/v1/policy/hardstop/reset

Resets hard-stop state (requires ops/admin role).

### Database Model

Hard-stop state is persisted in the `hard_stop_states` table (see `prisma/schema.prisma`).

## References

- [Story 2.5 Implementation](../_bmad-output/implementation-artifacts/2-5-implementer-le-policy-engine-central-single-source-of-truth.md)
- [Story 2.6 Implementation](../_bmad-output/implementation-artifacts/2-6-implementer-les-hard-stops-bloquants-avec-enforcement-100.md)
- [Architecture Specification](../_bmad-output/planning-artifacts/architecture.md)
