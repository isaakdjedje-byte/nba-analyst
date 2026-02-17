// User Repository - Database operations for user management
// Pattern established in Story 1.2

import { prisma } from "@/server/db/client";
import { UserRole } from "@/server/auth/rbac";

export interface UserWithRole {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserListFilters {
  role?: UserRole;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Get all users with optional filtering
 */
export async function getUsers(
  filters: UserListFilters = {}
): Promise<{ users: UserWithRole[]; total: number }> {
  const where = {
    ...(filters.role && { role: filters.role }),
    ...(filters.search && {
      email: { contains: filters.search, mode: "insensitive" as const },
    }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 50,
      skip: filters.offset ?? 0,
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map((user) => ({
      ...user,
      role: user.role as UserRole,
    })),
    total,
  };
}

/**
 * Get user by ID
 */
export async function getUserById(
  id: string
): Promise<UserWithRole | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
        role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return null;

  return {
    ...user,
    role: user.role as UserRole,
  };
}

/**
 * Update user role
 * Returns the updated user and old role for audit logging
 */
export async function updateUserRole(
  userId: string,
  newRole: UserRole
): Promise<{ user: UserWithRole; oldRole: UserRole } | null> {
  // Get current user first
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!currentUser) return null;

  const oldRole = currentUser.role as UserRole;

  // Update the role
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { role: newRole },
    select: {
      id: true,
      email: true,
        role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    user: {
      ...updatedUser,
      role: updatedUser.role as UserRole,
    },
    oldRole,
  };
}

/**
 * Get user by email
 */
export async function getUserByEmail(
  email: string
): Promise<UserWithRole | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
        role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) return null;

  return {
    ...user,
    role: user.role as UserRole,
  };
}

/**
 * Check if user exists
 */
export async function userExists(id: string): Promise<boolean> {
  const count = await prisma.user.count({
    where: { id },
  });
  return count > 0;
}

/**
 * Count users by role
 */
export async function countUsersByRole(): Promise<
  Record<UserRole, number>
> {
  const results = await prisma.user.groupBy({
    by: ["role"],
    _count: { role: true },
  });

  const counts: Record<UserRole, number> = {
    [UserRole.USER]: 0,
    [UserRole.SUPPORT]: 0,
    [UserRole.OPS]: 0,
    [UserRole.ADMIN]: 0,
  };

  for (const result of results) {
    counts[result.role as UserRole] = result._count.role;
  }

  return counts;
}
