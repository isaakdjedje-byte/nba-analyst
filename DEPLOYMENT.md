# Deployment Guide

## Prerequisites

- Node.js >= 20
- npm >= 10
- PostgreSQL database
- Python 3.10+ (for Option A / Hybrid with Python)
- Python packages: `fastapi`, `uvicorn`, `joblib`, `numpy`, `scikit-learn`

## Environment

Required variables:

- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - auth secret
- `NEXTAUTH_URL` - base app URL

Optional ML variable:

- `PYTHON_API_URL` (default `http://localhost:8000`)

## Installation Steps

1. Install Node dependencies: `npm install`
2. Generate Prisma client: `npm run prisma:generate`
3. Run migrations: `npm run prisma:migrate`
4. Start web app: `npm run dev` (or `npm run build && npm run start`)

If you deploy with Python V3:

5. Start Python API: `python python-service/app.py`
6. Verify health: `curl http://localhost:8000/health`

## Production Modes

- TypeScript-only mode:
  - Lowest infra complexity
  - Works without Python service
- Hybrid mode:
  - Requires Python service for escalations
  - Falls back automatically to TypeScript on Python outage
- Python-first mode:
  - Use for max-accuracy workloads where extra latency is acceptable

## Post-Deploy Validation

1. `npx tsx scripts/complete-benchmark.ts 120`
2. `npx tsx scripts/calibrate-hybrid-system.ts 200`
3. `npx tsx scripts/load-failover-monitoring.ts`

Check generated artifacts:

- `final-benchmark-results.json`
- `FINAL_BENCHMARK_REPORT.md`
- `hybrid-calibration-results.json`
- `load-failover-report.json`
