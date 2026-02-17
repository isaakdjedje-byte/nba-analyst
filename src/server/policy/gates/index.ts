/**
 * Policy Gates Barrel Export
 * 
 * Story 2.5: Single source of truth for Pick/No-Bet/Hard-Stop decisions.
 */

export type { Gate, GateInput, GateResult, GateConfig, GateSeverity } from './types';

export { ConfidenceGate, createConfidenceGate } from './confidence-gate';
export { EdgeGate, createEdgeGate } from './edge-gate';
export { DriftGate, createDriftGate } from './drift-gate';
export { HardStopGate, createHardStopGate } from './hard-stop-gate';
