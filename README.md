# NBA Analyst - Production ML Decision Platform

NBA Analyst combines historical NBA data, TypeScript ML models, and a Python V3 microservice to generate game winner predictions with production guardrails.

## Architecture Overview

- Option A - `Python V3` (FastAPI + sklearn): highest raw accuracy profile, higher latency.
- Option B - `TypeScript LogisticRegression`: lowest latency, single-stack deployment.
- Option C - `TypeScript XGBoost`: native boosted trees, now trainable on real games.
- Option D - `Hybrid`: TypeScript-first routing with Python escalation on confidence thresholds.

Core layers:

- Data layer: PostgreSQL via Prisma (`games`, `box_scores`, `ml_models`, policy tables).
- Feature layer: TypeScript feature engineering for model-ready vectors.
- Inference layer: TypeScript models + Python FastAPI service (`python-service/app.py`).
- Governance layer: policy decisions (`PICK`, `NO_BET`, `HARD_STOP`) and decision auditability.

## Fast Start

1. Install dependencies: `npm install`
2. Generate Prisma client: `npm run prisma:generate`
3. Start app: `npm run dev`
4. Optional Python service for Option A/Hybrid: `python python-service/app.py`

## ML Operations

- Benchmark (100+ real games): `npx tsx scripts/complete-benchmark.ts 120`
- Train XGBoost on real data: `npx tsx scripts/train-xgboost-ts.ts 969`
- Calibrate hybrid thresholds: `npx tsx scripts/calibrate-hybrid-system.ts 200`
- Load/failover/monitoring validation: `npx tsx scripts/load-failover-monitoring.ts`
- Run continuous learning cycle (resolve outcomes + monitor + optional retrain): `npx tsx scripts/run-continuous-learning.ts`

### Continuous Learning (Daily Feedback Loop)

The scheduler now runs a continuous-learning cycle after each daily run:

1. Resolves pending prediction outcomes against completed real games.
2. Recomputes weekly monitoring metrics and health alerts.
3. Optionally retrains a challenger model on schedule and promotes only if better.

Environment variables:

- `CONTINUOUS_LEARNING_ENABLED=true|false` (default: `true`)
- `OUTCOME_RESOLUTION_LIMIT=500` (default: `500`)
- `AUTO_RETRAIN_ENABLED=true|false` (default: `false`)
- `AUTO_RETRAIN_DAY_OF_WEEK_UTC=1` (0=Sun ... 6=Sat, default: Monday)
- `AUTO_RETRAIN_LOOKBACK_DAYS=730` (default: 2 years)
- `AUTO_RETRAIN_MIN_RESOLVED=150` (minimum resolved predictions to allow retrain)
- `AUTO_RETRAIN_MIN_ACCURACY_IMPROVEMENT=0.005`
- `AUTO_RETRAIN_MIN_CALIBRATION_IMPROVEMENT=0.002`

## Documentation

- Deployment guide: `DEPLOYMENT.md`
- API usage: `API_GUIDE.md`
- Technical architecture: `ARCHITECTURE.md`

## Quality Gates

- Consolidated hardening verification: `npm run verify:hardening`
- Security/API suite only: `npm run test:security`
- B2B documentation endpoints: `npm run test:b2b-docs`
- ML core mapping checks: `npm run test:ml-core`
