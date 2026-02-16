/**
 * OpenAPI Specification Generator
 * 
 * Generates OpenAPI 3.0 specification manually for B2B API v1.
 * Using manual approach to avoid build issues with zod-to-openapi.
 * 
 * Story 6.4: Implementer la documentation API OpenAPI et exemples
 */

/**
 * Generate the complete OpenAPI specification
 */
export function generateOpenAPISpec(): object {
  return {
    openapi: '3.1.0',
    info: {
      title: 'NBA Analyst B2B API',
      version: '1.0.0',
      description: `## Overview
NBA Analyst provides a REST API for B2B partners to access betting decisions, policy profiles, and production run information.

## Authentication
All endpoints require API key authentication via the \`X-API-Key\` header.

## Rate Limiting
- Rate limits apply per API key
- Headers: \`RateLimit-Limit\`, \`RateLimit-Remaining\`, \`RateLimit-Reset\`
- Default limit: 1000 requests per hour (configurable)

## Response Format
All responses follow a consistent format:

### Success
\`\`\`json
{
  "data": { ... },
  "meta": {
    "traceId": "b2b-1707926400000-abc123",
    "timestamp": "2026-02-15T10:00:00.000Z"
  }
}
\`\`\`

### Error
\`\`\`json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  },
  "meta": {
    "traceId": "b2b-1707926400000-abc123",
    "timestamp": "2026-02-15T10:00:00.000Z"
  }
}
\`\`\`

## Pagination
List endpoints support pagination via \`page\` and \`limit\` query parameters.

## Date Format
All dates are in ISO 8601 UTC format (YYYY-MM-DDTHH:mm:ss.SSSZ).
`,
      contact: {
        name: 'NBA Analyst Support',
        email: 'support@nbaanalyst.com',
      },
      license: {
        name: 'Proprietary',
        url: 'https://nbaanalyst.com/terms',
      },
    },
    servers: [
      {
        url: 'https://api.nbaanalyst.com',
        description: 'Production server',
      },
      {
        url: 'http://localhost:3000',
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'B2B API key for authentication. Pass via X-API-Key header.',
        },
      },
      schemas: {
        Meta: {
          type: 'object',
          properties: {
            traceId: {
              type: 'string',
              example: 'b2b-1707926400000-abc123',
              description: 'Unique identifier for request tracing',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2026-02-15T10:00:00.000Z',
              description: 'ISO 8601 timestamp of the response',
            },
          },
          required: ['traceId', 'timestamp'],
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1, minimum: 1 },
            limit: { type: 'integer', example: 20, minimum: 1, maximum: 100 },
            total: { type: 'integer', example: 150, minimum: 0 },
            totalPages: { type: 'integer', example: 8, minimum: 0 },
          },
          required: ['page', 'limit', 'total', 'totalPages'],
        },
        ErrorDetail: {
          type: 'object',
          properties: {
            field: { type: 'string', example: 'email' },
            message: { type: 'string', example: 'Invalid email format' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: {
                  type: 'string',
                  example: 'VALIDATION_ERROR',
                  description: 'Error code identifying the type of error',
                },
                message: {
                  type: 'string',
                  example: 'Request validation failed',
                  description: 'Human-readable error message',
                },
                details: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/ErrorDetail' },
                  description: 'Detailed validation errors',
                  example: [
                    { field: 'email', message: 'Invalid email format' },
                    { field: 'confidenceMin', message: 'Must be between 0 and 1' }
                  ],
                },
              },
              required: ['code', 'message'],
              example: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                details: [
                  { field: 'email', message: 'Invalid email format' }
                ]
              }
            },
            meta: { $ref: '#/components/schemas/Meta' },
          },
          required: ['error', 'meta'],
          example: {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request validation failed',
              details: [
                { field: 'email', message: 'Invalid email format' }
              ]
            },
            meta: {
              traceId: 'b2b-1707926400000-abc123',
              timestamp: '2026-02-15T10:00:00.000Z'
            }
          }
        },
        DecisionStatus: {
          type: 'string',
          enum: ['pick', 'no_bet', 'hard_stop'],
          example: 'pick',
          description: 'Status of the betting decision',
        },
        Decision: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              example: '550e8400-e29b-41d4-a716-446655440000',
              description: 'Unique decision identifier',
            },
            traceId: {
              type: 'string',
              format: 'uuid',
              example: '550e8400-e29b-41d4-a716-446655440001',
              description: 'Trace identifier for debugging',
            },
            matchId: {
              type: 'string',
              example: 'LAL-vs-BOS-2026-02-15',
              description: 'Match identifier',
            },
            status: { $ref: '#/components/schemas/DecisionStatus' },
            confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              example: 0.78,
              description: 'Confidence level of the decision (0-1)',
            },
            edge: {
              type: 'number',
              example: 0.12,
              description: 'Edge percentage',
            },
            rationale: {
              type: 'string',
              example: 'High confidence pick based on historical data',
              description: 'Short rationale for the decision',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2026-02-15T10:00:00.000Z',
              description: 'When the decision was created',
            },
          },
          required: ['id', 'traceId', 'matchId', 'status', 'confidence', 'edge', 'rationale', 'createdAt'],
        },
        DecisionListResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/Decision' },
            },
            meta: {
              type: 'object',
              properties: {
                ...{
                  traceId: { type: 'string', example: 'b2b-1707926400000-abc123' },
                  timestamp: { type: 'string', format: 'date-time', example: '2026-02-15T10:00:00.000Z' },
                },
                pagination: { $ref: '#/components/schemas/PaginationMeta' },
              },
              required: ['traceId', 'timestamp', 'pagination'],
            },
          },
          required: ['data', 'meta'],
        },
        DecisionResponse: {
          type: 'object',
          properties: {
            data: { $ref: '#/components/schemas/Decision' },
            meta: { $ref: '#/components/schemas/Meta' },
          },
          required: ['data', 'meta'],
        },
        GateOutcome: {
          type: 'object',
          properties: {
            gateName: {
              type: 'string',
              example: 'minConfidence',
              description: 'Name of the gate',
            },
            passed: {
              type: 'boolean',
              example: true,
              description: 'Whether the gate passed',
            },
            reason: {
              type: 'string',
              example: 'Confidence 0.78 exceeds minimum 0.65',
              description: 'Explanation of gate result',
            },
          },
          required: ['gateName', 'passed', 'reason'],
        },
        MatchInfo: {
          type: 'object',
          properties: {
            homeTeam: { type: 'string', example: 'Los Angeles Lakers' },
            awayTeam: { type: 'string', example: 'Boston Celtics' },
            startTime: {
              type: 'string',
              format: 'date-time',
              example: '2026-02-15T19:30:00.000Z',
            },
          },
          required: ['homeTeam', 'awayTeam', 'startTime'],
        },
        DecisionExplanation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
            traceId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440001' },
            matchId: { type: 'string', example: 'LAL-vs-BOS-2026-02-15' },
            matchInfo: { $ref: '#/components/schemas/MatchInfo' },
            status: { $ref: '#/components/schemas/DecisionStatus' },
            gateOutcomes: {
              type: 'array',
              items: { $ref: '#/components/schemas/GateOutcome' },
            },
            confidence: { type: 'number', minimum: 0, maximum: 1, example: 0.78 },
            edge: { type: 'number', example: 0.12 },
            dataSignals: {
              type: 'object',
              additionalProperties: true,
              example: { homeWinRate: 0.52, awayWinRate: 0.48 },
              description: 'Additional data signals used for decision',
            },
            explanation: {
              type: 'string',
              example: 'High confidence pick based on historical data and current form',
              description: 'Detailed explanation of the decision',
            },
            createdAt: { type: 'string', format: 'date-time', example: '2026-02-15T10:00:00.000Z' },
          },
          required: ['id', 'traceId', 'matchId', 'matchInfo', 'status', 'gateOutcomes', 'confidence', 'edge', 'dataSignals', 'explanation', 'createdAt'],
        },
        ExplainResponse: {
          type: 'object',
          properties: {
            data: { $ref: '#/components/schemas/DecisionExplanation' },
            meta: { $ref: '#/components/schemas/Meta' },
          },
          required: ['data', 'meta'],
        },
        ProfileConfig: {
          type: 'object',
          properties: {
            confidenceMin: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              example: 0.65,
              description: 'Minimum confidence threshold (0-1)',
            },
            edgeMin: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              example: 0.05,
              description: 'Minimum edge threshold (0-1)',
            },
            maxDriftScore: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              example: 0.15,
              description: 'Maximum allowed drift score (0-1)',
            },
          },
        },
        CreateProfileRequest: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              minLength: 1,
              maxLength: 100,
              example: 'High Confidence Profile',
              description: 'Profile name',
            },
            description: {
              type: 'string',
              maxLength: 500,
              example: 'Profile for high-confidence picks only',
            },
            confidenceMin: { type: 'number', minimum: 0, maximum: 1, default: 0.65, example: 0.65 },
            edgeMin: { type: 'number', minimum: 0, maximum: 1, default: 0.05, example: 0.05 },
            maxDriftScore: { type: 'number', minimum: 0, maximum: 1, default: 0.15, example: 0.15 },
            isDefault: { type: 'boolean', default: false, example: false, description: 'Whether this is the default profile' },
          },
          required: ['name'],
        },
        UpdateProfileRequest: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100, example: 'Updated Profile Name' },
            description: { type: 'string', maxLength: 500, example: 'Updated description' },
            confidenceMin: { type: 'number', minimum: 0, maximum: 1, example: 0.70 },
            edgeMin: { type: 'number', minimum: 0, maximum: 1, example: 0.08 },
            maxDriftScore: { type: 'number', minimum: 0, maximum: 1, example: 0.12 },
            isDefault: { type: 'boolean', example: true },
            isActive: { type: 'boolean', example: true },
          },
        },
        ProfileResponse: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
            name: { type: 'string', example: 'High Confidence Profile' },
            description: { type: 'string', nullable: true, example: 'Profile for high-confidence picks only' },
            confidenceMin: { type: 'number', example: 0.65 },
            edgeMin: { type: 'number', example: 0.05 },
            maxDriftScore: { type: 'number', example: 0.15 },
            isActive: { type: 'boolean', example: true },
            isDefault: { type: 'boolean', example: false },
            apiKeyId: {
              type: 'string',
              example: '550e8400-e29b-41d4-a716-446655440001',
              description: 'API key ID that owns this profile',
            },
            createdAt: { type: 'string', format: 'date-time', example: '2026-02-15T10:00:00.000Z' },
            updatedAt: { type: 'string', format: 'date-time', example: '2026-02-15T12:00:00.000Z' },
            createdBy: {
              type: 'string',
              nullable: true,
              example: 'user@example.com',
              description: 'Email of user who created the profile',
            },
          },
          required: ['id', 'name', 'confidenceMin', 'edgeMin', 'maxDriftScore', 'isActive', 'isDefault', 'apiKeyId', 'createdAt', 'updatedAt'],
        },
        ProfileListResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/ProfileResponse' } },
            meta: {
              type: 'object',
              properties: {
                traceId: { type: 'string', example: 'b2b-1707926400000-abc123' },
                timestamp: { type: 'string', format: 'date-time', example: '2026-02-15T10:00:00.000Z' },
                pagination: { $ref: '#/components/schemas/PaginationMeta' },
              },
              required: ['traceId', 'timestamp', 'pagination'],
            },
          },
          required: ['data', 'meta'],
        },
        ProfileHistoryEntry: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
            profileId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440001' },
            action: { type: 'string', example: 'UPDATE', description: 'Type of action performed' },
            changedBy: { type: 'string', nullable: true, example: 'user@example.com' },
            reason: { type: 'string', nullable: true, example: 'Updated confidence threshold' },
            oldValue: { type: 'object', nullable: true, example: { confidenceMin: 0.65 } },
            newValue: { type: 'object', nullable: true, example: { confidenceMin: 0.70 } },
            traceId: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440002' },
            createdAt: { type: 'string', format: 'date-time', example: '2026-02-15T12:00:00.000Z' },
          },
          required: ['id', 'profileId', 'action', 'changedBy', 'traceId', 'createdAt'],
        },
        ProfileHistoryResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/ProfileHistoryEntry' } },
            meta: {
              type: 'object',
              properties: {
                traceId: { type: 'string', example: 'b2b-1707926400000-abc123' },
                timestamp: { type: 'string', format: 'date-time', example: '2026-02-15T10:00:00.000Z' },
                pagination: { $ref: '#/components/schemas/PaginationMeta' },
              },
              required: ['traceId', 'timestamp', 'pagination'],
            },
          },
          required: ['data', 'meta'],
        },
        RunStatus: {
          type: 'string',
          enum: ['pending', 'running', 'completed', 'failed'],
          example: 'completed',
          description: 'Status of the daily run',
        },
        DailyRun: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
            date: { type: 'string', example: '2026-02-15', description: 'Date of the run (YYYY-MM-DD)' },
            status: { $ref: '#/components/schemas/RunStatus' },
            totalDecisions: { type: 'integer', minimum: 0, example: 12, description: 'Total decisions produced' },
            pickCount: { type: 'integer', minimum: 0, example: 8, description: 'Number of pick decisions' },
            noBetCount: { type: 'integer', minimum: 0, example: 3, description: 'Number of no-bet decisions' },
            hardStopCount: { type: 'integer', minimum: 0, example: 1, description: 'Number of hard-stop decisions' },
            startedAt: { type: 'string', format: 'date-time', nullable: true, example: '2026-02-15T06:00:00.000Z' },
            completedAt: { type: 'string', format: 'date-time', nullable: true, example: '2026-02-15T06:05:00.000Z' },
            errorMessage: { type: 'string', nullable: true, example: null, description: 'Error message if run failed' },
          },
          required: ['id', 'date', 'status', 'totalDecisions', 'pickCount', 'noBetCount', 'hardStopCount'],
        },
        RunsListResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/DailyRun' } },
            meta: {
              type: 'object',
              properties: {
                traceId: { type: 'string', example: 'b2b-1707926400000-abc123' },
                timestamp: { type: 'string', format: 'date-time', example: '2026-02-15T10:00:00.000Z' },
                pagination: { $ref: '#/components/schemas/PaginationMeta' },
              },
              required: ['traceId', 'timestamp', 'pagination'],
            },
          },
          required: ['data', 'meta'],
        },
      },
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      '/api/v1/b2b/decisions': {
        get: {
          summary: 'List decisions',
          description: 'Get a paginated list of betting decisions with optional filters.',
          tags: ['Decisions'],
          operationId: 'listDecisions',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1, minimum: 1 }, example: 1, description: 'Page number' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 }, example: 20, description: 'Items per page' },
            { name: 'fromDate', in: 'query', schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, example: '2026-02-01', description: 'Filter from date (YYYY-MM-DD)' },
            { name: 'toDate', in: 'query', schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }, example: '2026-02-15', description: 'Filter to date (YYYY-MM-DD)' },
            { name: 'status', in: 'query', schema: { $ref: '#/components/schemas/DecisionStatus' }, example: 'Pick', description: 'Filter by decision status' },
            { name: 'matchId', in: 'query', schema: { type: 'string' }, example: 'LAL-vs-BOS-2026-02-15', description: 'Filter by match ID' },
          ],
          responses: {
            '200': {
              description: 'Successful response',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/DecisionListResponse' } } },
            },
            '400': {
              description: 'Bad Request - Invalid query parameters',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: {
                    error: {
                      code: 'INVALID_QUERY_PARAMETER',
                      message: 'Invalid date format. Use YYYY-MM-DD',
                      details: [{ field: 'fromDate', message: 'Must be valid date format YYYY-MM-DD' }]
                    },
                    meta: { traceId: 'b2b-1707926400000-abc123', timestamp: '2026-02-15T10:00:00.000Z' }
                  }
                }
              },
            },
            '401': {
              description: 'Unauthorized - Invalid or missing API key',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: {
                    error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' },
                    meta: { traceId: 'b2b-1707926400000-abc124', timestamp: '2026-02-15T10:00:00.000Z' }
                  }
                }
              },
            },
            '429': {
              description: 'Too Many Requests - Rate limit exceeded. Limit: 1000 requests/hour',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: {
                    error: {
                      code: 'RATE_LIMIT_EXCEEDED',
                      message: 'Rate limit exceeded. Maximum 1000 requests per hour',
                      details: [{ field: 'X-API-Key', message: 'Retry after 3600 seconds' }]
                    },
                    meta: { traceId: 'b2b-1707926400000-abc125', timestamp: '2026-02-15T10:00:00.000Z' }
                  }
                }
              },
            },
            '500': {
              description: 'Internal Server Error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: {
                    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
                    meta: { traceId: 'b2b-1707926400000-abc126', timestamp: '2026-02-15T10:00:00.000Z' }
                  }
                }
              },
            },
          },
        },
      },
      '/api/v1/b2b/decisions/{id}': {
        get: {
          summary: 'Get a single decision',
          description: 'Retrieve a specific decision by ID or traceId.',
          tags: ['Decisions'],
          operationId: 'getDecision',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: '550e8400-e29b-41d4-a716-446655440000', description: 'Decision ID or traceId' },
            { name: 'lookup', in: 'query', schema: { type: 'string', enum: ['id', 'traceId'], default: 'id' }, example: 'id', description: 'Whether id param is decision ID or traceId' },
          ],
          responses: {
            '200': { description: 'Successful response', content: { 'application/json': { schema: { $ref: '#/components/schemas/DecisionResponse' } } } },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Decision not found' },
          },
        },
      },
      '/api/v1/b2b/decisions/{id}/explain': {
        get: {
          summary: 'Get decision explanation',
          description: 'Retrieve detailed explanation for a specific decision including gate outcomes and data signals.',
          tags: ['Decisions'],
          operationId: 'explainDecision',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, example: '550e8400-e29b-41d4-a716-446655440000', description: 'Decision ID or traceId' },
          ],
          responses: {
            '200': { description: 'Successful response', content: { 'application/json': { schema: { $ref: '#/components/schemas/ExplainResponse' } } } },
            '400': {
              description: 'Bad Request - Invalid decision ID format',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: {
                    error: { code: 'INVALID_PARAMETER', message: 'Invalid decision ID format. Must be UUID' },
                    meta: { traceId: 'b2b-1707926400000-abc127', timestamp: '2026-02-15T10:00:00.000Z' }
                  }
                }
              },
            },
            '401': {
              description: 'Unauthorized - Invalid or missing API key',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: {
                    error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' },
                    meta: { traceId: 'b2b-1707926400000-abc128', timestamp: '2026-02-15T10:00:00.000Z' }
                  }
                }
              },
            },
            '404': {
              description: 'Decision not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: {
                    error: { code: 'NOT_FOUND', message: 'Decision not found with given ID' },
                    meta: { traceId: 'b2b-1707926400000-abc129', timestamp: '2026-02-15T10:00:00.000Z' }
                  }
                }
              },
            },
            '429': {
              description: 'Too Many Requests - Rate limit exceeded',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: {
                    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Rate limit exceeded. Maximum 1000 requests per hour' },
                    meta: { traceId: 'b2b-1707926400000-abc130', timestamp: '2026-02-15T10:00:00.000Z' }
                  }
                }
              },
            },
            '500': {
              description: 'Internal Server Error',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: {
                    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred while generating explanation' },
                    meta: { traceId: 'b2b-1707926400000-abc131', timestamp: '2026-02-15T10:00:00.000Z' }
                  }
                }
              },
            },
          },
        },
      },
      '/api/v1/b2b/profiles': {
        get: {
          summary: 'List policy profiles',
          description: 'Get all policy profiles accessible to the authenticated API key.',
          tags: ['Profiles'],
          operationId: 'listProfiles',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1, minimum: 1 }, example: 1 },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 }, example: 20 },
          ],
          responses: {
            '200': { description: 'Successful response', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProfileListResponse' } } } },
            '401': { description: 'Unauthorized' },
          },
        },
        post: {
          summary: 'Create a policy profile',
          description: 'Create a new policy profile with custom thresholds.',
          tags: ['Profiles'],
          operationId: 'createProfile',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateProfileRequest' },
                example: {
                  name: 'High Confidence Profile',
                  description: 'Profile for high-confidence picks only',
                  confidenceMin: 0.70,
                  edgeMin: 0.08,
                  maxDriftScore: 0.12,
                  isDefault: false,
                },
              },
            },
          },
          responses: {
            '201': { description: 'Profile created successfully', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProfileResponse' } } } },
            '400': { description: 'Bad Request' },
            '401': { description: 'Unauthorized' },
            '409': { description: 'Conflict - Default profile already exists' },
          },
        },
      },
      '/api/v1/b2b/profiles/{id}': {
        get: {
          summary: 'Get a single profile',
          description: 'Retrieve a specific policy profile by ID.',
          tags: ['Profiles'],
          operationId: 'getProfile',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: '550e8400-e29b-41d4-a716-446655440000' },
          ],
          responses: {
            '200': { description: 'Successful response', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProfileResponse' } } } },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Profile not found' },
          },
        },
        put: {
          summary: 'Update a profile',
          description: 'Update an existing policy profile.',
          tags: ['Profiles'],
          operationId: 'updateProfile',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: '550e8400-e29b-41d4-a716-446655440000' },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UpdateProfileRequest' },
                example: { name: 'Updated Profile Name', confidenceMin: 0.75, isActive: true },
              },
            },
          },
          responses: {
            '200': { description: 'Profile updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProfileResponse' } } } },
            '400': { description: 'Bad Request' },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Profile not found' },
          },
        },
        delete: {
          summary: 'Delete a profile',
          description: 'Delete an existing policy profile.',
          tags: ['Profiles'],
          operationId: 'deleteProfile',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: '550e8400-e29b-41d4-a716-446655440000' },
          ],
          responses: {
            '204': { description: 'Profile deleted successfully' },
            '401': {
              description: 'Unauthorized - Invalid or missing API key',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: {
                    error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' },
                    meta: { traceId: 'b2b-1707926400000-abc140', timestamp: '2026-02-15T10:00:00.000Z' }
                  }
                }
              },
            },
            '404': {
              description: 'Profile not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: {
                    error: { code: 'NOT_FOUND', message: 'Profile not found with given ID' },
                    meta: { traceId: 'b2b-1707926400000-abc141', timestamp: '2026-02-15T10:00:00.000Z' }
                  }
                }
              },
            },
            '409': {
              description: 'Conflict - Cannot delete default profile',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorResponse' },
                  example: {
                    error: { code: 'CONFLICT', message: 'Cannot delete the default profile. Set another profile as default first.' },
                    meta: { traceId: 'b2b-1707926400000-abc142', timestamp: '2026-02-15T10:00:00.000Z' }
                  }
                }
              },
            },
          },
        },
      },
      '/api/v1/b2b/profiles/{id}/history': {
        get: {
          summary: 'Get profile change history',
          description: 'Retrieve the audit history of changes made to a profile.',
          tags: ['Profiles'],
          operationId: 'getProfileHistory',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, example: '550e8400-e29b-41d4-a716-446655440000' },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1, minimum: 1 }, example: 1 },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 }, example: 20 },
          ],
          responses: {
            '200': { description: 'Successful response', content: { 'application/json': { schema: { $ref: '#/components/schemas/ProfileHistoryResponse' } } } },
            '401': { description: 'Unauthorized' },
            '404': { description: 'Profile not found' },
          },
        },
      },
      '/api/v1/b2b/runs': {
        get: {
          summary: 'List daily runs',
          description: 'Get a paginated list of daily production runs.',
          tags: ['Runs'],
          operationId: 'listRuns',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1, minimum: 1 }, example: 1 },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 }, example: 20 },
          ],
          responses: {
            '200': { description: 'Successful response', content: { 'application/json': { schema: { $ref: '#/components/schemas/RunsListResponse' } } } },
            '401': { description: 'Unauthorized' },
          },
        },
      },
    },
    tags: [
      { name: 'Decisions', description: 'Betting decision endpoints' },
      { name: 'Profiles', description: 'Policy profile management endpoints' },
      { name: 'Runs', description: 'Daily production run endpoints' },
    ],
  };
}
