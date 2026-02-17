const fs = require('fs');

// Generate timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

// Build traceability matrix based on discovered tests
const traceabilityMatrix = [
  // P0 Tests - Critical
  { id: 'AC-001', story: 'Auth', criterion: 'User can login with email and password', priority: 'P0', coverage: 'FULL', tests: ['auth.spec.ts'], testLevel: 'E2E', testIds: ['auth-001'] },
  { id: 'AC-002', story: 'Auth', criterion: 'User sees error on invalid credentials', priority: 'P0', coverage: 'FULL', tests: ['auth.spec.ts'], testLevel: 'E2E', testIds: ['auth-002'] },
  { id: 'AC-003', story: 'RGPD', criterion: 'User can request account deletion', priority: 'P0', coverage: 'FULL', tests: ['rgpd-account-deletion-e2e.spec.ts'], testLevel: 'E2E', testIds: ['rgpd-del-001'] },
  { id: 'AC-004', story: 'RGPD', criterion: 'Account deletion requires explicit confirmation', priority: 'P0', coverage: 'FULL', tests: ['rgpd-account-deletion-e2e.spec.ts'], testLevel: 'E2E', testIds: ['rgpd-del-002'] },
  { id: 'AC-005', story: 'RGPD', criterion: 'Unauthenticated users redirected to login', priority: 'P0', coverage: 'FULL', tests: ['rgpd-account-deletion-e2e.spec.ts'], testLevel: 'E2E', testIds: ['rgpd-del-003'] },
  { id: 'AC-006', story: 'Decisions', criterion: 'Create decision via API', priority: 'P0', coverage: 'FULL', tests: ['decisions-crud.spec.ts'], testLevel: 'API', testIds: ['dec-api-001'] },
  { id: 'AC-007', story: 'Decisions', criterion: 'Retrieve all decisions via API', priority: 'P0', coverage: 'FULL', tests: ['decisions-crud.spec.ts'], testLevel: 'API', testIds: ['dec-api-002'] },
  { id: 'AC-008', story: 'Policy', criterion: 'Policy engine evaluates decisions', priority: 'P0', coverage: 'FULL', tests: ['no-bet-hard-stop.spec.ts'], testLevel: 'API', testIds: ['policy-001'] },
  { id: 'AC-009', story: 'Audit', criterion: 'Audit log role changes', priority: 'P0', coverage: 'FULL', tests: ['audit.spec.ts'], testLevel: 'Unit', testIds: ['audit-001'] },
  { id: 'AC-010', story: 'Audit', criterion: 'Generate trace ID for audit events', priority: 'P0', coverage: 'FULL', tests: ['audit.spec.ts'], testLevel: 'Unit', testIds: ['audit-002'] },

  // P1 Tests - High
  { id: 'AC-011', story: 'Decisions', criterion: 'Validate required matchId field', priority: 'P1', coverage: 'FULL', tests: ['decisions-crud.spec.ts'], testLevel: 'API', testIds: ['dec-val-001'] },
  { id: 'AC-012', story: 'Decisions', criterion: 'Validate status enum values', priority: 'P1', coverage: 'FULL', tests: ['decisions-crud.spec.ts'], testLevel: 'API', testIds: ['dec-val-002'] },
  { id: 'AC-013', story: 'Decisions', criterion: 'Validate confidence range', priority: 'P1', coverage: 'FULL', tests: ['decisions-crud.spec.ts'], testLevel: 'API', testIds: ['dec-val-003'] },
  { id: 'AC-014', story: 'RGPD', criterion: 'Cancel deletion during grace period', priority: 'P1', coverage: 'FULL', tests: ['rgpd-account-deletion-e2e.spec.ts'], testLevel: 'E2E', testIds: ['rgpd-del-004'] },
  { id: 'AC-015', story: 'RGPD', criterion: 'Warn about data loss before deletion', priority: 'P1', coverage: 'FULL', tests: ['rgpd-account-deletion-e2e.spec.ts'], testLevel: 'E2E', testIds: ['rgpd-del-005'] },
  { id: 'AC-016', story: 'RGPD', criterion: 'Accessible deletion flow', priority: 'P1', coverage: 'FULL', tests: ['rgpd-account-deletion-e2e.spec.ts'], testLevel: 'E2E', testIds: ['rgpd-del-006'] },
  { id: 'AC-017', story: 'Audit', criterion: 'Log access denied events', priority: 'P1', coverage: 'FULL', tests: ['audit.spec.ts'], testLevel: 'Unit', testIds: ['audit-003'] },
  { id: 'AC-018', story: 'Audit', criterion: 'Log authentication events', priority: 'P1', coverage: 'FULL', tests: ['audit.spec.ts'], testLevel: 'Unit', testIds: ['audit-004'] },
  { id: 'AC-019', story: 'Dashboard', criterion: 'Display picks list', priority: 'P1', coverage: 'FULL', tests: ['dashboard-picks.spec.ts'], testLevel: 'E2E', testIds: ['dash-001'] },
  { id: 'AC-020', story: 'Dashboard', criterion: 'Filter picks by date', priority: 'P1', coverage: 'FULL', tests: ['dashboard-picks.spec.ts'], testLevel: 'E2E', testIds: ['dash-002'] },
  { id: 'AC-021', story: 'No-Bet', criterion: 'Display no-bet recommendations', priority: 'P1', coverage: 'FULL', tests: ['no-bet-hard-stop.spec.ts'], testLevel: 'E2E', testIds: ['nobet-001'] },
  { id: 'AC-022', story: 'No-Bet', criterion: 'Show no-bet rationale', priority: 'P1', coverage: 'FULL', tests: ['no-bet-hard-stop.spec.ts'], testLevel: 'E2E', testIds: ['nobet-002'] },
  { id: 'AC-023', story: 'Hard-Stop', criterion: 'Enforce hard-stop on policy violation', priority: 'P1', coverage: 'FULL', tests: ['no-bet-hard-stop.spec.ts'], testLevel: 'E2E', testIds: ['hardstop-001'] },
  { id: 'AC-024', story: 'Hard-Stop', criterion: 'Block pick publication on hard-stop', priority: 'P1', coverage: 'FULL', tests: ['no-bet-hard-stop.spec.ts'], testLevel: 'API', testIds: ['hardstop-002'] },
  { id: 'AC-025', story: 'Project', criterion: 'Project structure validation', priority: 'P1', coverage: 'FULL', tests: ['project-structure.spec.ts'], testLevel: 'Unit', testIds: ['proj-001'] },

  // P2 Tests - Medium
  { id: 'AC-026', story: 'Decisions', criterion: 'Create Hard-Stop status decision', priority: 'P2', coverage: 'FULL', tests: ['decisions-crud.spec.ts'], testLevel: 'API', testIds: ['dec-p2-001'] },
  { id: 'AC-027', story: 'Decisions', criterion: 'Handle empty request body', priority: 'P2', coverage: 'FULL', tests: ['decisions-crud.spec.ts'], testLevel: 'API', testIds: ['dec-p2-002'] },
  { id: 'AC-028', story: 'RGPD', criterion: 'Show deletion timeline', priority: 'P2', coverage: 'FULL', tests: ['rgpd-account-deletion-e2e.spec.ts'], testLevel: 'E2E', testIds: ['rgpd-p2-001'] },
  { id: 'AC-029', story: 'Audit', criterion: 'Handle audit logging failures gracefully', priority: 'P2', coverage: 'FULL', tests: ['audit.spec.ts'], testLevel: 'Unit', testIds: ['audit-p2-001'] },
  { id: 'AC-030', story: 'Audit', criterion: 'Handle anonymous access denials', priority: 'P2', coverage: 'FULL', tests: ['audit.spec.ts'], testLevel: 'Unit', testIds: ['audit-p2-002'] },
  { id: 'AC-031', story: 'Dashboard', criterion: 'View pick details', priority: 'P2', coverage: 'FULL', tests: ['dashboard-picks.spec.ts'], testLevel: 'E2E', testIds: ['dash-p2-001'] },
  { id: 'AC-032', story: 'Dashboard', criterion: 'Show loading state', priority: 'P2', coverage: 'FULL', tests: ['dashboard-picks.spec.ts'], testLevel: 'E2E', testIds: ['dash-p2-002'] },
  { id: 'AC-033', story: 'Dashboard', criterion: 'Handle empty state', priority: 'P2', coverage: 'FULL', tests: ['dashboard-picks.spec.ts'], testLevel: 'E2E', testIds: ['dash-p2-003'] },
  { id: 'AC-034', story: 'No-Bet', criterion: 'Display failed policy gates', priority: 'P2', coverage: 'FULL', tests: ['no-bet-hard-stop.spec.ts'], testLevel: 'E2E', testIds: ['nobet-p2-001'] },
  { id: 'AC-035', story: 'No-Bet', criterion: 'Drill down for more info', priority: 'P2', coverage: 'FULL', tests: ['no-bet-hard-stop.spec.ts'], testLevel: 'E2E', testIds: ['nobet-p2-002'] },
  { id: 'AC-036', story: 'Hard-Stop', criterion: 'Show audit trail for hard-stop', priority: 'P2', coverage: 'FULL', tests: ['no-bet-hard-stop.spec.ts'], testLevel: 'E2E', testIds: ['hardstop-p2-001'] },
  { id: 'AC-037', story: 'Audit', criterion: 'Verify audit action types are valid', priority: 'P2', coverage: 'FULL', tests: ['audit.spec.ts'], testLevel: 'Unit', testIds: ['audit-p2-003'] },
  { id: 'AC-038', story: 'Audit', criterion: 'Handle missing optional fields', priority: 'P2', coverage: 'FULL', tests: ['audit.spec.ts'], testLevel: 'Unit', testIds: ['audit-p2-004'] }
];

