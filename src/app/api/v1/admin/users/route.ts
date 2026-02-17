// GET /api/v1/admin/users
// List all users with optional filtering

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/server/auth/server-rbac";
import { UserRole } from "@/server/auth/rbac";
import { getUsers } from "@/server/repositories/user-repository";
import { generateTraceId } from "@/server/auth/rbac";

/**
 * GET handler for listing users
 * Requires admin role
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const traceId = generateTraceId();

  try {
    // Require admin role
    const authResult = await requireAdmin(req);
    if (authResult.error) {
      return authResult.error;
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const roleParam = searchParams.get("role");
    const search = searchParams.get("search") ?? undefined;
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);
    
    // Validate role parameter
    const validRoles = Object.values(UserRole);
    const role = validRoles.includes(roleParam as UserRole) ? (roleParam as UserRole) : undefined;

    // Fetch users
    const { users, total } = await getUsers({
      ...(role && { role }),
      ...(search && { search }),
      limit,
      offset,
    });

    // Return users list
    return NextResponse.json(
      {
        data: {
          // NFR9: Data minimization - no name field
          users: users.map((user) => ({
            id: user.id,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          })),
          total,
          limit,
          offset,
        },
        meta: {
          traceId,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[AdminUsersList] Error:", error);
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
