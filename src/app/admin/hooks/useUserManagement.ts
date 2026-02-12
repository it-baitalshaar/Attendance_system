import { useEffect, useState, useCallback } from 'react';
import {
  fetchUsersService,
  updateUserProfileService,
  updateUserPasswordService,
  deleteUserService,
  createUserService,
} from '../services/userService';
import { fetchDepartmentsService } from '../services/departmentService';
import { SystemUser } from '../types/admin';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'regular_user', label: 'Regular User' },
] as const;

function formatDepartmentsFromDb(names: string[]) {
  return [
    { value: '', label: 'No Department' },
    ...names.map((n) => ({ value: n, label: n })),
  ];
}

export function useUserManagement(enabled = false) {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [departments, setDepartments] = useState<readonly { value: string; label: string }[]>(
    () => [{ value: '', label: 'No Department' }]
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  const loadUsers = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setMessage('');
    try {
      const [fetchedUsers, deptList] = await Promise.all([
        fetchUsersService(),
        fetchDepartmentsService(),
      ]);
      setUsers(fetchedUsers.users);
      setDepartments(formatDepartmentsFromDb(deptList.map((d) => d.name)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load users';
      setMessage(msg);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) loadUsers();
  }, [enabled, loadUsers]);

  const updateProfile = async (payload: {
    userId: string;
    role?: string;
    department?: string | null;
  }) => {
    setMessage('');
    try {
      await updateUserProfileService(payload);
      setMessage('User updated successfully');
      setMessageType('success');
      await loadUsers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update user';
      setMessage(msg);
      setMessageType('error');
    }
  };

  const updatePassword = async (userId: string, newPassword: string) => {
    setMessage('');
    try {
      await updateUserPasswordService({ userId, newPassword });
      setMessage('Password updated successfully');
      setMessageType('success');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to update password';
      setMessage(msg);
      setMessageType('error');
    }
  };

  const deleteUser = async (userId: string) => {
    setMessage('');
    try {
      await deleteUserService(userId);
      setMessage('User deleted successfully');
      setMessageType('success');
      await loadUsers();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to delete user';
      setMessage(msg);
      setMessageType('error');
    }
  };

  const addUser = async (payload: {
    email: string;
    password: string;
    role?: string;
    department?: string | null;
  }) => {
    setMessage('');
    try {
      await createUserService(payload);
      setMessage('User created successfully');
      setMessageType('success');
      await loadUsers();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to create user';
      setMessage(msg);
      setMessageType('error');
    }
  };

  return {
    users,
    loading,
    message,
    messageType,
    roles: ROLES,
    departments,
    loadUsers,
    updateProfile,
    updatePassword,
    deleteUser,
    addUser,
    setMessage,
  };
}
