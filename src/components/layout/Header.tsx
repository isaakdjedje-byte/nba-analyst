/**
 * Header Component
 * Story 3.8: Combined header with mobile hamburger and desktop navigation
 * 
 * AC1: Hamburger menu on mobile (< 768px), desktop nav on larger screens
 * AC3: Breakpoint switching at 768px (md)
 */

'use client';

import Link from 'next/link';
import { MobileNavigation } from './MobileNavigation';
import { DesktopNavigation } from './DesktopNavigation';

export function Header() {
  return (
    <header
      className="sticky top-0 z-30 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:border-gray-800 dark:bg-gray-900/95 dark:supports-[backdrop-filter]:bg-gray-900/60"
      role="banner"
      data-testid="main-header"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <Link
              href="/"
              className="text-xl font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
              aria-label="NBA Analyst - Accueil"
            >
              NBA Analyst
            </Link>
          </div>

          {/* Desktop Navigation - hidden on mobile */}
          <DesktopNavigation />

          {/* Mobile Navigation - hamburger menu, hidden on desktop */}
          <MobileNavigation />
        </div>
      </div>
    </header>
  );
}

export default Header;
