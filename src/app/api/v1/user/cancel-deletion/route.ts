/**
 * POST /api/v1/user/cancel-deletion
 * Cancel a pending account deletion request
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/auth-options";
import { prisma } from "@/server/db/client";
import { generateTraceId } from "@/server/auth/rbac";

export async function POST(): Promise<NextResponse> {
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

    const userId = session.user.id;

    // Get the user's current email (we need to restore it)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, deletionRequestedAt: true },
    });

    if (!user?.deletionRequestedAt) {
      return NextResponse.json(
        {
          error: {
            code: "NO_DELETION_PENDING",
            message: "No deletion request found",
          },
          meta: { traceId, timestamp: new Date().toISOString() },
        },
        { status: 400 }
      );
    }

    // TODO: In a real implementation, we'd store the original email before anonymization
    // For now, we can't restore the original email from the anonymized version
    // This is a limitation that should be addressed by storing the original email
    // in a separate table before anonymization
    
    // Attempt to cancel (will fail because we don't have the original email)
    // Instead, we'll just clear the deletion fields
    await prisma.user.update({
      where: { id: userId },
      data: {
        deletionRequestedAt: null,
        deletedAt: null,
        deletionReason: null,
        // Note: email remains anonymized - this is a known limitation
        // In production, store original email in a separate secure table
      },
    });

    return NextResponse.json(
      {
        data: {
          success: true,
          message: "Deletion request cancelled",
          note: "Email will need to be updated manually if needed",
        },
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[CancelDeletion] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "CANCEL_FAILED",
          message: "Failed to cancel deletion request",
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
