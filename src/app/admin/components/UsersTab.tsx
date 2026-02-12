'use client';

import { useState } from 'react';
import { SystemUser } from '../types/admin';

function normalizeRole(role: string): string {
  const map: Record<string, string> = {
    manger: 'manager',
    'supervisor ': 'supervisor',
    admin: 'admin',
    manager: 'manager',
    supervisor: 'supervisor',
    regular_user: 'regular_user',
  };
  return map[role?.trim?.()?.toLowerCase?.()] || role || 'regular_user';
}

function formatRole(role: string): string {
  const normalized = normalizeRole(role);
  const labels: Record<string, string> = {
    admin: 'Admin',
    manager: 'Manager',
    supervisor: 'Supervisor',
    regular_user: 'Regular User',
  };
  return labels[normalized] || role || 'Regular User';
}

interface UsersTabProps {
  users: SystemUser[];
  loading: boolean;
  message: string;
  messageType: 'success' | 'error';
  roles: readonly { value: string; label: string }[];
  departments: readonly { value: string; label: string }[];
  onUpdateProfile: (payload: {
    userId: string;
    role?: string;
    department?: string | null;
  }) => Promise<void>;
  onUpdatePassword: (userId: string, newPassword: string) => Promise<void>;
  onDeleteUser: (userId: string) => Promise<void>;
  onAddUser: (payload: {
    email: string;
    password: string;
    role?: string;
    department?: string | null;
  }) => Promise<void>;
  currentUserId: string | null;
  onClearMessage: () => void;
}

