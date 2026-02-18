/**
 * DashboardShell
 * Provides the consistent layout wrapper for all dashboard views
 * Includes header with user info, navigation tabs, and responsive layout
 * 
 * Story 3.8: Mobile-first responsive design
 * AC2: Breakpoints responsifs cohérents
 * AC3: Touch targets >= 44x44px
 * AC5: Navigation mobile efficace avec Tab transitions <= 1.0s
 */

import { ReactNode } from 'react';
import { DashboardHeader } from './DashboardHeader';
import { TabNavigation } from './TabNavigation';
import { MobileNavigation } from '@/components/layout/MobileNavigation';

interface DashboardShellProps {
  children: ReactNode;
  user: {
    email?: string | null;
    name?: string | null;
    role?: string;
  };
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with user info */}
      <DashboardHeader user={user} />

      {/* Navigation tabs - hidden on mobile, visible on md+ */}
      <div className="hidden md:block">
        <TabNavigation role={user.role} />
      </div>

      {/* Main content area - padding bottom for mobile nav */}
      <main className="mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6 lg:px-8 pb-20 md:pb-6">
        <div className="rounded-lg bg-white shadow dark:bg-gray-800">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation - visible on mobile only */}
      <MobileNavigation role={user.role} />
    </div>
  );
}
