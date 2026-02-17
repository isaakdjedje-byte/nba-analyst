// RoleBadge - Display user role with appropriate styling
// AC #3 - Role indicators in UI

"use client";

import { UserRole, ROLE_LABELS } from "@/server/auth/rbac";
import { useRBAC } from "@/lib/auth/use-rbac";

interface RoleBadgeProps {
  /**
   * Role to display (optional, uses current user if not provided)
   */
  role?: UserRole;
  /**
   * Size variant
   */
  size?: "sm" | "md" | "lg";
  /**
   * Show label text
   */
  showLabel?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * Role color mapping for visual distinction
 */
const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
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

/**
 * Size variants
 */
const SIZE_VARIANTS = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-2.5 py-1 text-sm",
  lg: "px-3 py-1.5 text-base",
};

/**
 * RoleBadge Component
 * Displays user role with appropriate styling
 *
 * @example
 * <RoleBadge /> // Shows current user's role
 * <RoleBadge role={UserRole.ADMIN} size="lg" />
 * <RoleBadge showLabel={false} /> // Just the badge
 */
export function RoleBadge({
  role: propRole,
  size = "md",
  showLabel = true,
  className = "",
}: RoleBadgeProps) {
  const { role: sessionRole, isLoading } = useRBAC();

  const role = propRole ?? sessionRole;

  if (isLoading && !propRole) {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-gray-200 bg-gray-100 ${SIZE_VARIANTS[size]} ${className}`}
      >
        <span className="h-3 w-3 animate-pulse rounded-full bg-gray-300" />
        <span className="ml-1.5 text-gray-400">...</span>
      </span>
    );
  }

  if (!role) {
    return (
      <span
        className={`inline-flex items-center rounded-full border border-gray-200 bg-gray-100 ${SIZE_VARIANTS[size]} text-gray-500 ${className}`}
      >
        <RoleIcon role={null} />
        {showLabel && <span className="ml-1.5">Invité</span>}
      </span>
    );
  }

  const colors = ROLE_COLORS[role];

  return (
    <span
      className={`inline-flex items-center rounded-full border ${colors.bg} ${colors.text} ${colors.border} ${SIZE_VARIANTS[size]} font-medium ${className}`}
      title={`Rôle: ${ROLE_LABELS[role]}`}
    >
      <RoleIcon role={role} />
      {showLabel && <span className="ml-1.5">{ROLE_LABELS[role]}</span>}
    </span>
  );
}

/**
 * Role icon component
 */
function RoleIcon({ role }: { role: UserRole | null }) {
  const iconClass = "h-3 w-3";

  switch (role) {
    case UserRole.ADMIN:
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 1.944A11.954 11.954 0 012.506 7.213 11.956 11.956 0 001.5 10c0 4.694 3.44 8.587 7.93 9.3.37.06.74.06 1.11 0 4.49-.713 7.93-4.606 7.93-9.3 0-.966-.159-1.89-.453-2.75A11.956 11.956 0 0110 1.944zM9 15a1 1 0 100-2 1 1 0 000 2zm1-8a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      );
    case UserRole.OPS:
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>
      );
    case UserRole.SUPPORT:
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
      );
    case UserRole.USER:
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
            clipRule="evenodd"
          />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
            clipRule="evenodd"
          />
        </svg>
      );
  }
}
