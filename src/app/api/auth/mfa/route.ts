/**
 * MFA Verification API Route
 * POST /api/auth/mfa - Verify MFA token during login
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth-options";
import { verifyUserMFAToken } from "@/server/auth/mfa-verification";
import { generateTraceId } from "@/server/auth/rbac";
import { logMFAEvent } from "@/lib/utils/audit";
import { rateLimit } from "@/server/auth/rate-limit";

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

    // Rate limiting: 5 attempts per 15 minutes per user
    const rateLimitResult = rateLimit(`mfa:${session.user.id}`, {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // 5 attempts
    });

    if (!rateLimitResult.success) {
      await logMFAEvent({
        userId: session.user.id,
        action: "MFA_VERIFICATION_FAILED",
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
        metadata: {
          reason: "RATE_LIMIT_EXCEEDED",
          retryAfter: rateLimitResult.retryAfter,
        },
        traceId,
      });

      return NextResponse.json(
        {
          error: "Too Many Requests",
          message: `Too many MFA attempts. Please try again in ${Math.ceil((rateLimitResult.retryAfter || 0) / 60)} minutes.`,
          traceId,
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "MFA token is required",
          traceId,
        },
        { status: 400 }
      );
    }

    // Verify MFA token
    const result = await verifyUserMFAToken(session.user.id, token);

    if (result.success) {
      // Log successful MFA verification (NFR10 compliance)
      await logMFAEvent({
        userId: session.user.id,
        action: result.method === "backup" ? "MFA_BACKUP_CODE_USED" : "MFA_VERIFIED",
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
        metadata: {
          method: result.method,
        },
        traceId,
      });

      return NextResponse.json(
        {
          success: true,
          method: result.method,
          message: "MFA verification successful",
          traceId,
        },
        { status: 200 }
      );
    } else {
      // Log failed MFA verification attempt (NFR10 compliance)
      await logMFAEvent({
        userId: session.user.id,
        action: "MFA_VERIFICATION_FAILED",
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
        metadata: {
          reason: result.error,
          attemptedCodeLength: token.length,
        },
        traceId,
      });

      return NextResponse.json(
        {
          error: "Unauthorized",
          message: result.error || "Invalid MFA code",
          traceId,
        },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("[MFA] Verification error:", { traceId, error });
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to verify MFA token",
        traceId,
      },
      { status: 500 }
    );
  }
}
