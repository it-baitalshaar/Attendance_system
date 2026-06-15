'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Department } from '../services/departmentService';
import {
  createDepartmentHolidayService,
  deleteDepartmentHolidayService,
  fetchDepartmentHolidaysService,
  type DepartmentHoliday,
} from '../services/holidayService';
import { formatWeekendDaysSummary } from '@/app/lib/overtimeCalendar';

interface DepartmentHolidaysSectionProps {
  departments: Department[];
}

export function DepartmentHolidaysSection({ departments }: DepartmentHolidaysSectionProps) {
  const [holidays, setHolidays] = useState<DepartmentHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [holidayDepartmentId, setHolidayDepartmentId] = useState<string>('all');
  const [submitting, setSubmitting] = useState(false);

  const loadHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchDepartmentHolidaysService();
      setHolidays(rows);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to load holidays');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHolidays();
  }, [loadHolidays]);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !holidayName.trim()) return;
    setSubmitting(true);
    setMessage('');
    try {
      await createDepartmentHolidayService({
        departmentId: holidayDepartmentId === 'all' ? null : holidayDepartmentId,
        holidayDate,
        name: holidayName.trim(),
      });
      setHolidayDate('');
      setHolidayName('');
      setHolidayDepartmentId('all');
      setMessage('Holiday added. Attendance on this date will default to holiday overtime (×2.5).');
      setMessageType('success');
      await loadHolidays();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to add holiday');
      setMessageType('error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    setMessage('');
    try {
      await deleteDepartmentHolidayService(id);
      setMessage('Holiday removed.');
      setMessageType('success');
      await loadHolidays();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to remove holiday');
      setMessageType('error');
    }
  };

  return (
    <div className="mt-8 bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold">Weekend &amp; holiday calendar</h2>
        <p className="text-sm text-gray-600 mt-1">
          Configure weekend days per department (weekend overtime ×1.5) and named public holidays
          (holiday overtime ×2.5). Supervisors see these as defaults when logging attendance.
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Current defaults: Construction → {formatWeekendDaysSummary([6])}; Maintenance →{' '}
          {formatWeekendDaysSummary([0])} (until customized per department below).
        </p>
      </div>

      {message && (
        <div className="px-4 pt-3">
          <p className={messageType === 'error' ? 'text-red-600' : 'text-green-600'}>{message}</p>
        </div>
      )}

      <div className="p-4 border-b">
        <h3 className="font-medium mb-3">Add public holiday</h3>
        <form onSubmit={handleAddHoliday} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Date</label>
            <input
              type="date"
              value={holidayDate}
              onChange={(e) => setHolidayDate(e.target.value)}
              className="p-2 border rounded"
              required
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium mb-1">Reason / name</label>
            <input
              type="text"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="e.g. Eid ul Adha"
              required
            />
          </div>
          <div className="min-w-[180px]">
            <label className="block text-sm font-medium mb-1">Applies to</label>
            <select
              value={holidayDepartmentId}
              onChange={(e) => setHolidayDepartmentId(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="all">All departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={submitting || !holidayDate || !holidayName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Add holiday'}
          </button>
        </form>
      </div>

      <div className="p-4">
        <h3 className="font-medium mb-3">Scheduled holidays</h3>
        {loading ? (
          <p className="text-gray-500">Loading holidays…</p>
        ) : holidays.length === 0 ? (
          <p className="text-gray-500 text-sm">No holidays configured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Name</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Department</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {holidays.map((h) => (
                  <tr key={h.id}>
                    <td className="px-4 py-2 whitespace-nowrap">{h.holiday_date}</td>
                    <td className="px-4 py-2">{h.name}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {h.department_id
                        ? departments.find((d) => d.id === h.department_id)?.name ??
                          h.department_name ??
                          'Department'
                        : 'All departments'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDeleteHoliday(h.id)}
                        className="text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
