#!/bin/bash
# scripts/test-changed.sh
# Run tests only for changed files

set -e

BASE_BRANCH=${1:-main}
SPEC_PATTERN='\.(spec|test)\.(ts|js|tsx|jsx)$'

echo "🎯 Selective Test Runner"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Base branch: $BASE_BRANCH"
echo ""

# Detect changed test files
CHANGED_SPECS=$(git diff --name-only $BASE_BRANCH...HEAD | grep -E "$SPEC_PATTERN" || echo "")

if [ -z "$CHANGED_SPECS" ]; then
  echo "✅ No test files changed."
  exit 0
fi

echo "Running tests for changed files:"
echo "$CHANGED_SPECS" | sed 's/^/  - /'
echo ""

npm run test -- $CHANGED_SPECS
