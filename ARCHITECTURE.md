# Technical Architecture

## System Components

- Web/API app: Next.js + TypeScript
- Data access: Prisma + PostgreSQL
- ML models in TS:
  - `src/server/ml/models/logistic-regression.ts`
  - `src/server/ml/models/xgboost-model.ts`
- Python ML service:
  - `python-service/app.py` (FastAPI + sklearn models)

## Data Flow

1. Historical games are stored in `games` (and optionally `box_scores`).
2. Feature engineering computes model vectors from prior team performance.
3. Inference runs through Option A, B, C, or Hybrid routing.
4. Results and metrics are persisted to `ml_models` and decision tables.

## Option Matrix

- Option A (Python V3):
  - Best when raw accuracy dominates
  - Requires Python runtime and model artifacts
- Option B (TS Logistic Regression):
  - Fastest and easiest deployment
  - Good baseline production model
- Option C (TS XGBoost):
  - More expressive non-linear model
  - Now trainable/activatable from TypeScript
- Hybrid:
  - Latency-aware router with failover
  - Uses confidence thresholds to escalate to Python

## Reliability Controls

- Fallback mode if Python health or calls fail
- Threshold calibration via `scripts/calibrate-hybrid-system.ts`
- Load/failover checks via `scripts/load-failover-monitoring.ts`
- Alert recommendations and runbook in generated docs:
  - `MONITORING_DASHBOARD.md`
  - `EMERGENCY_PROCEDURES.md`

## Key Artifacts

- Benchmark output: `final-benchmark-results.json`, `FINAL_BENCHMARK_REPORT.md`
- XGBoost training output: `xgboost-training-metrics.json`
- Hybrid calibration output: `hybrid-calibration-results.json`, `HYBRID_CALIBRATION_REPORT.md`
- Ops output: `load-failover-report.json`
