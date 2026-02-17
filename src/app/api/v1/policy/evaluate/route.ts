/**
 * Policy Evaluation API Endpoint
 * 
 * POST /api/v1/policy/evaluate
 * Story 2.5: Evaluate a prediction against policy gates
 * 
 * RBAC: Requires authentication (any authenticated user)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';
import { PolicyEngine } from '@/server/policy/engine';
import { PredictionInput, RunContext, PolicyError } from '@/server/policy/types';
import { authOptions } from '@/server/auth/auth-options';
import { generateTraceId } from '@/server/auth/rbac';

// Zod validation schemas
const PredictionInputSchema = z.object({
  id: z.string().min(1, 'Prediction ID is required'),
  matchId: z.string().min(1, 'Match ID is required'),
  runId: z.string().min(1, 'Run ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  confidence: z.number().min(0).max(1, 'Confidence must be between 0 and 1'),
  edge: z.number().min(0).max(1).optional(),
  driftScore: z.number().min(0).max(1).optional(),
  winnerPrediction: z.string().nullable().optional(),
  scorePrediction: z.string().nullable().optional(),
  overUnderPrediction: z.number().nullable().optional(),
  modelVersion: z.string().min(1, 'Model version is required'),
});

const RunContextSchema = z.object({
  runId: z.string().min(1, 'Run ID is required'),
  traceId: z.string().optional(),
  dailyLoss: z.number().min(0).optional().default(0),
  consecutiveLosses: z.number().min(0).optional().default(0),
  currentBankroll: z.number().min(0).optional().default(10000),
});

const EvaluateRequestSchema = z.object({
  prediction: PredictionInputSchema,
  context: RunContextSchema.optional().default({
    dailyLoss: 0,
    consecutiveLosses: 0,
    currentBankroll: 10000,
  }),
});

// Initialize policy engine (singleton)
let policyEngine: PolicyEngine | null = null;

function getPolicyEngine(): PolicyEngine {
  if (!policyEngine) {
    policyEngine = PolicyEngine.createDefault();
  }
  return policyEngine;
}

/**
 * POST /api/v1/policy/evaluate
 * 
 * Evaluate a prediction against policy gates
 * Requires authentication
 */
export async function POST(request: NextRequest) {
  const traceId = generateTraceId();
  const startTime = Date.now();

  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
          meta: {
            traceId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = EvaluateRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errors = validationResult.error.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request body',
          details: { errors },
        },
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      }, { status: 400 });
    }

    const { prediction, context } = validationResult.data;

    // Create run context with traceId
    const runContext: RunContext = {
      runId: context.runId,
      traceId: context.traceId || traceId,
      dailyLoss: context.dailyLoss,
      consecutiveLosses: context.consecutiveLosses,
      currentBankroll: context.currentBankroll,
      executedAt: new Date(),
    };

    // Evaluate prediction through policy engine
    const engine = getPolicyEngine();
    const result = await engine.evaluate(prediction as PredictionInput, runContext);

    // Format successful response
    const response = {
      data: {
        decisionId: result.decisionId,
        status: result.status,
        rationale: result.rationale,
        gateOutcomes: result.gateOutcomes,
        recommendedAction: result.recommendedAction,
      },
      meta: {
        traceId: result.traceId,
        timestamp: result.executedAt.toISOString(),
        processingTimeMs: Date.now() - startTime,
      },
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    // Handle policy-specific errors
    if (error instanceof PolicyError) {
      return NextResponse.json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      }, { status: 400 });
    }

    // Handle unexpected errors
    console.error('[Policy API] Unexpected error:', error);
    
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
      },
      meta: {
        traceId,
        timestamp: new Date().toISOString(),
      },
    }, { status: 500 });
  }
}

/**
 * GET /api/v1/policy/evaluate
 * 
 * Returns API documentation
 */
export async function GET() {
  return NextResponse.json({
    data: {
      endpoint: '/api/v1/policy/evaluate',
      method: 'POST',
      description: 'Evaluate a prediction against policy gates to determine Pick/No-Bet/Hard-Stop decision',
      requestBody: {
        prediction: {
          id: 'string (required)',
          matchId: 'string (required)',
          runId: 'string (required)',
          userId: 'string (required)',
          confidence: 'number 0-1 (required)',
          edge: 'number 0-1 (optional)',
          driftScore: 'number 0-1 (optional)',
          modelVersion: 'string (optional)',
        },
        context: {
          runId: 'string (required)',
          traceId: 'string (optional, auto-generated)',
          dailyLoss: 'number (optional, default: 0)',
          consecutiveLosses: 'number (optional, default: 0)',
          currentBankroll: 'number (optional, default: 10000)',
        },
      },
      response: {
        decisionId: 'string',
        status: '"PICK" | "NO_BET" | "HARD_STOP"',
        rationale: 'string',
        gateOutcomes: 'object',
        recommendedAction: 'string | null',
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  }, { status: 200 });
}
