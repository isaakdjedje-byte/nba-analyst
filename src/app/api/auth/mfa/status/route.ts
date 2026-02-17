/**
 * MFA Status API Route
 * GET /api/auth/mfa/status - Get MFA status for current user
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth-options";
import { prisma } from "@/server/db/client";
import { generateTraceId } from "@/server/auth/rbac";

export async function GET() {
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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        mfaEnabled: true,
        mfaEnrolledAt: true,
        mfaLastVerifiedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        {
          error: "Not Found",
          message: "User not found",
          traceId,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        status: {
          enabled: user.mfaEnabled,
          enrolledAt: user.mfaEnrolledAt?.toISOString() || null,
          lastVerifiedAt: user.mfaLastVerifiedAt?.toISOString() || null,
        },
        traceId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[MFA Status] Error:", { traceId, error });
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to get MFA status",
        traceId,
      },
      { status: 500 }
    );
  }
}
