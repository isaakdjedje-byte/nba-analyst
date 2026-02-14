-- Migration: Story 2.4 - Database Schema for Predictions and Decisions
-- Description: Enhanced models for ML outputs and policy decisions

-- ============================================
-- CREATE NEW ENUMS
-- ============================================

-- Create new DecisionStatus enum for policy decisions
CREATE TYPE "decision_status" AS ENUM ('PICK', 'NO_BET', 'HARD_STOP');

-- Create new RunStatus enum for daily runs
CREATE TYPE "run_status" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- ============================================
-- ALTER EXISTING TABLES
-- ============================================

-- Drop old constraints and indexes from predictions table
ALTER TABLE "predictions" DROP CONSTRAINT IF EXISTS "predictions_runId_fkey";
DROP INDEX IF EXISTS "predictions_matchId_idx";
DROP INDEX IF EXISTS "predictions_status_idx";
DROP INDEX IF EXISTS "predictions_matchDate_idx";

-- Alter predictions table: Add new fields, change types
ALTER TABLE "predictions" 
    -- Change ID generation from cuid() to uuid()
    ALTER COLUMN "id" DROP DEFAULT,
    ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid(),
    
    -- Add new ML output fields
    ADD COLUMN IF NOT EXISTS "winner_prediction" VARCHAR(10),
    ADD COLUMN IF NOT EXISTS "score_prediction" VARCHAR(20),
    ADD COLUMN IF NOT EXISTS "over_under_prediction" DECIMAL(5,2),
    ADD COLUMN IF NOT EXISTS "model_version" VARCHAR(50) NOT NULL DEFAULT 'v1.0.0',
    ADD COLUMN IF NOT EXISTS "features_hash" VARCHAR(64),
    
    -- Change confidence to be required
    ALTER COLUMN "confidence" SET NOT NULL,
    
    -- Make runId required (remove nullable)
    ALTER COLUMN "runId" SET NOT NULL,
    ALTER COLUMN "runId" SET DATA TYPE UUID USING "runId"::uuid;

-- Rename old predicted* columns (will be migrated or removed)
ALTER TABLE "predictions" 
    RENAME COLUMN "predictedWinner" TO "_deprecated_predicted_winner",
    RENAME COLUMN "predictedHomeScore" TO "_deprecated_home_score",
    RENAME COLUMN "predictedAwayScore" TO "_deprecated_away_score";

-- Create new indexes for predictions
CREATE INDEX "idx_predictions_run_id" ON "predictions"("runId");
CREATE INDEX "idx_predictions_match_id" ON "predictions"("match_id");
CREATE INDEX "idx_predictions_created_at" ON "predictions"("created_at");

-- ============================================
-- ALTER DAILY_RUNS TABLE
-- ============================================

-- Change ID to UUID
ALTER TABLE "daily_runs" 
    ALTER COLUMN "id" DROP DEFAULT,
    ALTER COLUMN "id" SET DATA TYPE UUID USING "id"::uuid,
    ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Rename status column temporarily and add new enum column
ALTER TABLE "daily_runs" 
    RENAME COLUMN "status" TO "_deprecated_status",
    ADD COLUMN "status" "run_status" NOT NULL DEFAULT 'PENDING';

-- Update status values based on old enum
UPDATE "daily_runs" SET "status" = 'PENDING' WHERE "_deprecated_status" = 'pending';
UPDATE "daily_runs" SET "status" = 'RUNNING' WHERE "_deprecated_status" = 'running';
UPDATE "daily_runs" SET "status" = 'COMPLETED' WHERE "_deprecated_status" = 'completed';
UPDATE "daily_runs" SET "status" = 'FAILED' WHERE "_deprecated_status" = 'failed';

-- Rename old count columns to new names
ALTER TABLE "daily_runs" 
    RENAME COLUMN "processedCount" TO "predictions_count",
    RENAME COLUMN "blockedCount" TO "hard_stop_count";

-- Add new fields to daily_runs
ALTER TABLE "daily_runs" 
    ADD COLUMN IF NOT EXISTS "picks_count" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "data_quality_score" DECIMAL(3,2),
    ADD COLUMN IF NOT EXISTS "errors" TEXT;

-- Update foreign key references to use UUID
ALTER TABLE "daily_runs" 
    ALTER COLUMN "id" TYPE UUID;

