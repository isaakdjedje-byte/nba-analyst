/**
 * DashboardHeader
 * Header component with user info and logout functionality
 * Displays user email/role and provides logout action
 */

'use client';

import { signOut } from 'next-auth/react';
import { RoleBadge } from '@/components/auth/RoleBadge';
import { UserRole } from '@/server/auth/rbac';
import { ThemeToggle } from '@/components/theme-toggle';

interface DashboardHeaderProps {
  user: {
    email?: string | null;
    name?: string | null;
    role?: string;
  };
}

/**
 * Convert string role to UserRole enum
 */
function parseUserRole(role?: string): UserRole | undefined {
  if (!role) return undefined;
  const upperRole = role.toUpperCase();
  if (upperRole in UserRole) {
    return UserRole[upperRole as keyof typeof UserRole];
  }
  return undefined;
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const displayName = user.name || user.email || 'Utilisateur';
  const userRole = parseUserRole(user.role);

  return (
    <header
      className="bg-white shadow-sm dark:bg-gray-800"
      data-testid="dashboard-header"
    >
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo / Brand */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              NBA Analyst
            </h1>
          </div>

          {/* User info, theme toggle & logout */}
          <div
            className="flex items-center gap-4"
            data-testid="user-info"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {displayName}
              </span>
              {userRole && (
                <RoleBadge role={userRole} />
              )}
            </div>
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
              data-testid="logout-button"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
