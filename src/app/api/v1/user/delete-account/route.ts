/**
 * POST /api/v1/user/delete-account
 * Request account deletion (RGPD right to be forgotten)
 * Per Story 1.5 - AC #3
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/auth-options";
import { requestAccountDeletion } from "@/server/rgpd/account-deletion";
import { generateTraceId } from "@/server/auth/rbac";
import { z } from "zod";

const deleteAccountSchema = z.object({
  reason: z.string().optional(),
  confirm: z.boolean().refine((val) => val === true, {
    message: "Confirmation required",
  }),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const traceId = generateTraceId();

  try {
    // Get authenticated user
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
          meta: { traceId, timestamp: new Date().toISOString() },
        },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse and validate request body
    const body = await req.json();
    const validation = deleteAccountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Confirmation required to delete account",
          },
          meta: { traceId, timestamp: new Date().toISOString() },
        },
        { status: 400 }
      );
    }

    const { reason } = validation.data;

    // Request account deletion
    const result = await requestAccountDeletion(userId, reason);

    return NextResponse.json(
      {
        data: {
          success: result.success,
          scheduledDeletionDate: result.scheduledDeletionDate.toISOString(),
          gracePeriodDays: result.gracePeriodDays,
          message: result.message,
        },
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DeleteAccount] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "DELETION_FAILED",
          message: "Failed to process deletion request",
        },
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    );
  }
}
