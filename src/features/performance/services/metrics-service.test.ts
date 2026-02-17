/**
 * Unit Tests for Performance Metrics Service
 * Story 4.1: Creer la vue Performance avec historique des recommandations
 * 
 * Tests date validation and cache invalidation functions
 */

import { describe, it, expect } from 'vitest';

import { getDefaultDateRange, isValidDateRange } from './metrics-service';

describe('Performance Metrics Service', () => {
  describe('getDefaultDateRange', () => {
    it('should return a valid date range', () => {
      // Act
      const result = getDefaultDateRange();

      // Assert
      expect(result.fromDate).toBeDefined();
      expect(result.toDate).toBeDefined();
      // Compare as dates
      expect(new Date(result.fromDate).getTime()).toBeLessThanOrEqual(new Date(result.toDate).getTime());
      expect(result.fromDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result.toDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return a date range approximately 30 days apart', () => {
      // Act
      const result = getDefaultDateRange();
      const fromDate = new Date(result.fromDate);
      const toDate = new Date(result.toDate);
      const diffDays = Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));

      // Assert - should be around 30 days
      expect(diffDays).toBeGreaterThanOrEqual(29);
      expect(diffDays).toBeLessThanOrEqual(31);
    });
  });

  describe('isValidDateRange', () => {
    it('should return true for valid date range', () => {
      expect(isValidDateRange('2026-01-01', '2026-01-31')).toBe(true);
    });

    it('should return true for same day date range', () => {
      expect(isValidDateRange('2026-01-15', '2026-01-15')).toBe(true);
    });

    it('should return true for null dates (optional)', () => {
      expect(isValidDateRange(null, null)).toBe(true);
      expect(isValidDateRange(undefined, undefined)).toBe(true);
      expect(isValidDateRange(null, '2026-01-31')).toBe(true);
      expect(isValidDateRange('2026-01-01', null)).toBe(true);
    });

    it('should return false for invalid date strings', () => {
      expect(isValidDateRange('not-a-date', '2026-01-31')).toBe(false);
    });

    it('should return false when fromDate is after toDate', () => {
      expect(isValidDateRange('2026-01-31', '2026-01-01')).toBe(false);
    });
  });
});
