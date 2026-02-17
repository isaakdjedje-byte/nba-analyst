/**
 * MFA Setup API Routes
 * GET /api/auth/mfa/setup - Generate MFA secret and QR code
 * POST /api/auth/mfa/setup - Complete MFA setup with verification code
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/auth-options";
import { generateMFASecret } from "@/server/auth/mfa";
import { setupMFAForUser } from "@/server/auth/mfa-verification";
import { generateTraceId } from "@/server/auth/rbac";
import { logMFAEvent } from "@/lib/utils/audit";
import { prisma } from "@/server/db/client";
import { encryptMFASecret } from "@/server/auth/mfa";

/**
 * GET - Generate MFA secret and QR code for setup
 */
export async function GET() {
  const traceId = generateTraceId();

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Authentication required",
          traceId,
        },
        { status: 401 }
      );
    }

    // Generate MFA secret
    const { secret, qrCodeUrl, uri } = await generateMFASecret(
      session.user.email
    );

    // Store secret temporarily in database (expires in 10 minutes)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.mFASetupSession.upsert({
      where: { userId: session.user.id },
      update: {
        secret: encryptMFASecret(secret),
        expiresAt,
      },
      create: {
        userId: session.user.id,
        secret: encryptMFASecret(secret),
        expiresAt,
      },
    });

    // Clean up expired entries
    await prisma.mFASetupSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    return NextResponse.json(
      {
        success: true,
        qrCodeUrl,
        uri,
        message: "MFA setup initiated. Scan QR code with your authenticator app.",
        traceId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[MFA Setup] Error:", { traceId, error });
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to generate MFA setup",
        traceId,
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Complete MFA setup with verification code
 */
export async function POST(request: NextRequest) {
  const traceId = generateTraceId();

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session?.user?.email) {
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
          message: "Verification code is required",
          traceId,
        },
        { status: 400 }
      );
    }

    // Get the stored secret from database
    const setupSession = await prisma.mFASetupSession.findUnique({
      where: { userId: session.user.id },
    });

    if (!setupSession || new Date() > setupSession.expiresAt) {
      // Clean up expired session if exists
      if (setupSession) {
        await prisma.mFASetupSession.delete({
          where: { userId: session.user.id },
        });
      }
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Setup session expired. Please restart the setup process.",
          traceId,
        },
        { status: 400 }
      );
    }

    // Complete MFA setup
    const result = await setupMFAForUser(
      session.user.id,
      session.user.email,
      code
    );

    if (result.success) {
      // Clear the temporary secret
      await prisma.mFASetupSession.delete({
        where: { userId: session.user.id },
      });

      // Log MFA enabled event (NFR10 compliance)
      await logMFAEvent({
        userId: session.user.id,
        action: "MFA_ENABLED",
        ipAddress: request.headers.get("x-forwarded-for") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
        metadata: {
          method: "totp",
          backupCodesGenerated: result.backupCodes?.length || 0,
        },
        traceId,
      });

      return NextResponse.json(
        {
          success: true,
          backupCodes: result.backupCodes,
          message:
            "MFA setup successful. Save these backup codes in a secure location.",
          traceId,
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: result.error || "Invalid verification code",
          traceId,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("[MFA Setup] Error:", { traceId, error });
    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: "Failed to complete MFA setup",
        traceId,
      },
      { status: 500 }
    );
  }
}
