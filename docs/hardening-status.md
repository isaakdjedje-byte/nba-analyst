# Hardening Status

## Scope

This document tracks the security and reliability hardening work completed for the API surface and supporting CI gates.

## Resolved Areas

- Build no longer ignores TypeScript/ESLint errors during production build.
- Authentication routes hardened (`/api/auth/login`, `/api/auth/me`) with legacy bypass removal.
- Decision API auth and pagination validation hardened (`/api/v1/decisions`).
- B2B API scope enforcement added and verified across decisions, profiles, history, and runs routes.
- B2B lookup validation centralized through schema validation (`id`/`traceId` only).
- OpenAPI decision status contract aligned with runtime schema.
- Rate limiter double-consumption bug fixed and covered by regression tests.
- Prediction service database mapping aligned with Prisma schema and covered by unit tests.
- Dev-only ML legacy execution now explicitly gated by `LEGACY_ML_SCRIPTS=true`.
- CI includes consolidated hardening verification gate.

## Verification Commands

- Full hardening gate: `npm run verify:hardening`
- Security/API suite: `npm run test:security`
- B2B docs endpoints: `npm run test:b2b-docs`
- ML core mapping tests: `npm run test:ml-core`
- Security strict typecheck: `npm run typecheck:security`

## Current Test Gate Snapshot

- Security test suite count: 71 tests passing.
- B2B docs suite count: 3 tests passing.
- ML core suite count: 2 tests passing.

## Notes

- The repository currently contains many unrelated in-progress changes; hardening updates were implemented without reverting user work.
- Remaining rollout work should focus on release packaging (atomic commits, PR narrative, staged deployment verification).
