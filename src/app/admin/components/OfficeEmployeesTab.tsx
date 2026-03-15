'use client';

import { useCallback, useMemo, useState } from 'react';
import { useOfficeEmployeesRealtime } from '../hooks/useOfficeEmployeesRealtime';

function formatDateTime(value: string | null) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  } catch {
    return value;
  }
}

function formatTime(value: string | null) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return value;
  }
}

function getMonthStart(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function getMonthEnd(d: Date): string {
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
}
function getDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

type ReportResult = {
  employee: { id: string; name: string; department: string };
  daily: Record<string, number>;
  monthlyTotal: number;
};
type PunchRow = {
  employeeId: string;
  employee_code: string;
  name: string;
  department: string;
  datetime: string;
  type: 'checkin' | 'checkout';
};

export function OfficeEmployeesTab() {
  const { employees, attendanceToday, loading, error } = useOfficeEmployeesRealtime();
  const [query, setQuery] = useState('');

  const now = useMemo(() => new Date(), []);
  const [reportStart, setReportStart] = useState(getMonthStart(now));
  const [reportEnd, setReportEnd] = useState(getMonthEnd(now));
  const [reportData, setReportData] = useState<{ results: ReportResult[]; grandTotal: number } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  const [punchesStart, setPunchesStart] = useState(getDaysAgo(7));
  const [punchesEnd, setPunchesEnd] = useState(new Date().toISOString().slice(0, 10));
  const [punchesData, setPunchesData] = useState<PunchRow[] | null>(null);
  const [punchesLoading, setPunchesLoading] = useState(false);
  const [punchesError, setPunchesError] = useState('');

  const fetchReport = useCallback(async () => {
    setReportLoading(true);
    setReportError('');
    try {
      const res = await fetch(`/api/office/report?start=${reportStart}&end=${reportEnd}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setReportError(data?.error || 'Failed to load report');
        setReportData(null);
        return;
      }
      setReportData({ results: data.results ?? [], grandTotal: data.grandTotal ?? 0 });
    } finally {
      setReportLoading(false);
    }
  }, [reportStart, reportEnd]);

  const fetchPunches = useCallback(async () => {
    setPunchesLoading(true);
    setPunchesError('');
    try {
      const startIso = `${punchesStart}T00:00:00.000Z`;
      const endIso = `${punchesEnd}T23:59:59.999Z`;
      const res = await fetch(`/api/office/punches?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPunchesError(data?.error || 'Failed to load punches');
        setPunchesData(null);
        return;
      }
      setPunchesData(data.punches ?? []);
    } finally {
      setPunchesLoading(false);
    }
  }, [punchesStart, punchesEnd]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const hay = [
        e.employee_code,
        e.name,
        e.email,
        e.phone ?? '',
        e.department,
        e.device_id ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [employees, query]);

  const employeeById = useMemo(() => {
    const m = new Map<string, { employee_code: string; name: string; department: string }>();
    employees.forEach((e) => m.set(e.id, { employee_code: e.employee_code, name: e.name, department: e.department }));
    return m;
  }, [employees]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Office Employees</h2>
          <p className="text-sm text-gray-600">
            Realtime view from <code>office_employees</code> and today&apos;s check-in/check-out.
          </p>
        </div>
        <div className="w-full sm:w-80">
          <label className="block text-sm text-gray-600 mb-1">Search employees</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="code, name, email, department..."
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      {error && (
        <div className="p-3 rounded border border-red-200 bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Today's check-in / check-out */}
      <section>
        <h3 className="text-lg font-medium mb-2">Today&apos;s check-in & check-out</h3>
        <p className="text-sm text-gray-600 mb-3">
          Updates in realtime when attendance is recorded (biometric or QR).
        </p>
        {loading ? (
          <p className="p-4 text-center text-gray-600">Loading…</p>
        ) : attendanceToday.length === 0 ? (
          <p className="p-4 rounded border bg-gray-50 text-gray-600 text-sm">No attendance records for today yet.</p>
        ) : (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Check-in (time)</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Check-out (time)</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Hours</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {attendanceToday.map((a) => {
                  const emp = a.office_employees ?? employeeById.get(a.employee_id);
                  return (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap font-medium">{emp?.name ?? a.employee_id}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{emp?.employee_code ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{emp?.department ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatTime(a.check_in)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatTime(a.check_out)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {a.worked_hours != null ? `${Number(a.worked_hours).toFixed(2)}h` : '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100">{a.method}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Monthly report (selected date range) */}
      <section className="rounded-lg border bg-white p-4">
        <h3 className="text-lg font-medium mb-2">Monthly report</h3>
        <p className="text-sm text-gray-600 mb-3">
          Hours per employee for the selected date range. Data from <code>office_attendance</code> (synced from BioTime).
        </p>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start date</label>
            <input
              type="date"
              value={reportStart}
              onChange={(e) => setReportStart(e.target.value.slice(0, 10))}
              className="border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End date</label>
            <input
              type="date"
              value={reportEnd}
              onChange={(e) => setReportEnd(e.target.value.slice(0, 10))}
              className="border rounded px-3 py-2"
            />
          </div>
          <button
            type="button"
            onClick={fetchReport}
            disabled={reportLoading}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {reportLoading ? 'Loading…' : 'Load report'}
          </button>
        </div>
        {reportError && <p className="text-sm text-red-600 mb-2">{reportError}</p>}
        {reportData && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Employee</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">Department</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-500">Monthly total (h)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportData.results.map((r) => (
                    <tr key={r.employee.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{r.employee.name}</td>
                      <td className="px-4 py-2">{r.employee.department}</td>
                      <td className="px-4 py-2 text-right">{r.monthlyTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-sm font-medium text-gray-700">
              Grand total: <span className="font-semibold">{reportData.grandTotal.toFixed(2)}</span> hours
            </p>
          </>
        )}
      </section>

      {/* Recent check-in / punches (selected date range) */}
      <section className="rounded-lg border bg-white p-4">
        <h3 className="text-lg font-medium mb-2">Recent check-in & check-out (selected dates)</h3>
        <p className="text-sm text-gray-600 mb-3">
          Punch log from <code>office_attendance_logs</code> for the selected range. Sorted newest first.
        </p>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start date</label>
            <input
              type="date"
              value={punchesStart}
              onChange={(e) => setPunchesStart(e.target.value.slice(0, 10))}
              className="border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End date</label>
            <input
              type="date"
              value={punchesEnd}
              onChange={(e) => setPunchesEnd(e.target.value.slice(0, 10))}
              className="border rounded px-3 py-2"
            />
          </div>
          <button
            type="button"
            onClick={fetchPunches}
            disabled={punchesLoading}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {punchesLoading ? 'Loading…' : 'Load punches'}
          </button>
        </div>
        {punchesError && <p className="text-sm text-red-600 mb-2">{punchesError}</p>}
        {punchesData && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Date & time</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Code</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Employee</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Department</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {punchesData.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-3 text-gray-500">No punches in this range.</td></tr>
                ) : (
                  punchesData.map((p, i) => (
                    <tr key={`${p.employeeId}-${p.datetime}-${i}`} className="hover:bg-gray-50">
                      <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(p.datetime)}</td>
                      <td className="px-4 py-2 font-medium">{p.employee_code}</td>
                      <td className="px-4 py-2">{p.name}</td>
                      <td className="px-4 py-2">{p.department}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${p.type === 'checkin' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                          {p.type === 'checkin' ? 'Check-in' : 'Check-out'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* All office employees */}
      <section>
        <h3 className="text-lg font-medium mb-2">All office employees</h3>
        <div className="p-3 rounded border bg-white flex flex-wrap gap-4 text-sm mb-3">
          <div>
            <span className="text-gray-500">Total:</span>{' '}
            <span className="font-semibold">{employees.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Showing:</span>{' '}
            <span className="font-semibold">{filtered.length}</span>
          </div>
          <div className="text-gray-500">
            Updates automatically on insert/update/delete (enable Realtime publication for <code>office_employees</code>).
          </div>
        </div>

        {loading ? (
          <p className="p-4 text-center">Loading office employees…</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-center text-gray-600">No office employees found.</p>
        ) : (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Device ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Token</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap font-medium">{e.employee_code}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.phone ?? '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.department}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.device_id ?? '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <code className="text-xs">{e.dynamic_link_token}</code>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {formatDateTime(e.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

