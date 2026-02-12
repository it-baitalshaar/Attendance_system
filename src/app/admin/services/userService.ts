import { SystemUser } from '../types/admin';

export interface FetchUsersResponse {
  users: SystemUser[];
}

export async function fetchUsersService(): Promise<FetchUsersResponse> {
  const res = await fetch('/api/admin-users', { credentials: 'include' });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch users');
  }

  const data = await res.json();
  return { users: data.users };
}

export interface UpdateUserProfilePayload {
  userId: string;
  role?: string;
  department?: string | null;
}

export async function updateUserProfileService(
  payload: UpdateUserProfilePayload
): Promise<void> {
  const res = await fetch('/api/admin-users', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      userId: payload.userId,
      role: payload.role,
      department: payload.department,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update user');
  }
}

export interface UpdateUserPasswordPayload {
  userId: string;
  newPassword: string;
}

export async function updateUserPasswordService(
  payload: UpdateUserPasswordPayload
): Promise<void> {
  const res = await fetch('/api/admin-update-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      userId: payload.userId,
      newPassword: payload.newPassword,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update password');
  }
}

export interface CreateUserPayload {
  email: string;
  password: string;
  role?: string;
  department?: string | null;
}

export async function createUserService(payload: CreateUserPayload): Promise<void> {
  const res = await fetch('/api/admin-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      role: payload.role,
      department: payload.department,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to create user');
  }
}

export async function deleteUserService(userId: string): Promise<void> {
  const res = await fetch(`/api/admin-users?userId=${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete user');
  }
}
