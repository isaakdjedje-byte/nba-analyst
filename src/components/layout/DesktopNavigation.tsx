/**
 * DesktopNavigation Component
 * Story 3.8: Desktop navigation for screens >= 768px
 * 
 * AC1: Desktop navigation visible above 768px
 * AC3: Navigation links with proper spacing
 * AC6: Touch targets >= 44x44px
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, Ban, TrendingUp, History, Settings, Shield } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard/picks', label: 'Picks', icon: Trophy, testId: 'desktop-nav-picks' },
  { href: '/dashboard/no-bet', label: 'No-Bet', icon: Ban, testId: 'desktop-nav-no-bet' },
  { href: '/dashboard/performance', label: 'Performance', icon: TrendingUp, testId: 'desktop-nav-performance' },
  { href: '/dashboard/logs', label: 'Logs', icon: History, testId: 'desktop-nav-logs' },
  { href: '/dashboard/policy-config', label: 'Policy', icon: Shield, testId: 'desktop-nav-policy' },
  { href: '/settings', label: 'Paramètres', icon: Settings, testId: 'desktop-nav-settings' },
];

export function DesktopNavigation() {
  const pathname = usePathname();

  const isActive = (href: string): boolean => {
    return pathname?.startsWith(href) ?? false;
  };

  return (
    <nav
      className="hidden md:flex items-center gap-1"
      role="navigation"
      aria-label="Navigation principale"
      data-testid="desktop-navigation"
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            data-testid={item.testId}
            aria-current={active ? 'page' : undefined}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg
              min-h-[44px] min-w-[44px]
              transition-colors duration-150
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${active
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
              }
            `}
          >
            <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5px]' : 'stroke-2'}`} />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default DesktopNavigation;
