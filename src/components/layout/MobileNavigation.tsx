/**
 * MobileNavigation Component
 * Story 3.8: Hamburger menu navigation for mobile (< 768px)
 * 
 * AC1: Navigation hamburger menu on mobile (< 768px)
 * AC3: Touch targets >= 44x44px
 * AC6: Accessible with keyboard and ARIA attributes
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Trophy, Ban, TrendingUp, History, Settings, X, Menu, Shield } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard/picks', label: 'Picks', icon: Trophy, testId: 'mobile-nav-link-picks' },
  { href: '/dashboard/no-bet', label: 'No-Bet', icon: Ban, testId: 'mobile-nav-link-no-bet' },
  { href: '/dashboard/performance', label: 'Performance', icon: TrendingUp, testId: 'mobile-nav-link-performance' },
  { href: '/dashboard/logs', label: 'Logs', icon: History, testId: 'mobile-nav-link-logs' },
  { href: '/dashboard/policy-config', label: 'Policy', icon: Shield, testId: 'mobile-nav-link-policy' },
  { href: '/settings', label: 'Paramètres', icon: Settings, testId: 'mobile-nav-link-settings' },
];

export function MobileNavigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isActive = (href: string): boolean => {
    return pathname?.startsWith(href) ?? false;
  };

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  // Close menu on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMenuOpen) {
        closeMenu();
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMenuOpen, closeMenu]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isMenuOpen &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        closeMenu();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen, closeMenu]);

  // Close menu on route change
  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  return (
    <div className="md:hidden">
      {/* Hamburger Button */}
      <button
        ref={buttonRef}
        type="button"
        data-testid="mobile-hamburger-menu"
        aria-label={isMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={isMenuOpen}
        aria-controls="mobile-navigation-menu"
        onClick={toggleMenu}
        className={`
          flex items-center justify-center
          min-h-[44px] min-w-[44px]
          rounded-lg
          transition-colors duration-150
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${isMenuOpen
            ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200'
          }
        `}
      >
        {isMenuOpen ? (
          <X className="w-6 h-6" aria-hidden="true" />
        ) : (
          <Menu className="w-6 h-6" aria-hidden="true" />
        )}
      </button>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          aria-hidden="true"
          onClick={closeMenu}
        />
      )}

      {/* Mobile Navigation Menu */}
      <div
        ref={menuRef}
        id="mobile-navigation-menu"
        data-testid="mobile-navigation-menu"
        className={`
          fixed top-0 right-0 bottom-0 w-[280px] max-w-[80vw]
          bg-white dark:bg-gray-900
          shadow-xl
          z-50 md:hidden
          transform transition-transform duration-300 ease-in-out
          ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
        aria-label="Menu de navigation mobile"
        role="dialog"
        aria-modal="true"
        hidden={!isMenuOpen}
      >
        {/* Menu Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Menu
          </h2>
          <button
            type="button"
            onClick={closeMenu}
            aria-label="Fermer le menu"
            className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <X className="w-6 h-6 text-gray-600 dark:text-gray-400" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-4" role="navigation" aria-label="Navigation mobile">
          <ul className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    data-testid={item.testId}
                    aria-current={active ? 'page' : undefined}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg
                      min-h-[44px]
                      transition-colors duration-150
                      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                      ${active
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                      }
                    `}
                    onClick={closeMenu}
                  >
                    <Icon className={`w-5 h-5 flex-shrink-0 ${active ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

export default MobileNavigation;
