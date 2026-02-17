import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/server/auth/auth-options';
import { UserRole } from '@/server/auth/rbac';
import { getUsers, countUsersByRole } from '@/server/repositories/user-repository';
import { AdminUsersClient } from './AdminUsersClient';

export const metadata: Metadata = {
  title: 'Gestion des utilisateurs | NBA Analyst',
  description: 'Administration des roles utilisateurs',
};

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login?callbackUrl=/admin/users');
  }

  const userRole = session.user.role as UserRole;

  if (userRole !== UserRole.ADMIN) {
    redirect('/dashboard/picks?error=insufficient_permissions');
  }

  const { users, total } = await getUsers({ limit: 100 });
  const roleCounts = await countUsersByRole();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Gestion des utilisateurs</h1>
        <p className="mt-1 text-sm text-gray-500">Administration des roles et permissions</p>
      </div>

      <AdminUsersClient
        initialUsers={users}
        totalUsers={total}
        roleCounts={roleCounts}
        currentUserId={session.user.id}
      />
    </div>
  );
}
