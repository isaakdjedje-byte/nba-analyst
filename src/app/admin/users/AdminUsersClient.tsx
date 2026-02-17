'use client';

import { useState } from 'react';
import {
  UserRole,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_COLORS,
} from '@/server/auth/rbac';
import { RoleBadge } from '@/components/auth/RoleBadge';

interface User {
  id: string;
  email: string;
  name?: string | null;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

interface AdminUsersClientProps {
  initialUsers: User[];
  totalUsers: number;
  roleCounts: Record<UserRole, number>;
  currentUserId: string;
}

export function AdminUsersClient({
  initialUsers,
  totalUsers,
  roleCounts,
  currentUserId,
}: AdminUsersClientProps) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmUser, setConfirmUser] = useState<{
    user: User;
    newRole: UserRole;
  } | null>(null);

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setLoading(userId);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/v1/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to update role');
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, role: newRole, updatedAt: new Date() } : u
        )
      );

      setSuccess(`Role mis a jour avec succes pour ${data.data.userId}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(null);
      setConfirmUser(null);
    }
  };

  const openConfirmDialog = (user: User, newRole: UserRole) => {
    setConfirmUser({ user, newRole });
  };

  const closeConfirmDialog = () => {
    setConfirmUser(null);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <p className="text-sm font-medium text-gray-500">Total utilisateurs</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{totalUsers}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.values(UserRole) as UserRole[]).map((role) => (
          <div key={role} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{ROLE_LABELS[role]}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{roleCounts[role]}</p>
              </div>
              <div
                className={`h-10 w-10 rounded-full ${ROLE_COLORS[role].bg} flex items-center justify-center`}
              >
                <span className={`text-lg ${ROLE_COLORS[role].text}`}>{roleCounts[role]}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm font-medium text-green-800">{success}</p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-white shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Utilisateur
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Role actuel
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Change le
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {users.map((user) => (
              <tr key={user.id} className={user.id === currentUserId ? 'bg-amber-50' : ''}>
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.name || user.email}
                        {user.id === currentUserId && (
                          <span className="ml-2 text-xs text-amber-600">(Vous)</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4">
                  <RoleBadge role={user.role} size="sm" />
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {new Date(user.updatedAt).toLocaleDateString('fr-FR')}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                  <select
                    value={user.role}
                    onChange={(e) => openConfirmDialog(user, e.target.value as UserRole)}
                    disabled={
                      loading === user.id ||
                      (user.id === currentUserId && user.role === 'admin')
                    }
                    className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  >
                    {(Object.values(UserRole) as UserRole[]).map((role) => (
                      <option key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>
                  {loading === user.id && <span className="ml-2 text-gray-500">...</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900">Confirmer le changement de role</h3>
            <p className="mt-2 text-sm text-gray-500">
              Voulez-vous vraiment changer le role de{' '}
              <span className="font-semibold">{confirmUser.user.name || confirmUser.user.email}</span>{' '}
              de <span className="font-semibold">{ROLE_LABELS[confirmUser.user.role]}</span>{' '}
              a <span className="font-semibold">{ROLE_LABELS[confirmUser.newRole]}</span>?
            </p>
            <p className="mt-2 text-xs text-amber-600">{ROLE_DESCRIPTIONS[confirmUser.newRole]}</p>
            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={closeConfirmDialog}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={() => handleRoleChange(confirmUser.user.id, confirmUser.newRole)}
                disabled={loading === confirmUser.user.id}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300"
              >
                {loading === confirmUser.user.id ? 'Mise a jour...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
        <h4 className="mb-2 font-medium">Description des roles</h4>
        <ul className="space-y-1">
          {(Object.values(UserRole) as UserRole[]).map((role) => (
            <li key={role} className="flex items-start">
              <span className="mr-2 font-semibold">{ROLE_LABELS[role]}:</span>
              <span>{ROLE_DESCRIPTIONS[role]}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
