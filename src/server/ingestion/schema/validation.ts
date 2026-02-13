import { z, ZodSchema, ZodError } from 'zod';

/**
 * Schema Validation Utilities
 * Provides validation with detailed error reporting and trace tracking
 */

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
  traceId: string;
}

export interface ValidationError {
  path: (string | number)[];
  message: string;
  code: string;
  received?: unknown;
  expected?: string;
}

export interface ValidationContext {
  source: string;
  operation: string;
  traceId: string;
  timestamp: Date;
}

/**
 * Custom error for validation failures
 */
export class SchemaValidationError extends Error {
  constructor(
    message: string,
    public errors: ValidationError[],
    public traceId: string,
    public source: string
  ) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

/**
 * Transform ZodError into our ValidationError format
 */
function transformZodError(error: ZodError): ValidationError[] {
  return error.errors.map((err) => ({
    path: err.path,
    message: err.message,
    code: err.code,
    received: (err as { received?: unknown }).received,
    expected: (err as { expected?: string }).expected,
  }));
}

/**
 * Validate data against a Zod schema
 * Returns detailed validation result with trace tracking
 */
export function validateSchema<T>(
  schema: ZodSchema<T>,
  data: unknown,
  context: ValidationContext
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
      traceId: context.traceId,
    };
  }

  const errors = transformZodError(result.error);

  return {
    success: false,
    errors,
    traceId: context.traceId,
  };
}

/**
 * Validate data and throw on failure
 */
export function validateSchemaOrThrow<T>(
  schema: ZodSchema<T>,
  data: unknown,
  context: ValidationContext
): T {
  const result = validateSchema(schema, data, context);

  if (!result.success) {
    throw new SchemaValidationError(
      `Validation failed for ${context.source}: ${result.errors?.map((e) => e.message).join(', ')}`,
      result.errors || [],
      context.traceId,
      context.source
    );
  }

  return result.data as T;
}

/**
 * Async validation for streaming data or external sources
 */
export async function validateStream<T>(
  schema: ZodSchema<T>,
  dataStream: AsyncIterable<unknown>,
  context: ValidationContext,
  options?: {
    maxErrors?: number;
    continueOnError?: boolean;
  }
): Promise<{
  valid: T[];
  invalid: { data: unknown; errors: ValidationError[] }[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    traceId: string;
  };
}> {
  const valid: T[] = [];
  const invalid: { data: unknown; errors: ValidationError[] }[] = [];
  let total = 0;
  const maxErrors = options?.maxErrors ?? 100;
  const continueOnError = options?.continueOnError ?? true;

  try {
    for await (const data of dataStream) {
      total++;
      const result = validateSchema(schema, data, {
        ...context,
        traceId: `${context.traceId}-item-${total}`,
      });

      if (result.success) {
        valid.push(result.data as T);
      } else {
        invalid.push({
          data,
          errors: result.errors || [],
        });

        if (!continueOnError && invalid.length >= maxErrors) {
          break;
        }
      }
    }
  } catch (error) {
    // Log stream error but return what we have
    console.error(`Stream validation error [${context.traceId}]:`, error);
  }

  return {
    valid,
    invalid,
    summary: {
      total,
      valid: valid.length,
      invalid: invalid.length,
      traceId: context.traceId,
    },
  };
}

/**
 * Create a validation middleware for pipeline use
 */
export function createValidationMiddleware<T>(
  schema: ZodSchema<T>,
  sourceName: string
) {
  return (data: unknown, traceId: string): ValidationResult<T> => {
    return validateSchema(schema, data, {
      source: sourceName,
      operation: 'middleware-validation',
      traceId,
      timestamp: new Date(),
    });
  };
}

/**
 * Partial validation - allows partial data updates
 * Only works with ZodObject schemas
 */
export function validatePartial<T extends Record<string, unknown>>(
  schema: z.ZodObject<z.ZodRawShape>,
  data: Partial<T>,
  context: ValidationContext
): ValidationResult<Partial<T>> {
  const partialSchema = schema.partial();
  return validateSchema(partialSchema, data, context) as ValidationResult<Partial<T>>;
}

/**
 * Generate validation report
 */
export function generateValidationReport(
  results: ValidationResult<unknown>[],
  context: ValidationContext
): {
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
  };
  failures: { index: number; errors: ValidationError[]; traceId: string }[];
  traceId: string;
} {
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const failures = results
    .map((r, index) => ({ r, index }))
    .filter(({ r }) => !r.success)
    .map(({ r, index }) => ({
      index,
      errors: r.errors || [],
      traceId: r.traceId,
    }));

  return {
    summary: {
      total: results.length,
      passed,
      failed,
      passRate: results.length > 0 ? passed / results.length : 0,
    },
    failures,
    traceId: context.traceId,
  };
}

/**
 * Check if an error is a SchemaValidationError
 */
export function isSchemaValidationError(error: unknown): error is SchemaValidationError {
  return error instanceof SchemaValidationError;
}
