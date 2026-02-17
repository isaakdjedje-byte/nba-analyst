/**
 * GuardrailBanner Wrapper
 * Story 3.7: Créer le composant GuardrailBanner pour état global
 * 
 * Client component wrapper for GuardrailBanner with data fetching
 * AC7: Intégration Dashboard - Positionné au-dessus du contenu principal
 */

'use client';

import { useState } from 'react';
import { GuardrailBanner } from './GuardrailBanner';
import { useGuardrailStatus } from '../hooks/useGuardrailStatus';
import type { GuardrailStatus } from '../types';

interface GuardrailBannerWrapperProps {
  /** Use mock data for development/testing */
  useMock?: boolean;
  /** Initial mock status (for testing different states) */
  initialMockStatus?: GuardrailStatus;
}

/**
 * Wrapper component that fetches guardrail status and renders the banner
 * 
 * Features:
 * - Automatically fetches status on mount
 * - Handles loading and error states gracefully
 * - Supports dismiss functionality
 * - Responsive integration with dashboard layout
 * 
 * @example
 * ```tsx
 * // In layout or page
 * <GuardrailBannerWrapper />
 * 
 * // With mock data for testing
 * <GuardrailBannerWrapper useMock initialMockStatus="WARNING" />
 * ```
 */
export function GuardrailBannerWrapper({
  useMock = false,
  initialMockStatus = 'HEALTHY',
}: GuardrailBannerWrapperProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  
  const { status, isLoading } = useGuardrailStatus({
    useMock,
    initialMockStatus,
    refetchOnFocus: true,
  });

  // Show nothing while loading (prevents layout shift)
  if (isLoading) {
    return <div className="h-16 w-full" aria-hidden="true" />;
  }

  // Handle dismissed state - only for HEALTHY
  if (isDismissed && status?.status === 'HEALTHY') {
    return null;
  }

  // Use fetched status or fallback to HEALTHY
  const currentStatus = status?.status ?? 'HEALTHY';

  // Note: Error handling is done in the hook - it sets WARNING status on error
  // No need for additional error check here as status is always defined after loading

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <GuardrailBanner
      status={currentStatus}
      variant="sticky"
      dismissible={currentStatus === 'HEALTHY'}
      onDismiss={handleDismiss}
    />
  );
}

export default GuardrailBannerWrapper;
