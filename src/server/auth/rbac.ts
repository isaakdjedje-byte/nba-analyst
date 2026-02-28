// Role-Based Access Control (RBAC) - Story 1.3 Implementation
// Architecture Compliance: RBAC Stack per architecture.md §190-195

import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * User Roles - Hierarchical (admin > ops > support > user)
 * Per architecture.md requirements
 */
export enum UserRole {
  USER = "user",
  SUPPORT = "support",
  OPS = "ops",
  ADMIN = "admin",
}

/**
 * Role hierarchy for permission inheritance
 * Higher value = more permissions
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.USER]: 1,
  [UserRole.SUPPORT]: 2,
  [UserRole.OPS]: 3,
  [UserRole.ADMIN]: 4,
};

/**
 * Check if user has required role (hierarchical check)
 * admin > ops > support > user
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if user has exact role
 */
export function hasExactRole(userRole: UserRole, role: UserRole): boolean {
  return userRole === role;
}

/**
 * Check if user is admin
 */
export function isAdmin(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

/**
 * Check if user is ops or higher
 */
export function isOps(role: UserRole): boolean {
  return hasRole(role, UserRole.OPS);
}

/**
 * Check if user is support or higher
 */
export function isSupport(role: UserRole): boolean {
  return hasRole(role, UserRole.SUPPORT);
}

/**
 * Route access configuration
 * Defines which roles can access which routes
 */
export const ROUTE_ACCESS: Record<string, UserRole[]> = {
  // Public routes - no authentication required
  "/": [],
  "/login": [],
  "/register": [],
  "/api/auth": [],
  "/api/health": [],
  "/dashboard": [UserRole.USER, UserRole.SUPPORT, UserRole.OPS, UserRole.ADMIN],
  "/dashboard/picks": [UserRole.USER, UserRole.SUPPORT, UserRole.OPS, UserRole.ADMIN],
  "/dashboard/no-bet": [UserRole.USER, UserRole.SUPPORT, UserRole.OPS, UserRole.ADMIN],
  "/dashboard/performance": [UserRole.USER, UserRole.SUPPORT, UserRole.OPS, UserRole.ADMIN],
  "/dashboard/logs": [UserRole.USER, UserRole.SUPPORT, UserRole.OPS, UserRole.ADMIN],
  "/dashboard/investigation": [UserRole.SUPPORT, UserRole.OPS, UserRole.ADMIN],
  "/dashboard/policy-config": [UserRole.OPS, UserRole.ADMIN],
  "/api/v1/decisions": [UserRole.USER, UserRole.SUPPORT, UserRole.OPS, UserRole.ADMIN],
  "/api/v1/policy": [UserRole.OPS, UserRole.ADMIN],
  "/api/v1/runs": [UserRole.OPS, UserRole.ADMIN],
  "/api/ingestion": [UserRole.OPS, UserRole.ADMIN],

  // Admin only routes
  "/admin": [UserRole.ADMIN],
  "/admin/users": [UserRole.ADMIN],
  "/api/v1/admin": [UserRole.ADMIN],
  "/api/v1/admin/users": [UserRole.ADMIN],
  "/api/v1/admin/users/:path*": [UserRole.ADMIN],
};

/**
 * Match a request path against route patterns
 * Returns the matched route config or null
 */
export function matchRoute(
  pathname: string
): { pattern: string; roles: UserRole[] } | null {
  // Exact match first
  if (ROUTE_ACCESS[pathname]) {
    return { pattern: pathname, roles: ROUTE_ACCESS[pathname] };
  }

  // Check patterns with wildcards
  for (const [pattern, roles] of Object.entries(ROUTE_ACCESS)) {
    // Convert pattern to regex
    const regexPattern = pattern
      .replace(/\[\[\.\.\.\w+\]\]/g, ".*") // [[...slug]]
      .replace(/\[\.\.\.\w+\]/g, ".*") // [...slug]
      .replace(/\[\w+\]/g, "[^/]+") // [id]
      .replace(/\//g, "\\/");

    const regex = new RegExp(`^${regexPattern}$`);
    if (regex.test(pathname)) {
      return { pattern, roles };
    }
  }

  // Check parent paths (e.g., /admin/users matches /admin)
  const pathSegments = pathname.split("/").filter(Boolean);
  for (let i = pathSegments.length - 1; i >= 0; i--) {
    const parentPath = "/" + pathSegments.slice(0, i).join("/");
    if (ROUTE_ACCESS[parentPath]) {
      return { pattern: parentPath, roles: ROUTE_ACCESS[parentPath] };
    }
  }

  return null;
}

/**
 * Check if a path is public (no auth required)
 */
export function isPublicRoute(pathname: string): boolean {
  const match = matchRoute(pathname);
  return match !== null && match.roles.length === 0;
}

/**
 * Middleware role checker
 * Returns true if user can access the route
 */
export async function checkRouteAccess(
  req: NextRequest
): Promise<{ allowed: boolean; role?: UserRole; error?: string }> {
  const pathname = req.nextUrl.pathname;

  // Check if route exists in access config
  const routeMatch = matchRoute(pathname);
  if (!routeMatch) {
    // Unknown route - deny by default (security first)
    return { allowed: false, error: "Unknown route" };
  }

  // Public route - allow
  if (routeMatch.roles.length === 0) {
    return { allowed: true };
  }

  // Get user token from JWT
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    return { allowed: false, error: "Authentication required" };
  }

  const userRole = token.role as UserRole;

  // Check if user's role is in allowed roles
  const hasAccess = routeMatch.roles.some((role) => hasRole(userRole, role));

  if (!hasAccess) {
    return {
      allowed: false,
      role: userRole,
      error: `Insufficient permissions. Required: ${routeMatch.roles.join(", ")}`,
    };
  }

  return { allowed: true, role: userRole };
}

/**
 * Generate trace ID for audit and error tracking
 */
export function generateTraceId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create forbidden response with trace ID
 * Per architecture.md §299-303
 */
export function createForbiddenResponse(traceId: string): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "FORBIDDEN",
        message: "Insufficient permissions for this operation",
      },
      meta: {
        traceId,
        timestamp: new Date().toISOString(),
      },
    },
    { status: 403 }
  );
}

/**
 * Role labels for UI display
 */
export const ROLE_LABELS: Record<UserRole, string> = {
  [UserRole.USER]: "Utilisateur",
  [UserRole.SUPPORT]: "Support",
  [UserRole.OPS]: "Opérations",
  [UserRole.ADMIN]: "Administrateur",
};

/**
 * Role descriptions for UI
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.USER]: "Accès aux picks, no-bet, performance et logs",
  [UserRole.SUPPORT]: "+ Replay des décisions et investigation",
  [UserRole.OPS]: "+ Configuration des policies (MFA requis)",
  [UserRole.ADMIN]: "+ Gestion des utilisateurs (MFA requis)",
};

/**
 * All roles array for select inputs
 */
export const ALL_ROLES: UserRole[] = [
  UserRole.USER,
  UserRole.SUPPORT,
  UserRole.OPS,
  UserRole.ADMIN,
];

/**
 * Role colors for UI badges
 */
export const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  [UserRole.USER]: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
  },
  [UserRole.SUPPORT]: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  [UserRole.OPS]: {
    bg: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  [UserRole.ADMIN]: {
    bg: "bg-rose-100",
    text: "text-rose-700",
    border: "border-rose-200",
  },
};
