# API Guide

## Python ML Service (Option A)

Base URL: `http://localhost:8000`

### Health

- `GET /health`
- Response: service status and loaded model keys

### Batch Prediction

- `POST /predict`
- Body:

```json
{
  "model_type": "2025",
  "games": [
    {
      "game_id": "abc",
      "features": {
        "elo_diff": 120,
        "elo_diff_norm": 0.65,
        "home_last10_wins": 0.7,
        "away_last10_wins": 0.5,
        "spread_num": -3.5,
        "over_under": 223,
        "ml_home_prob": 0.61,
        "ml_away_prob": 0.39,
        "rest_days_home": 2,
        "rest_days_away": 1,
        "season_norm": 0.87
      }
    }
  ]
}
```

### Single Prediction

- `POST /predict/single`
- Body:

```json
{
  "model_type": "2025",
  "features": {
    "elo_diff": 120,
    "elo_diff_norm": 0.65,
    "home_last10_wins": 0.7,
    "away_last10_wins": 0.5,
    "spread_num": -3.5,
    "over_under": 223,
    "ml_home_prob": 0.61,
    "ml_away_prob": 0.39,
    "rest_days_home": 2,
    "rest_days_away": 1,
    "season_norm": 0.87
  }
}
```

## TypeScript Scripts (Operational API)

- Benchmark: `npx tsx scripts/complete-benchmark.ts 120`
- Train XGBoost: `npx tsx scripts/train-xgboost-ts.ts 969`
- Hybrid calibration: `npx tsx scripts/calibrate-hybrid-system.ts 200`
- Load/failover checks: `npx tsx scripts/load-failover-monitoring.ts`

## Prediction Path (Hybrid)

1. TypeScript model predicts first.
2. If confidence >= `pythonThreshold`, call Python model.
3. If Python confidence >= `pythonMinConfidence`, keep Python result.
4. On Python outage/error, auto-fallback to TypeScript.
