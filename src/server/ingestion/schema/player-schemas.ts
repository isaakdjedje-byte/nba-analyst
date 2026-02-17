import { z } from 'zod';

/**
 * Extended NBA Data Schemas with Player Information
 * Phase 2 Implementation - Player Data Enhancement
 */

// Player Profile schema
export const PlayerProfileSchema = z.object({
  id: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  fullName: z.string(),
  jerseyNumber: z.string().optional(),
  position: z.enum(['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'C-F', 'F-C', 'G-F', 'F-G', '']).optional(),
  height: z.string().optional(),
  weight: z.number().optional(),
  birthDate: z.string().datetime().optional(),
  college: z.string().optional(),
  country: z.string().optional(),
  draftYear: z.number().optional(),
  draftRound: z.number().optional(),
  draftNumber: z.number().optional(),
});

// Player Stats Extended schema
export const PlayerGameStatsSchema = z.object({
  playerId: z.number(),
  teamId: z.number(),
  minutes: z.number().optional(),
  minutesFloat: z.number().optional(),
  points: z.number().default(0),
  rebounds: z.number().default(0),
  assists: z.number().default(0),
  steals: z.number().default(0),
  blocks: z.number().default(0),
  turnovers: z.number().default(0),
  fgMade: z.number().default(0),
  fgAttempted: z.number().default(0),
  fgPct: z.number().optional(),
  threeMade: z.number().default(0),
  threeAttempted: z.number().default(0),
  threePct: z.number().optional(),
  ftMade: z.number().default(0),
  ftAttempted: z.number().default(0),
  ftPct: z.number().optional(),
  plusMinus: z.number().optional(),
  offensiveRebounds: z.number().default(0),
  defensiveRebounds: z.number().default(0),
  isStarter: z.boolean().default(false),
  didNotPlay: z.boolean().default(false),
});

// Team Roster schema
export const TeamRosterSchema = z.object({
  teamId: z.number(),
  season: z.number(),
  players: z.array(PlayerProfileSchema),
});

// Injury Report schema
export const InjuryReportSchema = z.object({
  playerId: z.number(),
  teamId: z.number(),
  gameId: z.number().optional(),
  season: z.number(),
  injuryType: z.string(),
  status: z.enum(['out', 'doubtful', 'questionable', 'probable', 'available']),
  description: z.string().optional(),
  reportDate: z.string().datetime(),
  expectedReturn: z.string().datetime().optional(),
});

// Extended Box Score with player stats
export const ExtendedBoxScoreSchema = z.object({
  gameId: z.number(),
  homeTeam: z.object({
    teamId: z.number(),
    stats: z.object({
      points: z.number(),
      rebounds: z.number(),
      assists: z.number(),
      steals: z.number(),
      blocks: z.number(),
      turnovers: z.number(),
      fieldGoalPercentage: z.number(),
      threePointPercentage: z.number(),
      freeThrowPercentage: z.number(),
    }),
    players: z.array(PlayerGameStatsSchema),
  }),
  awayTeam: z.object({
    teamId: z.number(),
    stats: z.object({
      points: z.number(),
      rebounds: z.number(),
      assists: z.number(),
      steals: z.number(),
      blocks: z.number(),
      turnovers: z.number(),
      fieldGoalPercentage: z.number(),
      threePointPercentage: z.number(),
      freeThrowPercentage: z.number(),
    }),
    players: z.array(PlayerGameStatsSchema),
  }),
  officials: z.array(z.object({
    id: z.number().optional(),
    name: z.string(),
  })).optional(),
  attendance: z.number().optional(),
  arena: z.string().optional(),
  duration: z.number().optional(),
});

// Player Season Stats schema
export const PlayerSeasonStatsSchema = z.object({
  playerId: z.number(),
  teamId: z.number(),
  season: z.number(),
  gamesPlayed: z.number(),
  gamesStarted: z.number(),
  minutesAvg: z.number(),
  pointsAvg: z.number(),
  reboundsAvg: z.number(),
  assistsAvg: z.number(),
  stealsAvg: z.number(),
  blocksAvg: z.number(),
  turnoversAvg: z.number(),
  fgPct: z.number(),
  threePct: z.number(),
  ftPct: z.number(),
  per: z.number().optional(),
  tsPct: z.number().optional(),
  usageRate: z.number().optional(),
});

// Type exports
export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;
export type PlayerGameStatsExtended = z.infer<typeof PlayerGameStatsSchema>;
export type TeamRoster = z.infer<typeof TeamRosterSchema>;
export type InjuryReport = z.infer<typeof InjuryReportSchema>;
export type ExtendedBoxScore = z.infer<typeof ExtendedBoxScoreSchema>;
export type PlayerSeasonStats = z.infer<typeof PlayerSeasonStatsSchema>;
