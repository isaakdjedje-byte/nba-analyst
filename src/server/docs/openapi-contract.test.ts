import { describe, expect, it } from 'vitest';
import { generateOpenAPISpec } from './openapi-generator';
import { decisionStatusSchema } from '../../app/api/v1/b2b/schemas';

describe('OpenAPI contract consistency', () => {
  it('keeps DecisionStatus enum in sync with runtime validation schema', () => {
    const spec = generateOpenAPISpec() as {
      components?: {
        schemas?: {
          DecisionStatus?: {
            enum?: string[];
          };
        };
      };
    };

    const openApiEnum = spec.components?.schemas?.DecisionStatus?.enum ?? [];
    const runtimeEnum = decisionStatusSchema.options;

    expect(openApiEnum).toEqual(runtimeEnum);
  });

  it('documents core B2B endpoints', () => {
    const spec = generateOpenAPISpec() as {
      paths?: Record<string, unknown>;
    };

    expect(spec.paths).toBeDefined();
    expect(spec.paths).toHaveProperty('/api/v1/b2b/decisions');
    expect(spec.paths).toHaveProperty('/api/v1/b2b/profiles');
    expect(spec.paths).toHaveProperty('/api/v1/b2b/runs');
  });
});
