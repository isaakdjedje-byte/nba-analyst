import { describe, it, expect } from 'vitest';
import {
  OddsMatchSchema,
  SportSchema,
  BookmakerSchema,
  MarketSchema,
  OutcomeSchema,
  HistoricalOddsSchema,
} from '../../server/ingestion/schema/odds-schemas';

describe('Odds Schema Validation', () => {
  describe('OutcomeSchema', () => {
    it('should validate a valid outcome', () => {
      const validOutcome = {
        name: 'Los Angeles Lakers',
        price: -150,
        point: 5.5,
        probability: 0.6,
      };

      const result = OutcomeSchema.safeParse(validOutcome);
      expect(result.success).toBe(true);
    });

    it('should validate outcome without optional fields', () => {
      const minimalOutcome = {
        name: 'Golden State Warriors',
        price: 200,
      };

      const result = OutcomeSchema.safeParse(minimalOutcome);
      expect(result.success).toBe(true);
    });
  });

  describe('MarketSchema', () => {
    it('should validate a valid market', () => {
      const validMarket = {
        key: 'spreads',
        outcomes: [
          { name: 'Team A', price: -110, point: -5.5 },
          { name: 'Team B', price: -110, point: 5.5 },
        ],
        lastUpdate: '2024-01-15T18:00:00Z',
      };

      const result = MarketSchema.safeParse(validMarket);
      expect(result.success).toBe(true);
    });

    it('should reject invalid market key', () => {
      const invalidMarket = {
        key: 'invalid_market',
        outcomes: [],
        lastUpdate: '2024-01-15T18:00:00Z',
      };

      const result = MarketSchema.safeParse(invalidMarket);
      expect(result.success).toBe(false);
    });
  });

  describe('BookmakerSchema', () => {
    it('should validate a valid bookmaker', () => {
      const validBookmaker = {
        key: 'draftkings',
        title: 'DraftKings',
        lastUpdate: '2024-01-15T18:00:00Z',
        markets: [
          {
            key: 'h2h',
            outcomes: [
              { name: 'Team A', price: -150 },
              { name: 'Team B', price: 130 },
            ],
            lastUpdate: '2024-01-15T18:00:00Z',
          },
        ],
      };

      const result = BookmakerSchema.safeParse(validBookmaker);
      expect(result.success).toBe(true);
    });
  });

  describe('OddsMatchSchema', () => {
    it('should validate a valid odds match', () => {
      const validMatch = {
        id: 'match-123',
        sportKey: 'basketball_nba',
        sportTitle: 'NBA',
        commenceTime: '2024-01-15T20:00:00Z',
        homeTeam: 'Los Angeles Lakers',
        awayTeam: 'Golden State Warriors',
        bookmakers: [
          {
            key: 'draftkings',
            title: 'DraftKings',
            lastUpdate: '2024-01-15T18:00:00Z',
            markets: [
              {
                key: 'h2h',
                outcomes: [
                  { name: 'Los Angeles Lakers', price: -150 },
                  { name: 'Golden State Warriors', price: 130 },
                ],
                lastUpdate: '2024-01-15T18:00:00Z',
              },
            ],
          },
        ],
      };

      const result = OddsMatchSchema.safeParse(validMatch);
      expect(result.success).toBe(true);
    });

    it('should reject match with invalid date format', () => {
      const invalidMatch = {
        id: 'match-123',
        sportKey: 'basketball_nba',
        sportTitle: 'NBA',
        commenceTime: 'not-a-date',
        homeTeam: 'Team A',
        awayTeam: 'Team B',
        bookmakers: [],
      };

      const result = OddsMatchSchema.safeParse(invalidMatch);
      expect(result.success).toBe(false);
    });
  });

  describe('SportSchema', () => {
    it('should validate a valid sport', () => {
      const validSport = {
        key: 'basketball_nba',
        group: 'Basketball',
        title: 'NBA',
        description: 'US Basketball',
        active: true,
        hasOutrights: false,
      };

      const result = SportSchema.safeParse(validSport);
      expect(result.success).toBe(true);
    });
  });

  describe('HistoricalOddsSchema', () => {
    it('should validate historical odds data', () => {
      const validHistorical = {
        matchId: 'match-123',
        timestamp: '2024-01-15T12:00:00Z',
        bookmaker: 'draftkings',
        market: 'spreads',
        outcomes: [
          { name: 'Team A', price: -110, point: -5.5 },
          { name: 'Team B', price: -110, point: 5.5 },
        ],
        lineMovement: [
          {
            timestamp: '2024-01-15T10:00:00Z',
            price: -105,
            point: -5,
          },
        ],
      };

      const result = HistoricalOddsSchema.safeParse(validHistorical);
      expect(result.success).toBe(true);
    });
  });
});