-- Create new indexes for daily_runs
CREATE INDEX "idx_daily_runs_run_date" ON "daily_runs"("run_date");
CREATE INDEX "idx_daily_runs_status" ON "daily_runs"("status");
CREATE INDEX "idx_daily_runs_created_at" ON "daily_runs"("created_at");

-- ============================================
-- ALTER POLICY_DECISIONS TABLE
-- ============================================

-- Backup and recreate policy_decisions table with new schema
-- (Due to significant structural changes)

-- Create temporary table with new structure
CREATE TABLE "_policy_decisions_new" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "prediction_id" UUID NOT NULL UNIQUE,
    "match_id" VARCHAR(50) NOT NULL,
    "user_id" VARCHAR(50) NOT NULL,
    "status" "decision_status" NOT NULL,
    "rationale" TEXT NOT NULL,
    "confidence_gate" BOOLEAN NOT NULL,
    "edge_gate" BOOLEAN NOT NULL,
    "drift_gate" BOOLEAN NOT NULL,
    "hard_stop_gate" BOOLEAN NOT NULL,
    "hard_stop_reason" TEXT,
    "recommended_action" TEXT,
    "trace_id" VARCHAR(100) NOT NULL,
    "executed_at" TIMESTAMP NOT NULL,
    "run_id" UUID NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT "fk_policy_decisions_prediction" 
        FOREIGN KEY ("prediction_id") REFERENCES "predictions"("id") ON DELETE CASCADE,
    CONSTRAINT "fk_policy_decisions_run" 
        FOREIGN KEY ("run_id") REFERENCES "daily_runs"("id")
);

-- Create indexes on new table
CREATE INDEX "idx_policy_decisions_run_id" ON "_policy_decisions_new"("run_id");
CREATE INDEX "idx_policy_decisions_status" ON "_policy_decisions_new"("status");
CREATE INDEX "idx_policy_decisions_trace_id" ON "_policy_decisions_new"("trace_id");
CREATE INDEX "idx_policy_decisions_executed_at" ON "_policy_decisions_new"("executed_at");

-- Migrate existing data (if any)
-- Note: Old data structure is different, so we map what we can
INSERT INTO "_policy_decisions_new" (
    "id",
    "prediction_id",
    "match_id", 
    "user_id",
    "status",
    "rationale",
    "confidence_gate",
    "edge_gate",
    "drift_gate",
    "hard_stop_gate",
    "trace_id",
    "executed_at",
    "run_id",
    "created_at"
)
SELECT 
    "id"::uuid,
    "predictionId"::uuid,
    "matchId",
    "userId",
    CASE 
        WHEN "status" = 'blocked' THEN 'HARD_STOP'::"decision_status"
        WHEN "status" = 'no_bet' THEN 'NO_BET'::"decision_status"
        ELSE 'PICK'::"decision_status"
    END,
    COALESCE("blockReason", 'Legacy decision'),
    true, -- default for legacy
    true, -- default for legacy
    true, -- default for legacy
    "status" = 'blocked',
    "traceId",
    "createdAt",
    "runId"::uuid,
    "createdAt"
FROM "policy_decisions"
WHERE "predictionId" IS NOT NULL;

-- Drop old table and rename new one
DROP TABLE "policy_decisions";
ALTER TABLE "_policy_decisions_new" RENAME TO "policy_decisions";

-- ============================================
-- UPDATE FOREIGN KEY CONSTRAINTS
-- ============================================

-- Update predictions foreign key
ALTER TABLE "predictions" 
    DROP CONSTRAINT IF EXISTS "predictions_runId_fkey",
    ADD CONSTRAINT "fk_predictions_run" 
        FOREIGN KEY ("runId") REFERENCES "daily_runs"("id");

-- ============================================
-- CLEANUP
-- ============================================

-- Drop deprecated columns (after data migration confirmation)
-- Uncomment after verifying data migration:
-- ALTER TABLE "predictions" DROP COLUMN "_deprecated_predicted_winner";
-- ALTER TABLE "predictions" DROP COLUMN "_deprecated_home_score";
-- ALTER TABLE "predictions" DROP COLUMN "_deprecated_away_score";
-- ALTER TABLE "daily_runs" DROP COLUMN "_deprecated_status";

-- Drop old enum type (after all references removed)
-- DROP TYPE IF EXISTS "DecisionStatus";

