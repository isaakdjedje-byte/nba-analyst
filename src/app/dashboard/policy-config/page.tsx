/**
 * Policy Configuration Dashboard Page
 * Story 5.2: Interface admin de gestion des paramètres policy
 */

import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/server/auth/auth-options';
import { PolicyConfigPage } from '@/features/policy/components/PolicyConfigPage';

export default async function PolicyConfigDashboardPage() {
  // Check authentication
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect('/login');
  }

  // Get user role
  const userRole = (session.user.role as string) || 'user';

  return (
    <div className="max-w-4xl mx-auto">
      <PolicyConfigPage userRole={userRole} />
    </div>
  );
}
