'use client';

import { useState } from 'react';
import type {
  Project,
  ProjectDepartment,
  ProjectStatus,
} from '../services/projectService';

const PROJECT_DEPARTMENTS: { value: ProjectDepartment; label: string }[] = [
  { value: 'Construction', label: 'Construction' },
  { value: 'Maintenance', label: 'Maintenance' },
  { value: 'Construction Maintenance', label: 'Construction & Maintenance (Shared)' },
];

const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: 'active', label: 'Active (shows in attendance)' },
  { value: 'none active', label: 'Paused (hidden from attendance)' },
];

interface ProjectsTabProps {
  projects: Project[];
  loading: boolean;
  message: string;
  messageType: 'success' | 'error';
  onAddProject: (
    projectName: string,
    department: ProjectDepartment,
    projectStatus: ProjectStatus
  ) => Promise<void>;
  onUpdateProject: (
    projectId: string,
    updates: {
      project_name?: string;
      department?: ProjectDepartment;
      project_status?: ProjectStatus;
    }
  ) => Promise<void>;
  onClearMessage: () => void;
}

export function ProjectsTab({
  projects,
  loading,
  message,
  messageType,
  onAddProject,
  onUpdateProject,
  onClearMessage,
}: ProjectsTabProps) {
  const [newName, setNewName] = useState('');
  const [newDepartment, setNewDepartment] =
    useState<ProjectDepartment>('Construction');
  const [newStatus, setNewStatus] = useState<ProjectStatus>('active');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDepartment, setEditDepartment] =
    useState<ProjectDepartment>('Construction');
  const [editStatus, setEditStatus] = useState<ProjectStatus>('active');
  const [submitting, setSubmitting] = useState(false);

  const openEdit = (p: Project) => {
    setEditingProject(p);
    setEditName(p.project_name);
    setEditDepartment(p.department);
    setEditStatus(p.project_status);
    onClearMessage();
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      await onAddProject(newName.trim(), newDepartment, newStatus);
      setNewName('');
      setNewDepartment('Construction');
      setNewStatus('active');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    const nameUnchanged = editName.trim() === editingProject.project_name;
    const deptUnchanged = editDepartment === editingProject.department;
    const statusUnchanged = editStatus === editingProject.project_status;
    if (nameUnchanged && deptUnchanged && statusUnchanged) {
      setEditingProject(null);
      return;
    }
    setSubmitting(true);
    try {
      await onUpdateProject(editingProject.project_id, {
        project_name: editName.trim(),
        department: editDepartment,
        project_status: editStatus,
      });
      setEditingProject(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="mb-8 p-4 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Add New Project</h2>
        <form onSubmit={handleAddSubmit} className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium mb-1">Project Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="e.g. Site A Maintenance"
              required
            />
          </div>
          <div className="min-w-[180px]">
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={newDepartment}
              onChange={(e) =>
                setNewDepartment(e.target.value as ProjectDepartment)
              }
              className="w-full p-2 border rounded"
            >
              {PROJECT_DEPARTMENTS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as ProjectStatus)}
              className="w-full p-2 border rounded"
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting || !newName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add Project'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Project List</h2>
          <p className="text-sm text-gray-600 mt-1">
            Projects appear in the attendance system when active. Pause projects
            to hide them from dropdowns. Type (Construction/Maintenance) controls
            which department sees them.
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
          <p className="p-4 text-center">Loading projects...</p>
        ) : projects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Project Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projects.map((p) => (
                  <tr key={p.project_id}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">
                      {p.project_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {PROJECT_DEPARTMENTS.find((d) => d.value === p.department)
                        ?.label ?? p.department}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs rounded-full ${
                          p.project_status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {p.project_status === 'active' ? 'Active' : 'Paused'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => openEdit(p)}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-4 text-center">No projects found. Add one above.</p>
        )}
      </div>

      {/* Edit Modal */}
      {editingProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Edit Project</h3>
            <form onSubmit={handleEditSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full p-2 border rounded"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    value={editDepartment}
                    onChange={(e) =>
                      setEditDepartment(e.target.value as ProjectDepartment)
                    }
                    className="w-full p-2 border rounded"
                  >
                    {PROJECT_DEPARTMENTS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Construction or Maintenance only, or shared for both.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as ProjectStatus)
                    }
                    className="w-full p-2 border rounded"
                  >
                    {PROJECT_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Paused projects are hidden from the attendance dropdowns.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
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
    </>
  );
}
