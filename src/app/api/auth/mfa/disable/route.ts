/**
 * MFA Disable API Routes
 * POST /api/auth/mfa/disable - Request MFA removal (initiates cooldown)
 * PUT /api/auth/mfa/disable - Complete MFA removal after cooldown
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth-options";
import {
  completeMFARemoval,
} from "@/server/auth/mfa-verification";
import { generateTraceId } from "@/server/auth/rbac";
import { logMFAEvent } from "@/lib/utils/audit";

/**
 * POST - Request MFA removal (initiates cooldown)
 */
export async function POST(request: NextRequest) {
  const traceId = generateTraceId();

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Authentication required",
          traceId,
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "MFA code is required",
          traceId,
        },
        { status: 400 }
      );
    }

    const result = await completeMFARemoval(session.user.id, code);

    if (result.success) {
      // Log MFA disabled event (NFR10 compliance)
      await logMFAEvent({
        userId: session.user.id,
        action: "MFA_DISABLED",
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
        metadata: {
          method: "verified_disable",
        },
        traceId,
      });

      return NextResponse.json(
        {
          success: true,
          message: "MFA has been disabled successfully",
          traceId,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: result.error || "Failed to disable MFA",
          traceId,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[MFA Disable] Error:", { traceId, error });
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to disable MFA",
        traceId,
      },
      { status: 500 }
    );
  }
}
