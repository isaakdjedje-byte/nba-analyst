# Emergency Procedures

## Python Service Down

1. Confirm fallback is active (`modelUsed` is `Fallback`/`TypeScript`).
2. Restart Python service: `python python-service/app.py`.
3. Validate `/health` and run a smoke prediction.
4. If still failing, keep TypeScript-only mode and open incident.

## Latency Spike

1. Check P95/P99 and CPU/memory saturation.
2. Temporarily raise `pythonThreshold` to reduce Python calls.
3. Scale Node process horizontally if sustained.

## Accuracy Drift

1. Compare rolling 7-day accuracy against baseline.
2. Retrain TypeScript models on latest games.
3. Re-run calibration and benchmark scripts before activation.