-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'support', 'ops', 'admin');

-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('pending', 'processing', 'completed', 'expired');

-- CreateEnum
CREATE TYPE "DailyRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'degraded');

-- CreateEnum
CREATE TYPE "PredictionStatus" AS ENUM ('pending', 'processed', 'confirmed', 'cancelled');

-- CreateEnum
CREATE TYPE "decision_status" AS ENUM ('PICK', 'NO_BET', 'HARD_STOP');

-- CreateEnum
CREATE TYPE "run_status" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "session_token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "mfa_secret" TEXT,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_backup_codes" TEXT NOT NULL DEFAULT '[]',
    "mfa_enrolled_at" TIMESTAMP(3),
    "mfa_last_verified_at" TIMESTAMP(3),
    "mfa_disable_requested_at" TIMESTAMP(3),
    "data_export_requested_at" TIMESTAMP(3),
    "data_export_completed_at" TIMESTAMP(3),
    "deletion_requested_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "deletion_reason" TEXT,
    "privacy_policy_accepted_at" TIMESTAMP(3),
    "privacy_policy_version" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_exports" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "file_path" TEXT,
    "status" "DataExportStatus" NOT NULL DEFAULT 'pending',
    "data_hash" TEXT,

    CONSTRAINT "data_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_retention_policies" (
    "id" TEXT NOT NULL,
    "data_type" TEXT NOT NULL,
    "retention_days" INTEGER NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "mfa_setup_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_setup_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_id" TEXT,
    "target_type" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "metadata" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trace_id" TEXT NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_runs" (
    "id" TEXT NOT NULL,
    "run_date" DATE NOT NULL,
    "status" "run_status" NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "total_matches" INTEGER NOT NULL DEFAULT 0,
    "predictions_count" INTEGER NOT NULL DEFAULT 0,
    "picks_count" INTEGER NOT NULL DEFAULT 0,
    "no_bet_count" INTEGER NOT NULL DEFAULT 0,
    "hard_stop_count" INTEGER NOT NULL DEFAULT 0,
    "data_quality_score" DOUBLE PRECISION,
    "errors" TEXT,
    "triggered_by" TEXT NOT NULL,
    "trace_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "predictions" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "match_date" DATE NOT NULL,
    "league" TEXT NOT NULL,
    "home_team" TEXT NOT NULL,
    "away_team" TEXT NOT NULL,
    "winner_prediction" TEXT,
    "score_prediction" TEXT,
    "over_under_prediction" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION NOT NULL,
    "model_version" TEXT NOT NULL,
    "features_hash" TEXT,
    "edge" DOUBLE PRECISION,
    "status" "PredictionStatus" NOT NULL DEFAULT 'pending',
    "user_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "trace_id" TEXT NOT NULL,

    CONSTRAINT "predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_decisions" (
    "id" TEXT NOT NULL,
    "prediction_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "decision_status" NOT NULL,
    "rationale" TEXT NOT NULL,
    "confidence_gate" BOOLEAN NOT NULL,
    "edge_gate" BOOLEAN NOT NULL,
    "drift_gate" BOOLEAN NOT NULL,
    "hard_stop_gate" BOOLEAN NOT NULL,
    "hard_stop_reason" TEXT,
    "recommended_action" TEXT,
    "match_date" DATE NOT NULL,
    "home_team" TEXT NOT NULL,
    "away_team" TEXT NOT NULL,
    "recommended_pick" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "edge" DOUBLE PRECISION,
    "model_version" TEXT NOT NULL,
    "prediction_inputs" JSONB,
    "published_at" TIMESTAMP(3),
    "trace_id" TEXT NOT NULL,
    "executed_at" TIMESTAMP(3) NOT NULL,
    "data_source_fingerprints" JSONB,
    "run_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hard_stop_states" (
    "id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "daily_loss" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "consecutive_losses" INTEGER NOT NULL DEFAULT 0,
    "bankroll_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggered_at" TIMESTAMP(3),
    "trigger_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hard_stop_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_api_keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "scopes" TEXT NOT NULL DEFAULT '[]',
    "rate_limit" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "b2b_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_policy_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "confidence_min" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
    "edge_min" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "max_drift_score" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "api_key_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "b2b_policy_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_policy_profile_history" (
    "id" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "changed_by" TEXT,
    "reason" TEXT,
    "old_value" JSONB,
    "new_value" JSONB,
    "trace_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_policy_profile_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_version_snapshots" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "config_json" JSONB NOT NULL,
    "change_reason" TEXT,
    "is_restore" BOOLEAN NOT NULL DEFAULT false,
    "previous_version_id" TEXT,

    CONSTRAINT "policy_version_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "users_deletion_requested_at_idx" ON "users"("deletion_requested_at");

-- CreateIndex
CREATE INDEX "data_exports_user_id_idx" ON "data_exports"("user_id");

-- CreateIndex
CREATE INDEX "data_exports_status_idx" ON "data_exports"("status");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "mfa_setup_sessions_user_id_key" ON "mfa_setup_sessions"("user_id");

-- CreateIndex
CREATE INDEX "mfa_setup_sessions_user_id_idx" ON "mfa_setup_sessions"("user_id");

-- CreateIndex
CREATE INDEX "mfa_setup_sessions_expires_at_idx" ON "mfa_setup_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_target_id_idx" ON "audit_logs"("target_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "daily_runs_run_date_idx" ON "daily_runs"("run_date");

-- CreateIndex
CREATE INDEX "daily_runs_status_idx" ON "daily_runs"("status");

-- CreateIndex
CREATE INDEX "daily_runs_created_at_idx" ON "daily_runs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "daily_runs_run_date_key" ON "daily_runs"("run_date");

-- CreateIndex
CREATE INDEX "predictions_run_id_idx" ON "predictions"("run_id");

-- CreateIndex
CREATE INDEX "predictions_match_id_idx" ON "predictions"("match_id");

-- CreateIndex
CREATE INDEX "predictions_created_at_idx" ON "predictions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "policy_decisions_prediction_id_key" ON "policy_decisions"("prediction_id");

-- CreateIndex
CREATE INDEX "policy_decisions_run_id_idx" ON "policy_decisions"("run_id");

-- CreateIndex
CREATE INDEX "policy_decisions_status_idx" ON "policy_decisions"("status");

-- CreateIndex
CREATE INDEX "policy_decisions_trace_id_idx" ON "policy_decisions"("trace_id");

-- CreateIndex
CREATE INDEX "policy_decisions_executed_at_idx" ON "policy_decisions"("executed_at");

-- CreateIndex
CREATE INDEX "policy_decisions_match_id_idx" ON "policy_decisions"("match_id");

-- CreateIndex
CREATE INDEX "policy_decisions_match_date_idx" ON "policy_decisions"("match_date");

-- CreateIndex
CREATE INDEX "policy_decisions_published_at_idx" ON "policy_decisions"("published_at");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_api_keys_key_hash_key" ON "b2b_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "b2b_api_keys_is_active_idx" ON "b2b_api_keys"("is_active");

-- CreateIndex
CREATE INDEX "b2b_api_keys_created_at_idx" ON "b2b_api_keys"("created_at");

-- CreateIndex
CREATE INDEX "b2b_policy_profiles_api_key_id_idx" ON "b2b_policy_profiles"("api_key_id");

-- CreateIndex
CREATE INDEX "b2b_policy_profiles_is_active_idx" ON "b2b_policy_profiles"("is_active");

-- CreateIndex
CREATE INDEX "b2b_policy_profiles_created_at_idx" ON "b2b_policy_profiles"("created_at");

-- CreateIndex
CREATE INDEX "b2b_policy_profile_history_profile_id_idx" ON "b2b_policy_profile_history"("profile_id");

-- CreateIndex
CREATE INDEX "b2b_policy_profile_history_created_at_idx" ON "b2b_policy_profile_history"("created_at" DESC);

-- CreateIndex
CREATE INDEX "b2b_policy_profile_history_trace_id_idx" ON "b2b_policy_profile_history"("trace_id");

-- CreateIndex
CREATE UNIQUE INDEX "policy_version_snapshots_version_key" ON "policy_version_snapshots"("version");

-- CreateIndex
CREATE INDEX "policy_version_snapshots_created_at_idx" ON "policy_version_snapshots"("created_at" DESC);

-- CreateIndex
CREATE INDEX "policy_version_snapshots_created_by_idx" ON "policy_version_snapshots"("created_by");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "predictions" ADD CONSTRAINT "predictions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "daily_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_prediction_id_fkey" FOREIGN KEY ("prediction_id") REFERENCES "predictions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "daily_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