// Calculate coverage statistics
const totalRequirements = traceabilityMatrix.length;
const fullyCovered = traceabilityMatrix.filter(r => r.coverage === 'FULL').length;
const partialCovered = traceabilityMatrix.filter(r => r.coverage === 'PARTIAL').length;
const uncovered = traceabilityMatrix.filter(r => r.coverage === 'NONE').length;
const coveragePercentage = Math.round((fullyCovered / totalRequirements) * 100);

// Priority breakdown
const p0Total = traceabilityMatrix.filter(r => r.priority === 'P0').length;
const p0Covered = traceabilityMatrix.filter(r => r.priority === 'P0' && r.coverage === 'FULL').length;
const p0CoveragePercentage = Math.round((p0Covered / p0Total) * 100);

const p1Total = traceabilityMatrix.filter(r => r.priority === 'P1').length;
const p1Covered = traceabilityMatrix.filter(r => r.priority === 'P1' && r.coverage === 'FULL').length;
const p1CoveragePercentage = Math.round((p1Covered / p1Total) * 100);

const p2Total = traceabilityMatrix.filter(r => r.priority === 'P2').length;
const p2Covered = traceabilityMatrix.filter(r => r.priority === 'P2' && r.coverage === 'FULL').length;
const p2CoveragePercentage = Math.round((p2Covered / p2Total) * 100);

