/**
 * ResponsiveLayout Component
 * Story 3.8: Layout wrapper avec mobile-first responsive design
 * 
 * AC2: Breakpoints responsifs cohérents
 * AC3: Touch targets >= 44x44px
 * AC4: Performance de chargement mobile
 * AC5: Navigation mobile efficace avec hamburger menu
 */

'use client';

import { ReactNode } from 'react';
import { Header } from './Header';

interface ResponsiveLayoutProps {
  children: ReactNode;
  className?: string;
}

export function ResponsiveLayout({ children, className = '' }: ResponsiveLayoutProps) {
  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      {/* Header with responsive navigation */}
      <Header />
      
      {/* Main content */}
      <main 
        className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-6"
        data-testid="main-content"
      >
        {children}
      </main>
    </div>
  );
}

export default ResponsiveLayout;
