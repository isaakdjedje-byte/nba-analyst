// Client-side RBAC hooks
// For React components to check user roles

"use client";

import { useSession } from "next-auth/react";
import { UserRole, hasRole, ROLE_HIERARCHY } from "@/server/auth/rbac";

interface UseRBACReturn {
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /**
   * Check if current user has at least the required role
   */
  hasRole: (requiredRole: UserRole) => boolean;
  /**
   * Check if user has exact role
   */
  hasExactRole: (role: UserRole) => boolean;
  /**
   * Check if user is admin
   */
  isAdmin: boolean;
  /**
   * Check if user is ops or higher
   */
  isOps: boolean;
  /**
   * Check if user is support or higher
   */
  isSupport: boolean;
  /**
   * Check if user is standard user
   */
  isUser: boolean;
  /**
   * Get role hierarchy level (1-4)
   */
  roleLevel: number;
}

/**
 * Hook for client-side role checking
 * Usage: const { isAdmin, hasRole } = useRBAC();
 */
export function useRBAC(): UseRBACReturn {
  const { data: session, status } = useSession();

  const isLoading = status === "loading";
  const isAuthenticated = status === "authenticated" && !!session?.user;
  const userRole = session?.user?.role ?? null;

  return {
    role: userRole,
    isLoading,
    isAuthenticated,
    hasRole: (requiredRole: UserRole) => {
      if (!userRole) return false;
      return hasRole(userRole, requiredRole);
    },
    hasExactRole: (role: UserRole) => {
      return userRole === role;
    },
    isAdmin: userRole === UserRole.ADMIN,
    isOps: userRole ? hasRole(userRole, UserRole.OPS) : false,
    isSupport: userRole ? hasRole(userRole, UserRole.SUPPORT) : false,
    isUser: userRole === UserRole.USER,
    roleLevel: userRole ? ROLE_HIERARCHY[userRole] : 0,
  };
}

/**
 * Hook that requires a specific role
 * Returns { allowed: boolean, isLoading: boolean }
 */
export function useRequireRole(
  requiredRole: UserRole
): { allowed: boolean; isLoading: boolean } {
  const { hasRole, isLoading } = useRBAC();

  return {
    allowed: hasRole(requiredRole),
    isLoading,
  };
}

/**
 * Hook for admin-only components
 */
export function useRequireAdmin(): { allowed: boolean; isLoading: boolean } {
  return useRequireRole(UserRole.ADMIN);
}

/**
 * Hook for ops+ components
 */
export function useRequireOps(): { allowed: boolean; isLoading: boolean } {
  return useRequireRole(UserRole.OPS);
}

/**
 * Hook for support+ components
 */
export function useRequireSupport(): { allowed: boolean; isLoading: boolean } {
  return useRequireRole(UserRole.SUPPORT);
}
