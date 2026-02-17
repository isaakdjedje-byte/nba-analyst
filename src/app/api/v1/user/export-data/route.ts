/**
 * POST /api/v1/user/export-data
 * Request user data export (RGPD portability)
 * Per Story 1.5 - AC #2
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/server/auth/auth-options";
import { generateUserDataExport } from "@/server/rgpd/data-export";
import { logAuditEvent } from "@/lib/utils/audit";
import { generateTraceId } from "@/server/auth/rbac";

export async function POST(): Promise<NextResponse> {
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

    // Generate data export
    const result = await generateUserDataExport(userId);

    // Log the export request (NFR10)
    await logAuditEvent({
      actorId: userId,
      action: "DATA_EXPORT_REQUESTED",
      targetId: userId,
      targetType: "USER",
      metadata: {
        exportPath: result.filePath,
        expiresAt: result.expiresAt.toISOString(),
      },
    });

    return NextResponse.json(
      {
        data: {
          message: "Data export generated successfully",
          expiresAt: result.expiresAt.toISOString(),
          dataHash: result.dataHash,
        },
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[DataExport] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "EXPORT_FAILED",
          message: "Failed to generate data export",
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

/**
 * GET /api/v1/user/export-data
 * List user's data export history
 */
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

    const { listUserDataExports } = await import("@/server/rgpd/data-export");
    const exports = await listUserDataExports(session.user.id);

    return NextResponse.json(
      {
        data: { exports },
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[DataExportList] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "LIST_FAILED",
          message: "Failed to list data exports",
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
