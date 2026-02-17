/**
 * TabNavigation
 * Navigation tabs for dashboard: Picks, No-Bet, Performance, Logs
 * Uses Next.js Link for client-side navigation with active state
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface Tab {
  label: string;
  href: string;
  testId: string;
}

const TABS: Tab[] = [
  { label: 'Picks', href: '/dashboard/picks', testId: 'nav-tab-picks' },
  { label: 'No-Bet', href: '/dashboard/no-bet', testId: 'nav-tab-no-bet' },
  { label: 'Performance', href: '/dashboard/performance', testId: 'nav-tab-performance' },
  { label: 'Logs', href: '/dashboard/logs', testId: 'nav-tab-logs' },
];

export function TabNavigation() {
  const pathname = usePathname();

  // Determine active tab based on current pathname
  const getActiveTab = (): string => {
    const activeTab = TABS.find((tab) => pathname?.startsWith(tab.href));
    return activeTab?.href || TABS[0].href;
  };

  const activeTab = getActiveTab();

  return (
    <nav
      className="border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
      role="navigation"
      aria-label="Navigation principale"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex space-x-8" role="tablist">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                data-testid={tab.testId}
                className={`
                  relative py-4 text-sm font-medium transition-colors
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }
                `}
                prefetch={true}
              >
                {tab.label}
                {/* Active indicator */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
