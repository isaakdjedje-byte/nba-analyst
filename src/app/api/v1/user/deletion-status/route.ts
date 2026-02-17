/**
 * GET /api/v1/user/deletion-status
 * Check account deletion status
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/auth-options";
import { hasPendingDeletion } from "@/server/rgpd/account-deletion";
import { generateTraceId } from "@/server/auth/rbac";

export async function GET(): Promise<NextResponse> {
  const traceId = generateTraceId();

  try {
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

    const status = await hasPendingDeletion(session.user.id);

    return NextResponse.json(
      {
        data: status,
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DeletionStatus] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "STATUS_FAILED",
          message: "Failed to check deletion status",
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
