import { z } from 'zod';

/**
 * Odds Data Schemas for validation
 * Defines the structure of data coming from odds providers
 */

// Market type enum
export const MarketTypeSchema = z.enum([
  'h2h',           // Moneyline
  'spreads',       // Point spread
  'totals',        // Over/Under
  'player_props',  // Player prop bets
  'team_props',    // Team prop bets
  'futures',       // Futures bets
]);

// Odds format
export const OddsFormatSchema = z.enum(['american', 'decimal', 'fractional']);

// Outcome schema (for h2h, spreads, totals)
export const OutcomeSchema = z.object({
  name: z.string(),
  price: z.number(), // American odds format (e.g., -110, +150)
  point: z.number().optional(), // For spreads and totals
  probability: z.number().min(0).max(1).optional(), // Calculated probability
});

// Market schema
export const MarketSchema = z.object({
  key: MarketTypeSchema,
  outcomes: z.array(OutcomeSchema),
  lastUpdate: z.string().datetime(),
});

// Bookmaker schema
export const BookmakerSchema = z.object({
  key: z.string(), // Bookmaker identifier (e.g., 'draftkings', 'fanduel')
  title: z.string(), // Display name
  lastUpdate: z.string().datetime(),
  markets: z.array(MarketSchema),
});

// Sport schema
export const SportSchema = z.object({
  key: z.string(),
  group: z.string(),
  title: z.string(),
  description: z.string(),
  active: z.boolean(),
  hasOutrights: z.boolean(),
});

// Match/Game schema for odds
export const OddsMatchSchema = z.object({
  id: z.string(),
  sportKey: z.string(),
  sportTitle: z.string(),
  commenceTime: z.string().datetime(),
  homeTeam: z.string(),
  awayTeam: z.string(),
  bookmakers: z.array(BookmakerSchema),
});

// Odds API Response
export const OddsResponseSchema = z.object({
  data: z.array(OddsMatchSchema),
  meta: z.object({
    total: z.number(),
    page: z.number().optional(),
    perPage: z.number().optional(),
    timestamp: z.string().datetime(),
  }),
});

// Historical odds schema
export const HistoricalOddsSchema = z.object({
  matchId: z.string(),
  timestamp: z.string().datetime(),
  bookmaker: z.string(),
  market: MarketTypeSchema,
  outcomes: z.array(OutcomeSchema),
  lineMovement: z.array(z.object({
    timestamp: z.string().datetime(),
    price: z.number(),
    point: z.number().optional(),
  })).optional(),
});

// Odds snapshot for drift detection
export const OddsSnapshotSchema = z.object({
  matchId: z.string(),
  timestamp: z.string().datetime(),
  bookmakers: z.array(z.object({
    key: z.string(),
    markets: z.array(z.object({
      key: MarketTypeSchema,
      outcomes: z.array(z.object({
        name: z.string(),
        price: z.number(),
        point: z.number().optional(),
      })),
    })),
  })),
});

// Error response schema
export const OddsErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  code: z.number(),
});

// Type exports
export type MarketType = z.infer<typeof MarketTypeSchema>;
export type OddsFormat = z.infer<typeof OddsFormatSchema>;
export type Outcome = z.infer<typeof OutcomeSchema>;
export type Market = z.infer<typeof MarketSchema>;
export type Bookmaker = z.infer<typeof BookmakerSchema>;
export type Sport = z.infer<typeof SportSchema>;
export type OddsMatch = z.infer<typeof OddsMatchSchema>;
export type OddsResponse = z.infer<typeof OddsResponseSchema>;
export type HistoricalOdds = z.infer<typeof HistoricalOddsSchema>;
export type OddsSnapshot = z.infer<typeof OddsSnapshotSchema>;
export type OddsErrorResponse = z.infer<typeof OddsErrorResponseSchema>;
