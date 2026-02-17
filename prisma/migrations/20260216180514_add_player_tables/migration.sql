-- DropIndex
DROP INDEX "games_season_idx";

-- AlterTable
ALTER TABLE "games" ADD COLUMN     "duration" INTEGER,
ADD COLUMN     "is_playoff_game" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "playoff_round" TEXT,
ADD COLUMN     "referees" JSONB;

-- CreateTable
CREATE TABLE "players" (
    "id" SERIAL NOT NULL,
    "nba_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "jersey_number" TEXT,
    "position" TEXT,
    "height" TEXT,
    "weight" INTEGER,
    "birth_date" TIMESTAMP(3),
    "college" TEXT,
    "country" TEXT,
    "draft_year" INTEGER,
    "draft_round" INTEGER,
    "draft_number" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_teams" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),

    CONSTRAINT "player_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_game_stats" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "game_id" TEXT NOT NULL,
    "team_id" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "minutes" INTEGER,
    "minutes_float" DOUBLE PRECISION,
    "points" INTEGER NOT NULL DEFAULT 0,
    "rebounds" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "steals" INTEGER NOT NULL DEFAULT 0,
    "blocks" INTEGER NOT NULL DEFAULT 0,
    "turnovers" INTEGER NOT NULL DEFAULT 0,
    "fg_made" INTEGER NOT NULL DEFAULT 0,
    "fg_attempted" INTEGER NOT NULL DEFAULT 0,
    "fg_pct" DOUBLE PRECISION,
    "three_made" INTEGER NOT NULL DEFAULT 0,
    "three_attempted" INTEGER NOT NULL DEFAULT 0,
    "three_pct" DOUBLE PRECISION,
    "ft_made" INTEGER NOT NULL DEFAULT 0,
    "ft_attempted" INTEGER NOT NULL DEFAULT 0,
    "ft_pct" DOUBLE PRECISION,
    "plus_minus" INTEGER,
    "offensive_rebounds" INTEGER NOT NULL DEFAULT 0,
    "defensive_rebounds" INTEGER NOT NULL DEFAULT 0,
    "is_starter" BOOLEAN NOT NULL DEFAULT false,
    "did_not_play" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_game_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_season_stats" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "games_started" INTEGER NOT NULL DEFAULT 0,
    "minutes_avg" DOUBLE PRECISION,
    "points_avg" DOUBLE PRECISION,
    "rebounds_avg" DOUBLE PRECISION,
    "assists_avg" DOUBLE PRECISION,
    "steals_avg" DOUBLE PRECISION,
    "blocks_avg" DOUBLE PRECISION,
    "turnovers_avg" DOUBLE PRECISION,
    "fg_pct" DOUBLE PRECISION,
    "three_pct" DOUBLE PRECISION,
    "ft_pct" DOUBLE PRECISION,
    "per" DOUBLE PRECISION,
    "ts_pct" DOUBLE PRECISION,
    "usage_rate" DOUBLE PRECISION,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "total_minutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "player_season_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "injury_reports" (
    "id" SERIAL NOT NULL,
    "player_id" INTEGER NOT NULL,
    "team_id" INTEGER NOT NULL,
    "game_id" TEXT,
    "season" INTEGER NOT NULL,
    "injury_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT,
    "report_date" TIMESTAMP(3) NOT NULL,
    "expected_return" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "injury_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_nba_id_key" ON "players"("nba_id");

-- CreateIndex
CREATE INDEX "players_full_name_idx" ON "players"("full_name");

-- CreateIndex
CREATE INDEX "player_teams_team_id_season_idx" ON "player_teams"("team_id", "season");

-- CreateIndex
CREATE UNIQUE INDEX "player_teams_player_id_team_id_season_key" ON "player_teams"("player_id", "team_id", "season");

-- CreateIndex
CREATE INDEX "player_game_stats_game_id_idx" ON "player_game_stats"("game_id");

-- CreateIndex
CREATE INDEX "player_game_stats_player_id_season_idx" ON "player_game_stats"("player_id", "season");

-- CreateIndex
CREATE INDEX "player_game_stats_team_id_season_idx" ON "player_game_stats"("team_id", "season");

-- CreateIndex
CREATE UNIQUE INDEX "player_game_stats_player_id_game_id_key" ON "player_game_stats"("player_id", "game_id");

-- CreateIndex
CREATE INDEX "player_season_stats_team_id_season_idx" ON "player_season_stats"("team_id", "season");

-- CreateIndex
CREATE UNIQUE INDEX "player_season_stats_player_id_team_id_season_key" ON "player_season_stats"("player_id", "team_id", "season");

-- CreateIndex
CREATE INDEX "injury_reports_player_id_idx" ON "injury_reports"("player_id");

-- CreateIndex
CREATE INDEX "injury_reports_team_id_season_idx" ON "injury_reports"("team_id", "season");

-- CreateIndex
CREATE INDEX "injury_reports_report_date_idx" ON "injury_reports"("report_date");

-- CreateIndex
CREATE INDEX "games_season_season_type_idx" ON "games"("season", "season_type");

-- AddForeignKey
ALTER TABLE "box_scores" ADD CONSTRAINT "box_scores_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_teams" ADD CONSTRAINT "player_teams_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_game_stats" ADD CONSTRAINT "player_game_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_game_stats" ADD CONSTRAINT "player_game_stats_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_season_stats" ADD CONSTRAINT "player_season_stats_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "injury_reports" ADD CONSTRAINT "injury_reports_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
