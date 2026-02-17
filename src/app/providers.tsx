/**
 * Application Providers
 * Provides data fetching, caching, and session management
 */

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SessionProvider } from 'next-auth/react';
import { ReactNode, useState } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 5, // 5 seconds
        refetchInterval: 1000 * 10, // Refetch every 10 seconds
        refetchOnWindowFocus: true,
        retry: 2,
      },
    },
  }));

  return (
    <SessionProvider refetchInterval={5 * 60}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}
