# ML Canonical Workflow

This repository contains multiple historical ML scripts (TypeScript and Python).
To reduce operational risk, use only the canonical command path below.

## Canonical Commands

- Install and verify environment: `npm run ml:install`
- Fetch data: `npm run ml:fetch-data`
- Train and activate model: `npm run ml:train`
- Check active model and metrics: `npm run ml:status`

## Operational Rule

- Use `scripts/ml-cli.js` as the single entrypoint for ML operations.
- Do not run legacy scripts directly unless debugging an incident.

## Legacy Scripts

- Scripts named with version suffixes (`*-v2*`, `*-v3*`) or duplicated train/predict variants are considered legacy.
- Keep them only for reproducibility and forensic analysis.

Legacy aliases are explicitly namespaced in `package.json`:

- `npm run ml:legacy:train-py`
- `npm run ml:legacy:train-v2`
- `npm run ml:legacy:train-v3`

Legacy commands require explicit opt-in:

- `LEGACY_ML_SCRIPTS=true npm run ml:legacy:train-py`
- `LEGACY_ML_SCRIPTS=true npm run ml:legacy:train-v2`
- `LEGACY_ML_SCRIPTS=true npm run ml:legacy:train-v3`

## Keep / Deprecate / Remove Matrix

- `scripts/ml-cli.js` -> keep (canonical entrypoint)
- `scripts/install-ml-system.ts` -> keep (provisioning flow)
- `scripts/train-ml-model-full.ts` -> keep (primary training flow)
- `scripts/show-ml-stats.ts` -> keep (observability)
- `scripts/ml-legacy-wrapper.js` -> keep (safety guard for legacy execution)
- `scripts/train-ml-model.ts` -> deprecate (compat wrapper)
- `scripts/train-ml-model.py` -> deprecate (legacy)
- `scripts/train-ml-model-v2.py` -> deprecate (legacy)
- `scripts/train-ml-model-v3.py` -> deprecate (legacy)

Removal should happen only after two stable release cycles without runtime dependency.

## Rollback

- If an incident requires immediate legacy execution, set `LEGACY_ML_SCRIPTS=true` for the emergency run only.
- Remove the environment variable after remediation to restore default safeguards.

## CI/CD Guidance

- CI should validate app quality gates (`lint`, `typecheck`, contract tests, build).
- CI enforces ML governance with `npm run check:ml-governance`.
- ML training should run in dedicated jobs or scheduled pipelines, not in PR validation.
