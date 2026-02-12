#!/bin/bash
# scripts/ci-local.sh
# Run CI pipeline locally for parity testing

set -e

echo "🚀 CI Local Runner"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Mirrors CI environment for local testing"
echo ""

# Set CI environment variables
export CI=true
export NODE_ENV=test

# Clean previous results
echo "🧹 Cleaning previous test results..."
rm -rf test-results/
rm -rf playwright-report/
rm -rf burn-in-failures/

# Install dependencies (if needed)
echo "📦 Checking dependencies..."
npm ci --prefer-offline --no-audit

# Install Playwright browsers
echo "🎭 Installing Playwright browsers..."
npx playwright install --with-deps chromium

# Run lint
echo ""
echo "🔍 Running linter..."
npm run lint

# Run tests
echo ""
echo "🧪 Running E2E tests..."
npm run test:e2e

# Generate report
echo ""
echo "📊 Test Results:"
if [ -d "playwright-report" ]; then
  echo "  HTML Report: playwright-report/index.html"
fi
if [ -d "test-results" ]; then
  echo "  Artifacts: test-results/"
fi

echo ""
echo "✅ CI Local Run Complete"
