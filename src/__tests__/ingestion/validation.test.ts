import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  validateSchema,
  validateSchemaOrThrow,
  SchemaValidationError,
} from '../../server/ingestion/schema/validation';

describe('Schema Validation', () => {
  const testSchema = z.object({
    id: z.number(),
    name: z.string(),
    active: z.boolean().optional(),
  });

  const context = {
    source: 'test',
    operation: 'test-validation',
    traceId: 'test-trace-id',
    timestamp: new Date(),
  };

  describe('validateSchema', () => {
    it('should validate valid data', () => {
      const data = { id: 1, name: 'Test' };
      const result = validateSchema(testSchema, data, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
      expect(result.traceId).toBe('test-trace-id');
    });

    it('should reject invalid data', () => {
      const data = { id: 'not-a-number', name: 'Test' };
      const result = validateSchema(testSchema, data, context);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it('should include validation errors', () => {
      const data = { id: 'invalid', name: 123 };
      const result = validateSchema(testSchema, data, context);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBe(2); // Both fields invalid
    });

    it('should validate data with optional fields', () => {
      const data = { id: 1, name: 'Test', active: true };
      const result = validateSchema(testSchema, data, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(data);
    });
  });

  describe('validateSchemaOrThrow', () => {
    it('should return data for valid input', () => {
      const data = { id: 1, name: 'Test' };
      const result = validateSchemaOrThrow(testSchema, data, context);

      expect(result).toEqual(data);
    });

    it('should throw SchemaValidationError for invalid data', () => {
      const data = { id: 'invalid', name: 'Test' };

      expect(() => validateSchemaOrThrow(testSchema, data, context)).toThrow(
        SchemaValidationError
      );
    });

    it('should include error details in thrown exception', () => {
      const data = { id: 'invalid' };

      try {
        validateSchemaOrThrow(testSchema, data, context);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaValidationError);
        if (error instanceof SchemaValidationError) {
          expect(error.traceId).toBe('test-trace-id');
          expect(error.source).toBe('test');
          expect(error.errors).toBeDefined();
          expect(error.errors.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('nested object validation', () => {
    const nestedSchema = z.object({
      user: z.object({
        id: z.number(),
        profile: z.object({
          name: z.string(),
          age: z.number().optional(),
        }),
      }),
    });

    it('should validate nested objects', () => {
      const data = {
        user: {
          id: 1,
          profile: {
            name: 'Test',
            age: 25,
          },
        },
      };

      const result = validateSchema(nestedSchema, data, context);
      expect(result.success).toBe(true);
    });

    it('should report errors for nested invalid data', () => {
      const data = {
        user: {
          id: 1,
          profile: {
            name: 123, // Should be string
          },
        },
      };

      const result = validateSchema(nestedSchema, data, context);
      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.path.includes('profile'))).toBe(true);
    });
  });

  describe('array validation', () => {
    const arraySchema = z.array(
      z.object({
        id: z.number(),
        value: z.string(),
      })
    );

    it('should validate arrays', () => {
      const data = [
        { id: 1, value: 'a' },
        { id: 2, value: 'b' },
      ];

      const result = validateSchema(arraySchema, data, context);
      expect(result.success).toBe(true);
    });

    it('should report errors with array indices', () => {
      const data = [
        { id: 1, value: 'a' },
        { id: 'invalid', value: 'b' },
      ];

      const result = validateSchema(arraySchema, data, context);
      expect(result.success).toBe(false);
      expect(result.errors?.some((e) => e.path.includes(1))).toBe(true);
    });
  });
});
