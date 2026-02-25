'use client';

import { useState, useEffect } from 'react';
import { Employee, EmployeeHistoryRecord, EmployeeUpdatePayload } from '../../types/admin';

export interface ManageEmployeePanelProps {
  employee: Employee;
  departments: string[];
  onClose: () => void;
  onUpdate: (id: string, payload: EmployeeUpdatePayload) => Promise<void>;
  updateLoading: boolean;
  updateMessage: string;
  history: EmployeeHistoryRecord[];
  historyLoading: boolean;
}

export function ManageEmployeePanel({
  employee,
  departments,
  onClose,
  onUpdate,
  updateLoading,
  updateMessage,
  history,
  historyLoading,
}: ManageEmployeePanelProps) {
  const [name, setName] = useState(employee.name);
  const [position, setPosition] = useState(employee.position);
  const [department, setDepartment] = useState(employee.department);
  const [status, setStatus] = useState(employee.status || 'active');
  const [salary, setSalary] = useState<string>(
    employee.salary != null ? String(employee.salary) : ''
  );

  useEffect(() => {
    setName(employee.name);
    setPosition(employee.position);
    setDepartment(employee.department);
    setStatus(employee.status || 'active');
    setSalary(employee.salary != null ? String(employee.salary) : '');
  }, [employee]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: EmployeeUpdatePayload = {
      name: name.trim(),
      position: position.trim(),
      department: department.trim(),
      status,
      salary: salary.trim() === '' ? null : Number(salary),
    };
    // Use employee_id (e.g. BS0021) for update — your Employee table has no id/uuid column.
    onUpdate(employee.employee_id, payload);
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">Manage Employee</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="space-y-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Employee ID</label>
                <input
                  type="text"
                  value={employee.employee_id}
                  readOnly
                  className="w-full p-2 border rounded bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Position</label>
                <input
                  type="text"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full p-2 border rounded"
                  required
                >
                  <option value="">Select Department</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Salary</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Optional"
                />
              </div>
            </div>

            {updateMessage && (
              <p
                className={`text-sm ${
                  updateMessage.includes('Failed') ? 'text-red-500' : 'text-green-500'
                }`}
              >
                {updateMessage}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={updateLoading}
              >
                {updateLoading ? 'Saving...' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="border border-gray-300 px-4 py-2 rounded hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </form>

          <div>
            <h3 className="text-lg font-medium mb-2">History</h3>
            {historyLoading ? (
              <p className="text-gray-500 text-sm">Loading history...</p>
            ) : history.length === 0 ? (
              <p className="text-gray-500 text-sm">No history yet.</p>
            ) : (
              <ul className="space-y-2 border rounded divide-y max-h-48 overflow-y-auto">
                {history.map((record) => (
                  <li key={record.id} className="p-2 text-sm">
                    <span className="font-medium">{record.action}</span>
                    {record.details && (
                      <span className="text-gray-600"> — {record.details}</span>
                    )}
                    <span className="block text-gray-400 text-xs mt-0.5">
                      {formatDate(record.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
