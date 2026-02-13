import { z } from 'zod';

/**
 * NBA Data Schemas for validation
 * Defines the structure of data coming from NBA CDN/API
 */

// Team schema
export const TeamSchema = z.object({
  id: z.number(),
  name: z.string(),
  city: z.string(),
  abbreviation: z.string().length(3),
  conference: z.enum(['East', 'West']),
  division: z.string(),
});

// Player schema
export const PlayerSchema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  jerseyNumber: z.string().optional(),
  position: z.enum(['G', 'F', 'C', 'G-F', 'F-C', 'F-G', 'C-F', '']).optional(),
  teamId: z.number(),
});

// Game status schema
export const GameStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'halftime',
  'completed',
  'postponed',
  'cancelled',
]);

// Game schema
export const GameSchema = z.object({
  id: z.number(),
  season: z.number(),
  seasonType: z.enum(['Regular Season', 'Pre Season', 'Playoffs', 'All Star']),
  status: GameStatusSchema,
  date: z.string().datetime(),
  homeTeam: TeamSchema,
  awayTeam: TeamSchema,
  homeScore: z.number().optional(),
  awayScore: z.number().optional(),
  arena: z.string().optional(),
  attendance: z.number().optional(),
});

// Box score statistics
export const PlayerStatsSchema = z.object({
  playerId: z.number(),
  minutes: z.number().optional(),
  points: z.number().default(0),
  rebounds: z.number().default(0),
  assists: z.number().default(0),
  steals: z.number().default(0),
  blocks: z.number().default(0),
  turnovers: z.number().default(0),
  fieldGoalsMade: z.number().default(0),
  fieldGoalsAttempted: z.number().default(0),
  threePointersMade: z.number().default(0),
  threePointersAttempted: z.number().default(0),
  freeThrowsMade: z.number().default(0),
  freeThrowsAttempted: z.number().default(0),
});

export const TeamStatsSchema = z.object({
  teamId: z.number(),
  points: z.number(),
  rebounds: z.number(),
  assists: z.number(),
  steals: z.number(),
  blocks: z.number(),
  turnovers: z.number(),
  fieldGoalPercentage: z.number(),
  threePointPercentage: z.number(),
  freeThrowPercentage: z.number(),
});

// Box score schema
export const BoxScoreSchema = z.object({
  gameId: z.number(),
  homeTeam: TeamStatsSchema,
  awayTeam: TeamStatsSchema,
  homePlayers: z.array(PlayerStatsSchema),
  awayPlayers: z.array(PlayerStatsSchema),
});

// Schedule schema
export const ScheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  games: z.array(GameSchema),
  count: z.number(),
});

// NBA API Response wrapper
export const NBAResponseSchema = z.object({
  data: z.unknown(),
  meta: z.object({
    total_pages: z.number().optional(),
    current_page: z.number().optional(),
    next_page: z.number().nullable().optional(),
    per_page: z.number().optional(),
    total_count: z.number().optional(),
  }).optional(),
});

// Type exports
export type Team = z.infer<typeof TeamSchema>;
export type Player = z.infer<typeof PlayerSchema>;
export type Game = z.infer<typeof GameSchema>;
export type GameStatus = z.infer<typeof GameStatusSchema>;
export type PlayerStats = z.infer<typeof PlayerStatsSchema>;
export type TeamStats = z.infer<typeof TeamStatsSchema>;
export type BoxScore = z.infer<typeof BoxScoreSchema>;
export type Schedule = z.infer<typeof ScheduleSchema>;
export type NBAResponse = z.infer<typeof NBAResponseSchema>;