export function UsersTab({
  users,
  loading,
  message,
  messageType,
  roles,
  departments,
  onUpdateProfile,
  onUpdatePassword,
  onDeleteUser,
  onAddUser,
  currentUserId,
  onClearMessage,
}: UsersTabProps) {
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<SystemUser | null>(null);
  const [deletingUser, setDeletingUser] = useState<SystemUser | null>(null);
  const [editForm, setEditForm] = useState({ role: '', department: '' });
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    role: 'regular_user',
    department: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const openEdit = (user: SystemUser) => {
    setEditingUser(user);
    setEditForm({
      role: normalizeRole(user.role),
      department: user.department || '',
    });
    onClearMessage();
  };

  const openPassword = (user: SystemUser) => {
    setPasswordUser(user);
    setPasswordForm({ newPassword: '', confirmPassword: '' });
    onClearMessage();
  };

  const openDelete = (user: SystemUser) => {
    setDeletingUser(user);
    onClearMessage();
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;
    setSubmitting(true);
    try {
      await onDeleteUser(deletingUser.id);
      setDeletingUser(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newUserForm.password !== newUserForm.confirmPassword) return;
    if (newUserForm.password.length < 6) return;
    setSubmitting(true);
    try {
      await onAddUser({
        email: newUserForm.email,
        password: newUserForm.password,
        role: newUserForm.role,
        department: newUserForm.department || null,
      });
      setNewUserForm({
        email: '',
        password: '',
        confirmPassword: '',
        role: 'regular_user',
        department: '',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSubmitting(true);
    try {
      await onUpdateProfile({
        userId: editingUser.id,
        role: editForm.role,
        department: editForm.department || null,
      });
      setEditingUser(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordUser) return;
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      return;
    }
    setSubmitting(true);
    try {
      await onUpdatePassword(passwordUser.id, passwordForm.newPassword);
      setPasswordUser(null);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesRole =
      !filterRole ||
      normalizeRole(u.role) === filterRole;
    const matchesSearch =
      !searchQuery ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  return (
    <>
      <div className="mb-8 p-4 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Add New User</h2>
        <form onSubmit={handleAddUserSubmit} className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                value={newUserForm.email}
                onChange={(e) =>
                  setNewUserForm((prev) => ({ ...prev, email: e.target.value }))
                }
                className="w-full p-2 border rounded"
                required
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input
                type="password"
                value={newUserForm.password}
                onChange={(e) =>
                  setNewUserForm((prev) => ({ ...prev, password: e.target.value }))
                }
                className="w-full p-2 border rounded"
                required
                minLength={6}
                placeholder="Min 6 characters"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Confirm Password</label>
              <input
                type="password"
                value={newUserForm.confirmPassword}
                onChange={(e) =>
                  setNewUserForm((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }))
                }
                className="w-full p-2 border rounded"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role</label>
              <select
                value={newUserForm.role}
                onChange={(e) =>
                  setNewUserForm((prev) => ({ ...prev, role: e.target.value }))
                }
                className="w-full p-2 border rounded"
              >
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Department</label>
              <select
                value={newUserForm.department}
                onChange={(e) =>
                  setNewUserForm((prev) => ({
                    ...prev,
                    department: e.target.value,
                  }))
                }
                className="w-full p-2 border rounded"
              >
                {departments.map((d) => (
                  <option key={d.value || 'none'} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={
              submitting ||
              newUserForm.password.length < 6 ||
              newUserForm.password !== newUserForm.confirmPassword
            }
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add User'}
          </button>
        </form>

        <h2 className="text-xl font-semibold mb-4">Manage Users</h2>
        <p className="text-gray-600 text-sm mb-4">
          Review and manage admins, supervisors, and managers who can submit
          attendance. Edit roles, assign departments, or change passwords.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <input
            type="text"
            placeholder="Search by email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="p-2 border rounded flex-1 max-w-xs"
          />
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="p-2 border rounded w-48"
          >
            <option value="">All roles</option>
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {message && (
          <p
            className={`mb-2 ${
              messageType === 'error' ? 'text-red-500' : 'text-green-500'
            }`}
          >
            {message}
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">User List</h2>
        </div>

        {loading ? (
          <p className="p-4 text-center">Loading users...</p>
        ) : filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          normalizeRole(user.role) === 'admin'
                            ? 'bg-purple-100 text-purple-800'
                            : normalizeRole(user.role) === 'manager'
                              ? 'bg-blue-100 text-blue-800'
                              : normalizeRole(user.role) === 'supervisor'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {formatRole(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {user.department || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => openEdit(user)}
                        className="text-blue-600 hover:underline mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openPassword(user)}
                        className="text-amber-600 hover:underline mr-3"
                      >
                        Change Password
                      </button>
                      <button
                        onClick={() => openDelete(user)}
                        disabled={user.id === currentUserId}
                        className="text-red-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                        title={
                          user.id === currentUserId
                            ? 'Cannot delete your own account'
                            : 'Delete user'
                        }
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-4 text-center">
            {searchQuery || filterRole
              ? 'No users match your filters'
              : 'No users found'}
          </p>
        )}
      </div>

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              Edit User: {editingUser.email}
            </h3>
            <form onSubmit={handleEditSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Role
                  </label>
                  <select
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, role: e.target.value }))
                    }
                    className="w-full p-2 border rounded"
                    required
                  >
                    {roles.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Department
                  </label>
                  <select
                    value={editForm.department}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        department: e.target.value,
                      }))
                    }
                    className="w-full p-2 border rounded"
                  >
                    {departments.map((d) => (
                      <option key={d.value || 'none'} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 text-red-600">
              Delete User
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete <strong>{deletingUser.email}</strong>?
              This will permanently remove their account and they will no longer be
              able to log in.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={submitting}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {passwordUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              Change Password: {passwordUser.email}
            </h3>
            <form onSubmit={handlePasswordSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        newPassword: e.target.value,
                      }))
                    }
                    className="w-full p-2 border rounded"
                    placeholder="Min 6 characters"
                    minLength={6}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        confirmPassword: e.target.value,
                      }))
                    }
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                {passwordForm.newPassword &&
                  passwordForm.newPassword !== passwordForm.confirmPassword && (
                    <p className="text-red-500 text-sm">
                      Passwords do not match
                    </p>
                  )}
              </div>
              <div className="mt-6 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setPasswordUser(null)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    passwordForm.newPassword.length < 6 ||
                    passwordForm.newPassword !== passwordForm.confirmPassword
                  }
                  className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
