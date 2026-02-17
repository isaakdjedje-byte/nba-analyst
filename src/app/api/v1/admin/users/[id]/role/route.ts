// PUT /api/v1/admin/users/[id]/role
// Role change endpoint - AC #2

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@/server/auth/rbac";
import {
  requireAdmin,
  canChangeRole,
  getClientIP,
} from "@/server/auth/server-rbac";
import { updateUserRole, getUserById } from "@/server/repositories/user-repository";
import { logRoleChange } from "@/lib/utils/audit";
import { generateTraceId } from "@/server/auth/rbac";
import { rateLimit } from "@/server/auth/rate-limit";

// Validation schema for role change request
const roleChangeSchema = z.object({
  role: z.enum([UserRole.USER, UserRole.SUPPORT, UserRole.OPS, UserRole.ADMIN]),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT handler for role change
 * Per API contract in story.md
 */
export async function PUT(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const traceId = generateTraceId();
  const { id: userId } = await params;

  try {
    // Rate limiting for role changes (sensitive operation)
    const clientIP = getClientIP(req) ?? "unknown";
    const rateLimitKey = `role-change:${clientIP}`;
    const rateLimitResult = rateLimit(rateLimitKey, {
      windowMs: 60 * 1000, // 1 minute window
      maxRequests: 10, // 10 changes per minute per IP
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many role changes. Please try again later.",
          },
          meta: {
            traceId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 429 }
      );
    }

    // Require admin role
    const authResult = await requireAdmin(req);
    if (authResult.error) {
      return authResult.error;
    }

    const actor = authResult.user;

    // Parse and validate request body
    const body = await req.json();
    const validation = roleChangeSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid role value",
            details: validation.error.errors,
          },
          meta: {
            traceId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 400 }
      );
    }

    const { role: newRole } = validation.data;

    // Get target user
    const targetUser = await getUserById(userId);
    if (!targetUser) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "User not found",
          },
          meta: {
            traceId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 404 }
      );
    }

    // Check self-demotion protection (AC #2)
    const isSelf = actor.id === userId;
    const permissionCheck = canChangeRole(
      actor.role,
      targetUser.role,
      newRole,
      isSelf
    );

    if (!permissionCheck.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: permissionCheck.reason || "Cannot change this user's role",
          },
          meta: {
            traceId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 403 }
      );
    }

    // Store old role for audit
    const oldRole = targetUser.role;

    // Update the role
    const result = await updateUserRole(userId, newRole);

    if (!result) {
      return NextResponse.json(
        {
          error: {
            code: "UPDATE_FAILED",
            message: "Failed to update user role",
          },
          meta: {
            traceId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 500 }
      );
    }

    // Log the role change for audit (AC #2)
    await logRoleChange({
      actorId: actor.id,
      targetId: userId,
      oldRole: oldRole,
      newRole: newRole,
      ipAddress: getClientIP(req),
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    // Return success response per API contract
    return NextResponse.json(
      {
        data: {
          userId: result.user.id,
          role: result.user.role,
          updatedAt: result.user.updatedAt.toISOString(),
        },
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[RoleChange] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
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
 * GET handler for getting user role
 * For admin panel - returns current role
 */
export async function GET(
  req: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const traceId = generateTraceId();
  const { id: userId } = await params;

  try {
    // Rate limiting for role queries
    const clientIP = getClientIP(req) ?? "unknown";
    const rateLimitKey = `role-get:${clientIP}`;
    const rateLimitResult = rateLimit(rateLimitKey, {
      windowMs: 60 * 1000, // 1 minute window
      maxRequests: 60, // 60 queries per minute per IP
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many requests. Please try again later.",
          },
          meta: {
            traceId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 429 }
      );
    }

    // Require admin role
    const authResult = await requireAdmin(req);
    if (authResult.error) {
      return authResult.error;
    }

    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: "User not found",
          },
          meta: {
            traceId,
            timestamp: new Date().toISOString(),
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        data: {
          userId: user.id,
          email: user.email,
          // NFR9: no name field
          role: user.role,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[RoleGet] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred",
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