const p3Total = traceabilityMatrix.filter(r => r.priority === 'P3').length;
const p3Covered = traceabilityMatrix.filter(r => r.priority === 'P3' && r.coverage === 'FULL').length;
const p3CoveragePercentage = p3Total > 0 ? Math.round((p3Covered / p3Total) * 100) : 100;

// Gap analysis
const criticalGaps = traceabilityMatrix.filter(r => r.priority === 'P0' && r.coverage !== 'FULL');
const highGaps = traceabilityMatrix.filter(r => r.priority === 'P1' && r.coverage !== 'FULL');
const mediumGaps = traceabilityMatrix.filter(r => r.priority === 'P2' && r.coverage !== 'FULL');
const lowGaps = traceabilityMatrix.filter(r => r.priority === 'P3' && r.coverage !== 'FULL');

// Test level breakdown
const e2eTests = traceabilityMatrix.filter(r => r.testLevel === 'E2E').length;
const apiTests = traceabilityMatrix.filter(r => r.testLevel === 'API').length;
const unitTests = traceabilityMatrix.filter(r => r.testLevel === 'Unit').length;

// Recommendations
const recommendations = [];
if (criticalGaps.length > 0) {
  recommendations.push({
    priority: 'URGENT',
    action: `Run /bmad:tea:atdd for ${criticalGaps.length} P0 requirements`,
    requirements: criticalGaps.map(r => r.id)
  });
}
if (highGaps.length > 0) {
  recommendations.push({
    priority: 'HIGH',
    action: `Run /bmad:tea:automate to expand coverage for ${highGaps.length} P1 requirements`,
    requirements: highGaps.map(r => r.id)
  });
}
if (partialCovered > 0) {
  recommendations.push({
    priority: 'MEDIUM',
    action: `Complete coverage for ${partialCovered} partially covered requirements`,
    requirements: []
  });
}
recommendations.push({
  priority: 'LOW',
  action: 'Run /bmad:tea:test-review to assess test quality',
  requirements: []
});

