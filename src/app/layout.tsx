import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ResponsiveLayout } from '@/components/layout';
import { WebVitalsProvider } from '@/components/WebVitalsProvider';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'NBA Analyst',
  description: 'AI-powered sports betting decision platform',
};

// Story 3.8: Viewport configuration for mobile-first responsive design (AC2, AC5)
// - width=device-width: Required for responsive breakpoints to work
// - initial-scale=1: Prevents zoom on page load
// - viewport-fit=cover: Required for safe area insets on iOS (iPhone X+)
// - maximum-scale=5: Allows user zoom up to 5x for accessibility while preventing auto-zoom
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1.3, // AC5: Prevent auto-zoom but allow minimal zoom for accessibility (prevents layout issues)
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <Providers>
          <ThemeProvider>
            <WebVitalsProvider />
            <ResponsiveLayout>
              {children}
            </ResponsiveLayout>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
