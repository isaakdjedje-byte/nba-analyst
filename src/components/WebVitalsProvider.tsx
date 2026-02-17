/**
 * Web Vitals Provider
 * Story 3.8: AC4 - Client component wrapper for Web Vitals monitoring
 *
 * Must be a client component to access window and initialize web-vitals
 */

'use client';

import { useEffect } from 'react';
import { initWebVitals } from '@/lib/vitals';

export function WebVitalsProvider() {
  useEffect(() => {
    // Initialize Web Vitals monitoring once on mount
    initWebVitals();
  }, []);

  // This component doesn't render anything visible
  return null;
}

export default WebVitalsProvider;
