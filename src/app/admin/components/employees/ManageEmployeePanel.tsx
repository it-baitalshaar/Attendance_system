'use client';

import { useState, useEffect } from 'react';
import {
  Employee,
  EmployeeHistoryRecord,
  EmployeeUpdatePayload,
  EmployeeVacation,
} from '../../types/admin';

/** Departments that use project + overtime entry on the attendance home page. */
const OVERTIME_MANAGED_DEPARTMENTS = new Set(['Construction', 'Maintenance']);

export interface ManageEmployeePanelProps {
  employee: Employee;
  departments: string[];
  onClose: () => void;
  onUpdate: (id: string, payload: EmployeeUpdatePayload) => Promise<void>;
  updateLoading: boolean;
  updateMessage: string;
  history: EmployeeHistoryRecord[];
  historyLoading: boolean;
  /** Approved vacation periods (`employee_vacations`). */
  vacations: EmployeeVacation[];
  vacationLoading: boolean;
  vacationMessage: string;
  vacationSaving: boolean;
  onAddVacation: (payload: { from_date: string; to_date: string; note?: string }) => Promise<void>;
  onDeleteVacation: (id: string) => Promise<void>;
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
  vacations,
  vacationLoading,
  vacationMessage,
  vacationSaving,
  onAddVacation,
  onDeleteVacation,
}: ManageEmployeePanelProps) {
  const [name, setName] = useState(employee.name);
  const [position, setPosition] = useState(employee.position);
  const [department, setDepartment] = useState(employee.department);
  const [status, setStatus] = useState(employee.status || 'active');
  const [salary, setSalary] = useState<string>(
    employee.salary != null ? String(employee.salary) : ''
  );
  const [overtimeEnabled, setOvertimeEnabled] = useState(
    employee.overtime_enabled !== false
  );
  const [joiningDate, setJoiningDate] = useState(
    employee.joining_date ? String(employee.joining_date).slice(0, 10) : ''
  );
  /** New vacation period being added. */
  const [vacationFrom, setVacationFrom] = useState('');
  const [vacationTo, setVacationTo] = useState('');
  const [vacationNote, setVacationNote] = useState('');
  const [vacationError, setVacationError] = useState('');

  useEffect(() => {
    setName(employee.name);
    setPosition(employee.position);
    setDepartment(employee.department);
    setStatus(employee.status || 'active');
    setSalary(employee.salary != null ? String(employee.salary) : '');
    setOvertimeEnabled(employee.overtime_enabled !== false);
    setJoiningDate(
      employee.joining_date ? String(employee.joining_date).slice(0, 10) : ''
    );
  }, [employee]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const deptTrim = department.trim();
    const payload: EmployeeUpdatePayload = {
      name: name.trim(),
      position: position.trim(),
      department: deptTrim,
      status,
      salary: salary.trim() === '' ? null : Number(salary),
      joining_date: joiningDate.trim() === '' ? null : joiningDate.trim(),
    };
    if (OVERTIME_MANAGED_DEPARTMENTS.has(deptTrim)) {
      payload.overtime_enabled = overtimeEnabled;
    }
    // Use employee_id (e.g. BS0021) for update — your Employee table has no id/uuid column.
    onUpdate(employee.employee_id, payload);
  };

  const showOvertimeToggle = OVERTIME_MANAGED_DEPARTMENTS.has(department.trim());

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch {
      return iso;
    }
  };

  /** YYYY-MM-DD -> "Nov 16, 2026" (date-only columns have no time/zone). */
  const formatDay = (iso: string) => {
    const text = String(iso ?? '').slice(0, 10);
    try {
      return new Date(text + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return text;
    }
  };

  const handleAddVacationClick = () => {
    setVacationError('');
    if (!vacationFrom || !vacationTo) {
      setVacationError('Select both a start and an end date.');
      return;
    }
    if (vacationTo < vacationFrom) {
      setVacationError('End date must be on or after the start date.');
      return;
    }
    onAddVacation({
      from_date: vacationFrom,
      to_date: vacationTo,
      note: vacationNote.trim() || undefined,
    });
    setVacationFrom('');
    setVacationTo('');
    setVacationNote('');
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
              <div>
                <label className="block text-sm font-medium mb-1">Joining date</label>
                <input
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="w-full p-2 border rounded"
                />
                <p className="mt-1 text-xs text-gray-500">
                  The Attendance Report hides days before this date.
                </p>
              </div>
              {showOvertimeToggle && (
                <div className="md:col-span-2 flex items-center gap-2">
                  <input
                    id="manage-employee-overtime"
                    type="checkbox"
                    checked={overtimeEnabled}
                    onChange={(e) => setOvertimeEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <label htmlFor="manage-employee-overtime" className="text-sm font-medium">
                    Allow overtime (Construction / Maintenance attendance)
                  </label>
                </div>
              )}
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

          <div className="mb-6">
            <h3 className="text-lg font-medium mb-1">Vacation periods</h3>
            <p className="text-xs text-gray-500 mb-2">
              Days inside a vacation period are counted as Vacation (V) in the Attendance Report —
              they are never listed as &ldquo;no attendance record&rdquo;. Use this when someone
              stops being submitted mid-month because they are on leave.
            </p>

            {vacationLoading ? (
              <p className="text-gray-500 text-sm">Loading vacation periods...</p>
            ) : vacations.length === 0 ? (
              <p className="text-gray-500 text-sm">No vacation periods recorded.</p>
            ) : (
              <ul className="border rounded divide-y max-h-40 overflow-y-auto mb-3">
                {vacations.map((vacation) => (
                  <li
                    key={vacation.id}
                    className="p-2 text-sm flex items-center justify-between gap-2"
                  >
                    <span>
                      <span className="font-medium">
                        {formatDay(vacation.from_date)} → {formatDay(vacation.to_date)}
                      </span>
                      {vacation.note && (
                        <span className="text-gray-600"> — {vacation.note}</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteVacation(vacation.id)}
                      disabled={vacationSaving}
                      className="text-red-600 hover:text-red-800 text-xs font-medium disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600">From</label>
                <input
                  type="date"
                  value={vacationFrom}
                  onChange={(e) => setVacationFrom(e.target.value)}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600">To</label>
                <input
                  type="date"
                  value={vacationTo}
                  onChange={(e) => setVacationTo(e.target.value)}
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1 text-gray-600">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={vacationNote}
                  onChange={(e) => setVacationNote(e.target.value)}
                  placeholder="e.g. Annual leave"
                  className="w-full p-2 border rounded"
                />
              </div>
            </div>

            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleAddVacationClick}
                disabled={vacationSaving}
                className="px-3 py-1.5 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {vacationSaving ? 'Saving...' : 'Add vacation period'}
              </button>
              {vacationError && <span className="text-xs text-red-600">{vacationError}</span>}
              {!vacationError && vacationMessage && (
                <span
                  className={`text-xs ${
                    vacationMessage.includes('Failed') ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {vacationMessage}
                </span>
              )}
            </div>
          </div>

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
