// Server-side RBAC enforcement utilities
// For use in API route handlers

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "./auth-options";
import {
  UserRole,
  hasRole,
  ROLE_HIERARCHY,
  generateTraceId,
} from "./rbac";
import { logAccessDenied } from "@/lib/utils/audit";

/**
 * Server-side user with role from session
 * NFR9: Data minimization - only email collected as PII
 */
export interface ServerUser {
  id: string;
  email: string;
  // name field removed per RGPD compliance
  role: UserRole;
}

/**
 * Get current user from session with type safety
 */
export async function getCurrentUser(): Promise<ServerUser | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  // NFR9: Data minimization - no name field
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    role: session.user.role as UserRole,
  };
}

/**
 * Require authentication - returns user or null
 */
export async function requireAuth(): Promise<
  | { user: ServerUser; error: null }
  | { user: null; error: NextResponse }
> {
  const user = await getCurrentUser();

  if (!user) {
    const traceId = generateTraceId();
    return {
      user: null,
      error: createAuthErrorResponse(traceId, 401, "UNAUTHORIZED", "Authentication required"),
    };
  }

  return { user, error: null };
}

/**
 * Require specific role - returns user if authorized
 */
export async function requireRole(
  requiredRole: UserRole,
  req?: NextRequest
): Promise<
  | { user: ServerUser; error: null }
  | { user: null; error: NextResponse }
> {
  const user = await getCurrentUser();

  if (!user) {
    const traceId = generateTraceId();
    return {
      user: null,
      error: createAuthErrorResponse(traceId, 401, "UNAUTHORIZED", "Authentication required"),
    };
  }

  if (!hasRole(user.role, requiredRole)) {
    const traceId = generateTraceId();

    // Log the access denial
    if (req) {
      await logAccessDenied({
        userId: user.id,
        resource: req.url,
        requiredRole: requiredRole,
        userRole: user.role,
        ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
        userAgent: req.headers.get("user-agent") ?? undefined,
      });
    }

    return {
      user: null,
      error: createAuthErrorResponse(
        traceId,
        403,
        "FORBIDDEN",
        `Insufficient permissions. Required role: ${requiredRole}`
      ),
    };
  }

  return { user, error: null };
}

/**
 * Require admin role
 */
export async function requireAdmin(
  req?: NextRequest
): Promise<
  | { user: ServerUser; error: null }
  | { user: null; error: NextResponse }
> {
  return requireRole(UserRole.ADMIN, req);
}

/**
 * Require ops or higher
 */
export async function requireOps(
  req?: NextRequest
): Promise<
  | { user: ServerUser; error: null }
  | { user: null; error: NextResponse }
> {
  return requireRole(UserRole.OPS, req);
}

/**
 * Require support or higher
 */
export async function requireSupport(
  req?: NextRequest
): Promise<
  | { user: ServerUser; error: null }
  | { user: null; error: NextResponse }
> {
  return requireRole(UserRole.SUPPORT, req);
}

/**
 * Create standardized auth error response
 * Per architecture.md §299-303
 */
function createAuthErrorResponse(
  traceId: string,
  status: number,
  code: string,
  message: string
): NextResponse {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
      meta: {
        traceId,
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

/**
 * Get client IP from request
 */
export function getClientIP(req: NextRequest): string | undefined {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    undefined
  );
}

/**
 * Check if user can manage their own role
 * Prevents self-demotion (admin cannot remove own admin role)
 */
export function canChangeRole(
  actorRole: UserRole,
  targetRole: UserRole,
  newRole: UserRole,
  isSelf: boolean
): { allowed: boolean; reason?: string } {
  // Admin can change any role
  if (actorRole === UserRole.ADMIN) {
    // But cannot self-demote from admin
    if (isSelf && targetRole === UserRole.ADMIN && newRole !== UserRole.ADMIN) {
      return {
        allowed: false,
        reason: "Les administrateurs ne peuvent pas se rétrograder eux-mêmes",
      };
    }
    return { allowed: true };
  }

  // Ops can only manage user and support roles
  if (actorRole === UserRole.OPS) {
    if (targetRole === UserRole.ADMIN || targetRole === UserRole.OPS) {
      return {
        allowed: false,
        reason: "Les opérateurs ne peuvent pas modifier les rôles admin/ops",
      };
    }
    if (newRole === UserRole.ADMIN || newRole === UserRole.OPS) {
      return {
        allowed: false,
        reason: "Les opérateurs ne peuvent pas assigner les rôles admin/ops",
      };
    }
    return { allowed: true };
  }

  // Support and user cannot change roles
  return {
    allowed: false,
    reason: "Permissions insuffisantes pour modifier les rôles",
  };
}

/**
 * Validate role value
 */
export function isValidRole(role: string): role is UserRole {
  return Object.values(UserRole).includes(role as UserRole);
}

/**
 * Get all roles lower than or equal to the given role
 * Useful for role assignment UI
 */
export function getAssignableRoles(
  actorRole: UserRole
): UserRole[] {
  const hierarchy = ROLE_HIERARCHY[actorRole];
  return Object.entries(ROLE_HIERARCHY)
    .filter(([, level]) => level < hierarchy)
    .map(([role]) => role as UserRole);
}
