-- CreateTable
CREATE TABLE "prediction_logs" (
    "id" TEXT NOT NULL,
    "prediction_id" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "features" JSONB NOT NULL,
    "predicted_probability" DOUBLE PRECISION NOT NULL,
    "predicted_winner" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "actual_winner" TEXT,
    "home_score" INTEGER,
    "away_score" INTEGER,
    "correct" BOOLEAN,
    "resolved_at" TIMESTAMP(3),
    "latency_ms" DOUBLE PRECISION NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "external_id" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "season_type" TEXT NOT NULL,
    "game_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "home_team_id" INTEGER NOT NULL,
    "home_team_name" TEXT NOT NULL,
    "home_team_abbreviation" TEXT NOT NULL,
    "home_team_conference" TEXT NOT NULL,
    "away_team_id" INTEGER NOT NULL,
    "away_team_name" TEXT NOT NULL,
    "away_team_abbreviation" TEXT NOT NULL,
    "away_team_conference" TEXT NOT NULL,
    "home_score" INTEGER,
    "away_score" INTEGER,
    "arena" TEXT,
    "attendance" INTEGER,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "box_scores" (
    "id" TEXT NOT NULL,
    "game_id" TEXT NOT NULL,
    "home_points" INTEGER NOT NULL,
    "home_rebounds" INTEGER NOT NULL,
    "home_assists" INTEGER NOT NULL,
    "home_steals" INTEGER NOT NULL,
    "home_blocks" INTEGER NOT NULL,
    "home_turnovers" INTEGER NOT NULL,
    "home_fg_pct" DOUBLE PRECISION NOT NULL,
    "home_3p_pct" DOUBLE PRECISION NOT NULL,
    "home_ft_pct" DOUBLE PRECISION NOT NULL,
    "away_points" INTEGER NOT NULL,
    "away_rebounds" INTEGER NOT NULL,
    "away_assists" INTEGER NOT NULL,
    "away_steals" INTEGER NOT NULL,
    "away_blocks" INTEGER NOT NULL,
    "away_turnovers" INTEGER NOT NULL,
    "away_fg_pct" DOUBLE PRECISION NOT NULL,
    "away_3p_pct" DOUBLE PRECISION NOT NULL,
    "away_ft_pct" DOUBLE PRECISION NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "box_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ml_models" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "training_data_start" TIMESTAMP(3) NOT NULL,
    "training_data_end" TIMESTAMP(3) NOT NULL,
    "num_training_samples" INTEGER NOT NULL,
    "num_test_samples" INTEGER NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "precision" DOUBLE PRECISION NOT NULL,
    "recall" DOUBLE PRECISION NOT NULL,
    "f1_score" DOUBLE PRECISION NOT NULL,
    "log_loss" DOUBLE PRECISION NOT NULL,
    "auc" DOUBLE PRECISION NOT NULL,
    "calibration_error" DOUBLE PRECISION NOT NULL,
    "weights_hash" TEXT NOT NULL,
    "weights" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "activated_at" TIMESTAMP(3),
    "description" TEXT,

    CONSTRAINT "ml_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_store" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "home_team_id" INTEGER NOT NULL,
    "away_team_id" INTEGER NOT NULL,
    "match_date" TIMESTAMP(3) NOT NULL,
    "features" JSONB NOT NULL,
    "features_hash" TEXT NOT NULL,
    "freshness_score" DOUBLE PRECISION NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_version" TEXT NOT NULL,

    CONSTRAINT "feature_store_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prediction_logs_model_version_idx" ON "prediction_logs"("model_version");

-- CreateIndex
CREATE INDEX "prediction_logs_created_at_idx" ON "prediction_logs"("created_at");

-- CreateIndex
CREATE INDEX "prediction_logs_prediction_id_idx" ON "prediction_logs"("prediction_id");

-- CreateIndex
CREATE INDEX "prediction_logs_correct_idx" ON "prediction_logs"("correct");

-- CreateIndex
CREATE UNIQUE INDEX "games_external_id_key" ON "games"("external_id");

-- CreateIndex
CREATE INDEX "games_game_date_idx" ON "games"("game_date");

-- CreateIndex
CREATE INDEX "games_season_idx" ON "games"("season");

-- CreateIndex
CREATE INDEX "games_home_team_id_idx" ON "games"("home_team_id");

-- CreateIndex
CREATE INDEX "games_away_team_id_idx" ON "games"("away_team_id");

-- CreateIndex
CREATE INDEX "games_status_idx" ON "games"("status");

-- CreateIndex
CREATE UNIQUE INDEX "box_scores_game_id_key" ON "box_scores"("game_id");

-- CreateIndex
CREATE INDEX "box_scores_game_id_idx" ON "box_scores"("game_id");

-- CreateIndex
CREATE UNIQUE INDEX "ml_models_version_key" ON "ml_models"("version");

-- CreateIndex
CREATE INDEX "ml_models_is_active_idx" ON "ml_models"("is_active");

-- CreateIndex
CREATE INDEX "ml_models_created_at_idx" ON "ml_models"("created_at" DESC);

-- CreateIndex
CREATE INDEX "ml_models_algorithm_idx" ON "ml_models"("algorithm");

-- CreateIndex
CREATE INDEX "feature_store_match_date_idx" ON "feature_store"("match_date");

-- CreateIndex
CREATE INDEX "feature_store_home_team_id_away_team_id_idx" ON "feature_store"("home_team_id", "away_team_id");

-- CreateIndex
CREATE INDEX "feature_store_computed_at_idx" ON "feature_store"("computed_at");

-- CreateIndex
CREATE UNIQUE INDEX "feature_store_match_id_key" ON "feature_store"("match_id");