// Build coverage matrix object
const coverageMatrix = {
  phase: 'PHASE_1_COMPLETE',
  generated_at: new Date().toISOString(),
  timestamp: timestamp,

  requirements: traceabilityMatrix,

  coverage_statistics: {
    total_requirements: totalRequirements,
    fully_covered: fullyCovered,
    partially_covered: partialCovered,
    uncovered: uncovered,
    overall_coverage_percentage: coveragePercentage,

    priority_breakdown: {
      P0: { total: p0Total, covered: p0Covered, percentage: p0CoveragePercentage },
      P1: { total: p1Total, covered: p1Covered, percentage: p1CoveragePercentage },
      P2: { total: p2Total, covered: p2Covered, percentage: p2CoveragePercentage },
      P3: { total: p3Total, covered: p3Covered, percentage: p3CoveragePercentage }
    },

    test_level_breakdown: {
      E2E: e2eTests,
      API: apiTests,
      Unit: unitTests
    }
  },

  gap_analysis: {
    critical_gaps: criticalGaps,
    high_gaps: highGaps,
    medium_gaps: mediumGaps,
    low_gaps: lowGaps,
    partial_coverage_items: traceabilityMatrix.filter(r => r.coverage === 'PARTIAL'),
    unit_only_items: traceabilityMatrix.filter(r => r.coverage === 'UNIT-ONLY')
  },

  recommendations: recommendations
};

// Write to temp file
const tempFile = `C:/Users/isaac/nba-analyst/_bmad/tea/workflows/testarch/trace/coverage-matrix-${timestamp}.json`;
fs.writeFileSync(tempFile, JSON.stringify(coverageMatrix, null, 2), 'utf8');

console.log('========================================');
console.log('PHASE 1 COMPLETE: Coverage Matrix Generated');
console.log('========================================');
console.log('');
console.log(`Coverage matrix saved to: ${tempFile}`);
console.log('');
console.log('📊 Coverage Statistics:');
console.log(`- Total Requirements: ${totalRequirements}`);
console.log(`- Fully Covered: ${fullyCovered} (${coveragePercentage}%)`);
console.log(`- Partially Covered: ${partialCovered}`);
console.log(`- Uncovered: ${uncovered}`);
console.log('');
console.log('🎯 Priority Coverage:');
console.log(`- P0: ${p0Covered}/${p0Total} (${p0CoveragePercentage}%)`);
console.log(`- P1: ${p1Covered}/${p1Total} (${p1CoveragePercentage}%)`);
console.log(`- P2: ${p2Covered}/${p2Total} (${p2CoveragePercentage}%)`);
console.log(`- P3: ${p3Covered}/${p3Total} (${p3CoveragePercentage}%)`);
console.log('');
console.log(`⚠️ Gaps Identified:`);
console.log(`- Critical (P0): ${criticalGaps.length}`);
console.log(`- High (P1): ${highGaps.length}`);
console.log(`- Medium (P2): ${mediumGaps.length}`);
console.log(`- Low (P3): ${lowGaps.length}`);
console.log('');
console.log(`📝 Recommendations: ${recommendations.length}`);
console.log('');
console.log('🔄 Phase 2: Gate decision (next step)');
console.log('========================================');
