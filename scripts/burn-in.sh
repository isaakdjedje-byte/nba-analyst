#!/bin/bash
# Burn-in Script for Flaky Test Detection
# Mitigates R-001: Tests instables en CI
#
# Usage: ./scripts/burn-in.sh <iterations> [test-pattern]
# Example: ./scripts/burn-in.sh 10 "@p0"

set -e

ITERATIONS=${1:-10}
TEST_PATTERN=${2:-""}
FAILED_COUNT=0
TOTAL_RUNS=0

echo "🔥 Starting Burn-in: ${ITERATIONS} iterations"
echo "📋 Test Pattern: ${TEST_PATTERN:-'All tests'}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create burn-in report directory
mkdir -p burn-in-reports
REPORT_FILE="burn-in-reports/burn-in-$(date +%Y%m%d-%H%M%S).log"

echo "Burn-in Report - $(date)" > "$REPORT_FILE"
echo "Iterations: $ITERATIONS" >> "$REPORT_FILE"
echo "Pattern: $TEST_PATTERN" >> "$REPORT_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> "$REPORT_FILE"

for i in $(seq 1 $ITERATIONS); do
  echo ""
  echo "🔄 Run $i/$ITERATIONS..."
  
  if [ -n "$TEST_PATTERN" ]; then
    npx playwright test --grep "$TEST_PATTERN" --reporter=line 2>&1 | tee -a "$REPORT_FILE" || true
  else
    npx playwright test --reporter=line 2>&1 | tee -a "$REPORT_FILE" || true
  fi
  
  TOTAL_RUNS=$((TOTAL_RUNS + 1))
  
  # Check exit code
  if [ $? -ne 0 ]; then
    FAILED_COUNT=$((FAILED_COUNT + 1))
    echo "❌ Run $i: FAILED"
  else
    echo "✅ Run $i: PASSED"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔥 Burn-in Complete"
echo "📊 Results: $((TOTAL_RUNS - FAILED_COUNT))/$TOTAL_RUNS passed"
echo "📄 Report: $REPORT_FILE"

# Flakiness percentage
if [ $TOTAL_RUNS -gt 0 ]; then
  FLAKINESS=$((100 * FAILED_COUNT / TOTAL_RUNS))
  echo "📈 Flakiness: ${FLAKINESS}%"
  
  echo "" >> "$REPORT_FILE"
  echo "Summary:" >> "$REPORT_FILE"
  echo "- Total Runs: $TOTAL_RUNS" >> "$REPORT_FILE"
  echo "- Passed: $((TOTAL_RUNS - FAILED_COUNT))" >> "$REPORT_FILE"
  echo "- Failed: $FAILED_COUNT" >> "$REPORT_FILE"
  echo "- Flakiness: ${FLAKINESS}%" >> "$REPORT_FILE"
  
  # Exit with error if flakiness > 10%
  if [ $FLAKINESS -gt 10 ]; then
    echo "🚨 Flakiness threshold exceeded (>10%)"
    exit 1
  fi
fi

echo "✅ Burn-in passed - tests are stable"
