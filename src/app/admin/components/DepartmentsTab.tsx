'use client';

import { useState, useEffect } from 'react';
import type { Department } from '../services/departmentService';
import { getEmployeeCountByDepartment } from '../services/departmentService';

interface DepartmentsTabProps {
  departments: Department[];
  loading: boolean;
  message: string;
  messageType: 'success' | 'error';
  onAddDepartment: (name: string) => Promise<void>;
  onUpdateDepartment: (id: string, oldName: string, newName: string) => Promise<void>;
  onDeleteDepartment: (id: string, name: string, confirmName: string) => Promise<void>;
  onClearMessage: () => void;
}

export function DepartmentsTab({
  departments,
  loading,
  message,
  messageType,
  onAddDepartment,
  onUpdateDepartment,
  onDeleteDepartment,
  onClearMessage,
}: DepartmentsTabProps) {
  const [newName, setNewName] = useState('');
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState('');
  const [employeeCounts, setEmployeeCounts] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (deletingDept || departments.length === 0) return;
    const loadCounts = async () => {
      const counts: Record<string, number> = {};
      for (const d of departments) {
        counts[d.id] = await getEmployeeCountByDepartment(d.name);
      }
      setEmployeeCounts(counts);
    };
    loadCounts();
  }, [departments, deletingDept]);

  const openEdit = (d: Department) => {
    setEditingDept(d);
    setEditName(d.name);
    onClearMessage();
  };

  const openDelete = (d: Department) => {
    setDeletingDept(d);
    setConfirmDeleteName('');
    onClearMessage();
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      await onAddDepartment(newName.trim());
      setNewName('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDept || !editName.trim() || editName.trim() === editingDept.name)
      return;
    setSubmitting(true);
    try {
      await onUpdateDepartment(editingDept.id, editingDept.name, editName.trim());
      setEditingDept(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingDept) return;
    setSubmitting(true);
    try {
      await onDeleteDepartment(deletingDept.id, deletingDept.name, confirmDeleteName);
      setDeletingDept(null);
      setConfirmDeleteName('');
    } finally {
      setSubmitting(false);
    }
  };

  const canDelete = deletingDept && confirmDeleteName.trim() === deletingDept.name;

  return (
    <>
      <div className="mb-8 p-4 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Add New Department</h2>
        <form onSubmit={handleAddSubmit} className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">Department Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="e.g. Construction"
              required
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !newName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add Department'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Department List</h2>
          <p className="text-sm text-gray-600 mt-1">
            Departments are used when adding employees. Editing updates all references.
            Delete requires typing the name exactly and no assigned employees.
          </p>
        </div>

        {message && (
          <div className="px-4 pt-2">
            <p
              className={
                messageType === 'error' ? 'text-red-500' : 'text-green-500'
              }
            >
              {message}
            </p>
          </div>
        )}

        {loading ? (
          <p className="p-4 text-center">Loading departments...</p>
        ) : departments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Employees
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {departments.map((d) => (
                  <tr key={d.id}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      {d.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {employeeCounts[d.id] ?? '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => openEdit(d)}
                        className="text-blue-600 hover:underline mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openDelete(d)}
                        className="text-red-600 hover:underline"
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
          <p className="p-4 text-center">No departments found. Add one above.</p>
        )}
      </div>

      {/* Edit Modal */}
      {editingDept && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Edit Department</h3>
            <form onSubmit={handleEditSubmit}>
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                This will update the department name for all employees and projects.
              </p>
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingDept(null)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || editName.trim() === editingDept.name}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Modal - Harder to confirm */}
      {deletingDept && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4 text-red-600">
              Delete Department
            </h3>
            <p className="text-gray-600 mb-2">
              You are about to delete <strong>{deletingDept.name}</strong>.
            </p>
            {employeeCounts[deletingDept.id] !== undefined &&
              employeeCounts[deletingDept.id] > 0 && (
                <p className="text-red-600 font-medium mb-2">
                  This department has {employeeCounts[deletingDept.id]} employee(s)
                  assigned. Reassign them to another department first.
                </p>
              )}
            <p className="text-sm text-gray-600 mb-3">
              Type <strong>{deletingDept.name}</strong> below to confirm deletion.
            </p>
            <input
              type="text"
              value={confirmDeleteName}
              onChange={(e) => setConfirmDeleteName(e.target.value)}
              className="w-full p-2 border rounded mb-4"
              placeholder={`Type "${deletingDept.name}" to confirm`}
              autoComplete="off"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setDeletingDept(null);
                  setConfirmDeleteName('');
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={
                  submitting ||
                  !canDelete ||
                  (employeeCounts[deletingDept.id] ?? 0) > 0
                }
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
