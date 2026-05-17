'use client';

import { useState, useEffect } from 'react';
import { useAttendanceReport } from '../../hooks/useAttendanceReport';
import { fetchDepartmentsService } from '../../services/departmentService';
import { fetchEmployeesService } from '../../services/employeeService';
import type { AttendanceReportEmployeeReport, AttendanceReportDay } from '../../types/attendanceReport';
import { WORKER_CARD_AR } from '@/app/constants/workerCardReportAr';

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr + 'Z').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function formatDateShort(dateStr: string) {
  try {
    return new Date(dateStr + 'Z').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function csvEscape(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  P:   { label: 'Present',              color: 'text-emerald-700', bg: 'bg-emerald-50',  dot: 'bg-emerald-500' },
  W:   { label: 'Weekend',              color: 'text-slate-500',   bg: 'bg-slate-50',    dot: 'bg-slate-400' },
  H:   { label: 'Holiday-Work',         color: 'text-amber-700',   bg: 'bg-amber-50',    dot: 'bg-amber-500' },
  AWO: { label: 'Absent (no excuse)',   color: 'text-red-700',     bg: 'bg-red-50',      dot: 'bg-red-500' },
  SL:  { label: 'Sick Leave',           color: 'text-orange-700',  bg: 'bg-orange-50',   dot: 'bg-orange-500' },
  A:   { label: 'Absent (excused)',     color: 'text-purple-700',  bg: 'bg-purple-50',   dot: 'bg-purple-500' },
  V:   { label: 'Vacation',             color: 'text-blue-700',    bg: 'bg-blue-50',     dot: 'bg-blue-500' },
};

const ABSENT_CODES = new Set(['AWO', 'SL', 'A']);

function getMeta(code: string) {
  return STATUS_META[code] ?? { label: code, color: 'text-gray-600', bg: 'bg-gray-50', dot: 'bg-gray-400' };
}

function computeSummary(days: AttendanceReportDay[]) {
  let present = 0, absent = 0, vacation = 0, weekend = 0, holidayWork = 0;
  let totalHours = 0, totalOT = 0;
  const absentDays: AttendanceReportDay[] = [];

  for (const d of days) {
    const c = d.status_code;
    if (c === 'P') present++;
    else if (ABSENT_CODES.has(c)) { absent++; absentDays.push(d); }
    else if (c === 'V') vacation++;
    else if (c === 'W') weekend++;
    else if (c === 'H') { holidayWork++; present++; }

    totalHours += d.working_hours ?? 0;
    totalOT += (d.overtime.normal ?? 0) + (d.overtime.holiday ?? 0) + (d.overtime.public_holiday ?? 0);
  }
  return { present, absent, vacation, weekend, holidayWork, totalHours, totalOT, absentDays };
}

const ALL = '';

export function AttendanceReportSection() {
  const { report, from: reportFrom, to: reportTo, loading, error, projectsWarning, fetchReport } = useAttendanceReport();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [department, setDepartment] = useState(ALL);
  const [employeeId, setEmployeeId] = useState(ALL);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ employee_id: string; name: string; department: string }[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setFiltersLoading(true);
      try {
        const [deptRes, empRes] = await Promise.all([
          fetchDepartmentsService(),
          fetchEmployeesService(),
        ]);
        if (!cancelled) {
          setDepartments(deptRes.map((d) => ({ id: d.id, name: d.name })));
          setEmployees(
            empRes.employees.map((e) => ({
              employee_id: e.employee_id,
              name: e.name,
              department: e.department ?? '',
            }))
          );
        }
      } catch {
        if (!cancelled) setDepartments([]);
      } finally {
        if (!cancelled) setFiltersLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const employeesInDepartment =
    department === ALL
      ? employees
      : employees.filter((e) => e.department.toLowerCase() === department.toLowerCase());

  const handleGenerate = () => {
    fetchReport(
      fromDate, toDate,
      department === ALL ? null : department,
      employeeId === ALL ? null : employeeId
    );
  };

  const hasReport = report.length > 0;

  const handleDownloadCsv = () => {
    if (!hasReport) return;
    const header = [
      'Employee ID', 'Employee Name', 'Department', 'Salary',
      WORKER_CARD_AR.date, 'Status Code',
      WORKER_CARD_AR.workHours, WORKER_CARD_AR.overtimeNormal,
      WORKER_CARD_AR.overtimeHoliday, WORKER_CARD_AR.overtimePublicHoliday,
      WORKER_CARD_AR.project, WORKER_CARD_AR.notes,
    ];
    const rows: string[] = [header.join(',')];
    report.forEach((emp) => {
      emp.days.forEach((day) => {
        rows.push([
          csvEscape(emp.employee.id), csvEscape(emp.employee.name),
          csvEscape(emp.employee.department), csvEscape(emp.employee.salary ?? ''),
          csvEscape(day.date), csvEscape(day.status_code),
          csvEscape(day.working_hours), csvEscape(day.overtime.normal),
          csvEscape(day.overtime.holiday), csvEscape(day.overtime.public_holiday),
          csvEscape(day.projects), csvEscape(day.notes ?? ''),
        ].join(','));
      });
    });
    const csv = '﻿' + rows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-report_${fromDate || 'from'}_${toDate || 'to'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #attendance-print-area, #attendance-print-area * { visibility: visible; }
          #attendance-print-area { position: absolute; inset: 0; }
          .print-page-break { page-break-after: always; break-after: page; }
          .no-print { display: none !important; }
          .print-shadow-none { box-shadow: none !important; }
        }
      `}</style>

      {/* Controls — hidden on print */}
      <div className="bg-white rounded-lg shadow mt-6 no-print">
        <div className="p-5 border-b">
          <h2 className="text-xl font-semibold mb-1">Attendance Report</h2>
          <p className="text-xs text-gray-400 mb-4">
            P = Present · W = Weekend · H = Holiday-Work · AWO = Absent (no excuse) · SL = Sick Leave · A = Absent (excused) · V = Vacation
          </p>

          {!filtersLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">Department</label>
                <select
                  value={department}
                  onChange={(e) => { setDepartment(e.target.value); setEmployeeId(ALL); }}
                  className="w-full p-2 border rounded"
                >
                  <option value={ALL}>All departments</option>
                  {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Employee</label>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value={ALL}>All employees</option>
                  {employeesInDepartment.map((e) => (
                    <option key={e.employee_id} value={e.employee_id}>
                      {e.name} ({e.employee_id}) — {e.department}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">From date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">To date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full p-2 border rounded" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button" onClick={handleGenerate} disabled={loading}
              className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Loading…' : 'Generate Report'}
            </button>
            <button
              type="button" onClick={handleDownloadCsv} disabled={!hasReport || loading}
              className="px-4 py-2 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              Download CSV
            </button>
            <button
              type="button" onClick={() => window.print()} disabled={!hasReport || loading}
              className="px-4 py-2 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              Print / Save as PDF
            </button>
          </div>

          {error && <p className="mt-3 text-red-500 text-sm">{error}</p>}
          {projectsWarning && !error && <p className="mt-3 text-amber-600 text-sm">{projectsWarning}</p>}
        </div>
      </div>

      {/* Printable report area */}
      <div id="attendance-print-area">
        {report.map((empReport: AttendanceReportEmployeeReport, idx) => {
          const { present, absent, vacation, weekend, holidayWork, totalHours, totalOT, absentDays } = computeSummary(empReport.days);
          const recordedDays = empReport.days.length;
          // Calendar days in the queried period (not just recorded rows)
          const calFrom = reportFrom || fromDate;
          const calTo = reportTo || toDate;
          const calendarDays = calFrom && calTo
            ? Math.round((new Date(calTo + 'T00:00:00').getTime() - new Date(calFrom + 'T00:00:00').getTime()) / 86400000) + 1
            : recordedDays;
          const periodLabel = calFrom && calTo
            ? `${formatDateShort(calFrom)} – ${formatDateShort(calTo)}`
            : empReport.days.length > 0
              ? `${formatDateShort(empReport.days[0].date)} – ${formatDateShort(empReport.days[empReport.days.length - 1].date)}`
              : '';

          return (
            <div
              key={empReport.employee.id}
              className={`bg-white rounded-lg shadow print-shadow-none mt-6 overflow-hidden ${idx < report.length - 1 ? 'print-page-break' : ''}`}
            >
              {/* ── Employee Header ── */}
              <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-6 py-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-bold tracking-wide">{empReport.employee.name}</h2>
                    <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-slate-300">
                      <span className="font-mono bg-slate-600 px-2 py-0.5 rounded text-xs">{empReport.employee.id}</span>
                      <span>{empReport.employee.department}</span>
                      {empReport.employee.salary != null && empReport.employee.salary > 0 && (
                        <span>Salary: <strong className="text-white">{empReport.employee.salary}</strong></span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-slate-300 text-sm">
                    <div className="text-white font-semibold text-base">{periodLabel}</div>
                    <div>{calendarDays} days in period</div>
                  </div>
                </div>
              </div>

              {/* ── Summary Cards ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-0 border-b divide-x divide-gray-100">
                {[
                  { label: 'Present',      value: present,     color: 'text-emerald-600', sub: holidayWork > 0 ? `incl. ${holidayWork} holiday-work` : undefined },
                  { label: 'Absent',       value: absent,      color: absent > 0 ? 'text-red-600' : 'text-gray-400' },
                  { label: 'Vacation',     value: vacation,    color: 'text-blue-600' },
                  { label: 'Weekend',      value: weekend,     color: 'text-slate-500' },
                  { label: 'Work Hours',   value: totalHours,  color: 'text-slate-700', suffix: 'h' },
                  { label: 'Overtime',     value: totalOT,     color: totalOT > 0 ? 'text-amber-600' : 'text-gray-400', suffix: 'h' },
                  { label: 'Total Days',   value: calendarDays, color: 'text-slate-600', sub: recordedDays !== calendarDays ? `${recordedDays} recorded` : undefined },
                ].map(({ label, value, color, suffix, sub }) => (
                  <div key={label} className="p-4 text-center">
                    <div className={`text-2xl font-bold ${color}`}>{value}{suffix}</div>
                    <div className="text-xs text-gray-400 mt-0.5 font-medium uppercase tracking-wide">{label}</div>
                    {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
                  </div>
                ))}
              </div>

              {/* ── Important Days (Absences) ── */}
              {absentDays.length > 0 && (
                <div className="px-6 py-4 bg-red-50 border-b border-red-100">
                  <h4 className="text-sm font-semibold text-red-700 mb-2 uppercase tracking-wide">
                    Important — Absent Days ({absentDays.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {absentDays.map((d) => {
                      const meta = getMeta(d.status_code);
                      return (
                        <span key={d.date} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${meta.bg} ${meta.color} border-current border-opacity-20`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                          {formatDate(d.date)}
                          <span className="font-bold">{d.status_code}</span>
                          {d.notes && <span className="opacity-70">· {d.notes}</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Daily Attendance Table ── */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left font-semibold">Date</th>
                      <th className="px-3 py-3 text-center font-semibold">Status</th>
                      <th className="px-3 py-3 text-right font-semibold">Work Hrs</th>
                      <th className="px-3 py-3 text-right font-semibold whitespace-nowrap" dir="rtl">{WORKER_CARD_AR.overtimeNormal}</th>
                      <th className="px-3 py-3 text-right font-semibold whitespace-nowrap" dir="rtl">{WORKER_CARD_AR.overtimeHoliday}</th>
                      <th className="px-3 py-3 text-right font-semibold whitespace-nowrap" dir="rtl">{WORKER_CARD_AR.overtimePublicHoliday}</th>
                      <th className="px-3 py-3 text-left font-semibold">Project</th>
                      <th className="px-3 py-3 text-left font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {empReport.days.map((day) => {
                      const meta = getMeta(day.status_code);
                      const isAbsent = ABSENT_CODES.has(day.status_code);
                      return (
                        <tr key={day.date} className={`${isAbsent ? meta.bg : 'hover:bg-gray-50'} transition-colors`}>
                          <td className="px-4 py-2.5 whitespace-nowrap font-medium text-gray-700">
                            {formatDate(day.date)}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${meta.bg} ${meta.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                              {day.status_code}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                            {day.working_hours > 0 ? day.working_hours : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">
                            {day.overtime.normal > 0 ? day.overtime.normal : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">
                            {day.overtime.holiday > 0 ? day.overtime.holiday : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">
                            {day.overtime.public_holiday > 0 ? day.overtime.public_holiday : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 max-w-xs text-gray-600">
                            {day.projects || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 max-w-xs text-gray-500 italic text-xs">
                            {day.notes || <span className="not-italic text-gray-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals footer */}
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-slate-700">
                      <td className="px-4 py-3" colSpan={2}>
                        Totals — {present} present · {absent} absent · {vacation} vacation
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{totalHours}h</td>
                      <td className="px-3 py-3 text-right tabular-nums text-amber-700">
                        {empReport.days.reduce((s, d) => s + d.overtime.normal, 0) || '—'}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-amber-700">
                        {empReport.days.reduce((s, d) => s + d.overtime.holiday, 0) || '—'}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-amber-700">
                        {empReport.days.reduce((s, d) => s + d.overtime.public_holiday, 0) || '—'}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && report.length === 0 && !error && fromDate && toDate && (
        <p className="mt-6 p-4 text-center text-gray-500 no-print">
          No attendance data for the selected date range.
        </p>
      )}
    </>
  );
}
