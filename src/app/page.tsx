import { redirect } from 'next/navigation';

/**
 * Home Page
 * Redirects authenticated users to dashboard picks view
 * Unauthenticated users will be redirected to login by middleware
 */
export default function Home() {
  // Redirect to picks (default dashboard view)
  redirect('/dashboard/picks');
}
