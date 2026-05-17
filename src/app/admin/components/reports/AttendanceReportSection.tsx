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
    else if (c === 'H') holidayWork++;
    else if (ABSENT_CODES.has(c)) { absent++; absentDays.push(d); }
    else if (c === 'V') vacation++;
    else if (c === 'W') weekend++;

    totalHours += d.working_hours ?? 0;
    totalOT += (d.overtime.normal ?? 0) + (d.overtime.holiday ?? 0) + (d.overtime.public_holiday ?? 0);
  }
  // Worked days = regular present + holiday-work days
  const workedDays = present + holidayWork;
  return { present, absent, vacation, weekend, holidayWork, workedDays, totalHours, totalOT, absentDays };
}

function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMissingDates(days: AttendanceReportDay[], calFrom: string, calTo: string): string[] {
  if (!calFrom || !calTo) return [];
  const recorded = new Set(days.map((d) => d.date));
  const missing: string[] = [];
  const cur = new Date(calFrom + 'T00:00:00');
  const end = new Date(calTo + 'T00:00:00');
  while (cur <= end) {
    const iso = toLocalIso(cur);
    if (!recorded.has(iso)) missing.push(iso);
    cur.setDate(cur.getDate() + 1);
  }
  return missing;
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
          @page { size: A4 portrait; margin: 10mm 12mm; }
          body * { visibility: hidden; }
          #attendance-print-area, #attendance-print-area * { visibility: visible; }
          #attendance-print-area { position: absolute; top: 0; left: 0; width: 100%; }
          .print-page-break { page-break-after: always; break-after: page; margin: 0 !important; }
          .no-print { display: none !important; }
          /* preserve background colours */
          .emp-hdr, .emp-summary { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          /* compact card */
          .emp-card { box-shadow: none !important; border: 1px solid #d1d5db; margin-top: 0 !important; border-radius: 0 !important; }
          /* compact summary strip */
          .sum-card { padding: 5px 8px !important; }
          .sum-val { font-size: 15pt !important; line-height: 1.1 !important; }
          .sum-lbl { font-size: 6.5pt !important; }
          /* compact table */
          .att-table { font-size: 8pt !important; }
          .att-table th, .att-table td { padding: 2.5px 5px !important; }
          .att-table .status-badge { padding: 1px 5px !important; font-size: 7pt !important; }
          .att-table .badge-dot { display: none !important; }
          /* absent highlight must still print */
          .att-table tr.row-absent { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          /* section banners */
          .absent-banner, .missing-banner, .footer-bar { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
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
          const { present, absent, vacation, weekend, holidayWork, workedDays, totalHours, totalOT, absentDays } = computeSummary(empReport.days);
          const recordedDays = empReport.days.length;
          const calFrom = reportFrom || fromDate;
          const calTo = reportTo || toDate;
          const calendarDays = calFrom && calTo
            ? Math.round((new Date(calTo + 'T00:00:00').getTime() - new Date(calFrom + 'T00:00:00').getTime()) / 86400000) + 1
            : recordedDays;
          const missingDates = getMissingDates(empReport.days, calFrom, calTo);
          const periodLabel = calFrom && calTo
            ? `${formatDateShort(calFrom)} – ${formatDateShort(calTo)}`
            : empReport.days.length > 0
              ? `${formatDateShort(empReport.days[0].date)} – ${formatDateShort(empReport.days[empReport.days.length - 1].date)}`
              : '';

          // Dynamic column visibility — hide columns that are all empty for this employee
          const showWorkHours = empReport.days.some(d => d.working_hours > 0);
          const showOtNormal = empReport.days.some(d => d.overtime.normal > 0);
          const showOtHoliday = empReport.days.some(d => d.overtime.holiday > 0);
          const showOtPublicHoliday = empReport.days.some(d => d.overtime.public_holiday > 0);
          const showProjects = empReport.days.some(d => d.projects && d.projects !== '—');
          const showNotes = empReport.days.some(d => d.notes && d.notes !== '—');



          return (
            <div
              key={empReport.employee.id}
              className={`emp-card bg-white rounded-lg shadow mt-6 overflow-hidden ${idx < report.length - 1 ? 'print-page-break' : ''}`}
            >
              {/* ── Employee Header ── */}
              <div
                className="emp-hdr bg-gradient-to-r from-slate-800 to-slate-700 text-white px-6 py-4"
                style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div>
                    <h2 className="text-xl font-bold tracking-wide leading-tight">{empReport.employee.name}</h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-slate-300">
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

              {/* ── Summary Strip — two rows of 4 ── */}
              <div
                className="emp-summary border-b"
                style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
              >
                {/* Row 1: attendance codes */}
                <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
                  {[
                    { label: 'Worked Days', value: workedDays, color: 'text-emerald-600', sub: holidayWork > 0 ? `${present}P + ${holidayWork}H` : undefined },
                    { label: 'Weekend (W)',  value: weekend,   color: weekend > 0 ? 'text-slate-600' : 'text-gray-300' },
                    { label: 'Vacation (V)', value: vacation,  color: vacation > 0 ? 'text-blue-600' : 'text-gray-300' },
                    { label: 'Absent',       value: absent,    color: absent > 0 ? 'text-red-600' : 'text-gray-300' },
                  ].map(({ label, value, color, sub }) => (
                    <div key={label} className="sum-card p-3 text-center">
                      <div className={`sum-val text-2xl font-bold ${color}`}>{value}</div>
                      <div className="sum-lbl text-xs text-gray-400 mt-0.5 font-medium uppercase tracking-wide leading-tight">{label}</div>
                      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
                    </div>
                  ))}
                </div>
                {/* Row 2: hours + calendar */}
                <div className="grid grid-cols-4 divide-x divide-gray-100">
                  {[
                    { label: 'Present (P)',  value: present,      color: present > 0 ? 'text-emerald-500' : 'text-gray-300' },
                    { label: 'Holiday-Work', value: holidayWork,  color: holidayWork > 0 ? 'text-amber-600' : 'text-gray-300' },
                    { label: 'Work Hours',   value: `${totalHours}h`, color: totalHours > 0 ? 'text-slate-700' : 'text-gray-300' },
                    { label: 'Overtime',     value: `${totalOT}h`,    color: totalOT > 0 ? 'text-amber-600' : 'text-gray-300' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="sum-card p-3 text-center">
                      <div className={`sum-val text-2xl font-bold ${color}`}>{value}</div>
                      <div className="sum-lbl text-xs text-gray-400 mt-0.5 font-medium uppercase tracking-wide leading-tight">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Missing Days Banner ── */}
              {missingDates.length > 0 && (
                <div className="missing-banner px-5 py-2 bg-yellow-50 border-b border-yellow-100 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-yellow-700 uppercase tracking-wide shrink-0">
                    {missingDates.length} day{missingDates.length > 1 ? 's' : ''} with no record:
                  </span>
                  <span className="text-xs text-yellow-700">
                    {missingDates.map((d) => formatDateShort(d)).join(' · ')}
                  </span>
                </div>
              )}

              {/* ── Absent Days Banner ── */}
              {absentDays.length > 0 && (
                <div className="absent-banner px-5 py-3 bg-red-50 border-b border-red-100">
                  <span className="text-xs font-semibold text-red-700 uppercase tracking-wide mr-2">
                    Absent days ({absentDays.length}):
                  </span>
                  <span className="inline-flex flex-wrap gap-1.5">
                    {absentDays.map((d) => {
                      const meta = getMeta(d.status_code);
                      return (
                        <span key={d.date} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${meta.bg} ${meta.color}`}>
                          {formatDateShort(d.date)} · {d.status_code}
                          {d.notes && <span className="opacity-60 ml-1">{d.notes}</span>}
                        </span>
                      );
                    })}
                  </span>
                </div>
              )}

              {/* ── Daily Attendance Table ── */}
              <div className="overflow-x-auto">
                <table className="att-table w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                      <th className="px-3 py-2.5 text-center font-semibold">Status</th>
                      {showWorkHours && <th className="px-3 py-2.5 text-right font-semibold">Work Hrs</th>}
                      {showOtNormal && <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap" dir="rtl">{WORKER_CARD_AR.overtimeNormal}</th>}
                      {showOtHoliday && <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap" dir="rtl">{WORKER_CARD_AR.overtimeHoliday}</th>}
                      {showOtPublicHoliday && <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap" dir="rtl">{WORKER_CARD_AR.overtimePublicHoliday}</th>}
                      {showProjects && <th className="px-3 py-2.5 text-left font-semibold">Project</th>}
                      {showNotes && <th className="px-3 py-2.5 text-left font-semibold">Notes</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {empReport.days.map((day) => {
                      const meta = getMeta(day.status_code);
                      const isAbsent = ABSENT_CODES.has(day.status_code);
                      return (
                        <tr key={day.date} className={`row-absent ${isAbsent ? meta.bg : 'hover:bg-gray-50'} transition-colors`}>
                          <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-700">
                            {formatDate(day.date)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`status-badge inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${meta.bg} ${meta.color}`}>
                              <span className={`badge-dot w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                              {day.status_code}
                            </span>
                          </td>
                          {showWorkHours && (
                            <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                              {day.working_hours > 0 ? day.working_hours : <span className="text-gray-300">—</span>}
                            </td>
                          )}
                          {showOtNormal && (
                            <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                              {day.overtime.normal > 0 ? day.overtime.normal : <span className="text-gray-300">—</span>}
                            </td>
                          )}
                          {showOtHoliday && (
                            <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                              {day.overtime.holiday > 0 ? day.overtime.holiday : <span className="text-gray-300">—</span>}
                            </td>
                          )}
                          {showOtPublicHoliday && (
                            <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                              {day.overtime.public_holiday > 0 ? day.overtime.public_holiday : <span className="text-gray-300">—</span>}
                            </td>
                          )}
                          {showProjects && (
                            <td className="px-3 py-2 max-w-xs text-gray-600 text-xs">
                              {day.projects && day.projects !== '—' ? day.projects : <span className="text-gray-300">—</span>}
                            </td>
                          )}
                          {showNotes && (
                            <td className="px-3 py-2 max-w-xs text-gray-500 italic text-xs">
                              {day.notes && day.notes !== '—' ? day.notes : <span className="not-italic text-gray-300">—</span>}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="footer-bar bg-slate-50 border-t-2 border-slate-200 font-semibold text-slate-700 text-sm">
                      <td className="px-4 py-2.5" colSpan={2}>
                        {workedDays} worked · {weekend} weekend · {vacation} vacation · {absent} absent
                      </td>
                      {showWorkHours && <td className="px-3 py-2.5 text-right tabular-nums">{totalHours}h</td>}
                      {showOtNormal && (
                        <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
                          {empReport.days.reduce((s, d) => s + d.overtime.normal, 0) || '—'}
                        </td>
                      )}
                      {showOtHoliday && (
                        <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
                          {empReport.days.reduce((s, d) => s + d.overtime.holiday, 0) || '—'}
                        </td>
                      )}
                      {showOtPublicHoliday && (
                        <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
                          {empReport.days.reduce((s, d) => s + d.overtime.public_holiday, 0) || '—'}
                        </td>
                      )}
                      {(showProjects || showNotes) && <td colSpan={(showProjects ? 1 : 0) + (showNotes ? 1 : 0)} />}
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
