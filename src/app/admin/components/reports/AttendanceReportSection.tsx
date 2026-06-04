'use client';

import { useState, useEffect } from 'react';
import { useAttendanceReport } from '../../hooks/useAttendanceReport';
import { fetchDepartmentsService } from '../../services/departmentService';
import { fetchEmployeesService } from '../../services/employeeService';
import type { AttendanceReportEmployeeReport, AttendanceReportDay } from '../../types/attendanceReport';
import { computePayrollFromDays } from '../../services/payrollCalculation';
import { buildAttendanceReportWhatsAppMessage } from '@/lib/attendanceReportEmailHtml';
import { PayrollReportDeliveryPanel } from './PayrollReportDeliveryPanel';

function getDeptTheme(dept: string) {
  const d = (dept ?? '').toLowerCase();
  if (d.includes('maintenance'))
    return { gradient: 'from-red-900 to-red-800',       border: 'border-red-800',   accentText: 'text-red-800',   company: 'Bait Alshaar Contracting and General Maintenance', weekendIsWorked: true };
  if (d.includes('construction'))
    return { gradient: 'from-orange-900 to-orange-800', border: 'border-red-800',   accentText: 'text-red-800',   company: 'Bait Alshaar Contracting and General Maintenance', weekendIsWorked: true };
  if (d.includes('saqi'))
    return { gradient: 'from-blue-900 to-blue-800',     border: 'border-blue-700',  accentText: 'text-blue-700',  company: 'Al Saqiya Trading',                                 weekendIsWorked: false };
  return   { gradient: 'from-slate-800 to-slate-700',   border: 'border-slate-400', accentText: 'text-amber-600', company: 'Bait Alshaar Contracting and General Maintenance',  weekendIsWorked: false };
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
  P:    { label: 'Present',              color: 'text-emerald-700', bg: 'bg-emerald-50',  dot: 'bg-emerald-500' },
  W:    { label: 'Weekend',              color: 'text-slate-500',   bg: 'bg-slate-50',    dot: 'bg-slate-400' },
  H:    { label: 'Holiday-Work',         color: 'text-amber-700',   bg: 'bg-amber-50',    dot: 'bg-amber-500' },
  HDAM: { label: 'Half Day AM',          color: 'text-teal-700',    bg: 'bg-teal-50',     dot: 'bg-teal-500' },
  HDPM: { label: 'Half Day PM',          color: 'text-teal-600',    bg: 'bg-teal-50',     dot: 'bg-teal-400' },
  AWO:  { label: 'Absent (no excuse)',   color: 'text-red-700',     bg: 'bg-red-50',      dot: 'bg-red-500' },
  SL:   { label: 'Sick Leave',           color: 'text-orange-700',  bg: 'bg-orange-50',   dot: 'bg-orange-500' },
  A:    { label: 'Absent (excused)',     color: 'text-purple-700',  bg: 'bg-purple-50',   dot: 'bg-purple-500' },
  V:    { label: 'Vacation',             color: 'text-blue-700',    bg: 'bg-blue-50',     dot: 'bg-blue-500' },
};

const ABSENT_CODES = new Set(['AWO', 'SL', 'A']);

function getMeta(code: string) {
  return STATUS_META[code] ?? { label: code, color: 'text-gray-600', bg: 'bg-gray-50', dot: 'bg-gray-400' };
}

function computeSummary(days: AttendanceReportDay[]) {
  let present = 0, absent = 0, vacation = 0, weekend = 0, holidayWork = 0;
  let totalHours = 0, totalOT = 0;
  let otNormal = 0, otHoliday = 0, otPublicHoliday = 0;
  const absentDays: AttendanceReportDay[] = [];

  for (const d of days) {
    const c = d.status_code;
    if (c === 'P') present++;
    else if (c === 'H') holidayWork++;
    else if (ABSENT_CODES.has(c)) { absent++; absentDays.push(d); }
    else if (c === 'V') vacation++;
    else if (c === 'W') weekend++;

    totalHours += d.working_hours ?? 0;
    otNormal        += d.overtime.normal         ?? 0;
    otHoliday       += d.overtime.holiday        ?? 0;
    otPublicHoliday += d.overtime.public_holiday ?? 0;
    totalOT += (d.overtime.normal ?? 0) + (d.overtime.holiday ?? 0) + (d.overtime.public_holiday ?? 0);
  }
  const workedDays = present + holidayWork;
  return { present, absent, vacation, weekend, holidayWork, workedDays, totalHours, totalOT, otNormal, otHoliday, otPublicHoliday, absentDays };
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
  const [editMode, setEditMode] = useState(false);
  const [localReport, setLocalReport] = useState<AttendanceReportEmployeeReport[]>([]);
  const [originalReport, setOriginalReport] = useState<AttendanceReportEmployeeReport[]>([]);
  const [saveStatus, setSaveStatus] = useState<Record<string, 'saving' | 'saved' | 'error'>>({});

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

  useEffect(() => {
    setLocalReport(report);
    setOriginalReport(report);
    setEditMode(false);
  }, [report]);

  const updateDay = (empId: string, date: string, patch: (day: AttendanceReportDay) => AttendanceReportDay) => {
    setLocalReport(prev =>
      prev.map(emp =>
        emp.employee.id !== empId ? emp : {
          ...emp,
          days: emp.days.map(day => day.date !== date ? day : patch(day)),
        }
      )
    );
  };

  const resetEdits = () => {
    setLocalReport(originalReport);
    setSaveStatus({});
  };

  const saveDay = async (empId: string, date: string, day: AttendanceReportDay) => {
    const key = `${empId}__${date}`;
    setSaveStatus(prev => ({ ...prev, [key]: 'saving' }));
    try {
      const res = await fetch('/api/attendance-report-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employee_id: empId,
          date,
          status_code: day.status_code,
          working_hours: day.working_hours,
          overtime_normal: day.overtime.normal,
          overtime_holiday: day.overtime.holiday,
          overtime_public_holiday: day.overtime.public_holiday,
          notes: day.notes,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || `HTTP ${res.status}`);
      setSaveStatus(prev => ({ ...prev, [key]: 'saved' }));
      setTimeout(() => setSaveStatus(prev => {
        const next = { ...prev };
        if (next[key] === 'saved') delete next[key];
        return next;
      }), 2500);
    } catch {
      setSaveStatus(prev => ({ ...prev, [key]: 'error' }));
    }
  };

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

  const hasReport = localReport.length > 0;

  // ── Summary page computations ──
  const calFrom = reportFrom || fromDate;
  const calTo = reportTo || toDate;
  const summaryCalendarDays = calFrom && calTo
    ? Math.round((new Date(calTo + 'T00:00:00').getTime() - new Date(calFrom + 'T00:00:00').getTime()) / 86400000) + 1
    : 0;
  let summaryPeriodWeekends = 0;
  if (calFrom && calTo) {
    const cur = new Date(calFrom + 'T00:00:00');
    const end = new Date(calTo + 'T00:00:00');
    while (cur <= end) {
      const dow = cur.getDay();
      if (dow === 5 || dow === 6) summaryPeriodWeekends++;
      cur.setDate(cur.getDate() + 1);
    }
  }
  const summaryPeriodLabel = calFrom && calTo
    ? `${formatDateShort(calFrom)} – ${formatDateShort(calTo)}`
    : '';
  const summaryCalFrom = calFrom;
  const employeeSummaries = localReport.map((emp) => {
    const s = computeSummary(emp.days);
    const payroll =
      emp.employee.salary != null && emp.employee.salary > 0 && summaryCalFrom
        ? computePayrollFromDays(emp.days, emp.employee.salary, summaryCalFrom)
        : null;
    return {
      employee: emp.employee,
      ...s,
      awo: s.absentDays.filter((d) => d.status_code === 'AWO').length,
      sl: s.absentDays.filter((d) => d.status_code === 'SL').length,
      a: s.absentDays.filter((d) => d.status_code === 'A').length,
      totalSalary: payroll ? payroll.totalSalary : null,
      otNormalAmt: payroll?.otNormalAmount ?? 0,
      otHolidayAmt: payroll?.otHolidayAmount ?? 0,
      otPublicHolidayAmt: payroll?.otPublicHolidayAmount ?? 0,
      awoDeductionAmt: payroll?.awoDeductionAmount ?? 0,
    };
  });
  const grandTotals = employeeSummaries.reduce(
    (acc, s) => ({
      workedDays: acc.workedDays + s.workedDays,
      present: acc.present + s.present,
      holidayWork: acc.holidayWork + s.holidayWork,
      weekend: acc.weekend + s.weekend,
      vacation: acc.vacation + s.vacation,
      absent: acc.absent + s.absent,
      awo: acc.awo + s.awo,
      sl: acc.sl + s.sl,
      a: acc.a + s.a,
      totalHours: acc.totalHours + s.totalHours,
      otNormal: acc.otNormal + s.otNormal,
      otHoliday: acc.otHoliday + s.otHoliday,
      otPublicHoliday: acc.otPublicHoliday + s.otPublicHoliday,
      totalOT: acc.totalOT + s.totalOT,
      otNormalAmt: acc.otNormalAmt + s.otNormalAmt,
      otHolidayAmt: acc.otHolidayAmt + s.otHolidayAmt,
      otPublicHolidayAmt: acc.otPublicHolidayAmt + s.otPublicHolidayAmt,
      awoDeductionAmt: acc.awoDeductionAmt + s.awoDeductionAmt,
      totalSalary: acc.totalSalary + (s.totalSalary ?? 0),
    }),
    { workedDays: 0, present: 0, holidayWork: 0, weekend: 0, vacation: 0, absent: 0, awo: 0, sl: 0, a: 0, totalHours: 0, otNormal: 0, otHoliday: 0, otPublicHoliday: 0, totalOT: 0, otNormalAmt: 0, otHolidayAmt: 0, otPublicHolidayAmt: 0, awoDeductionAmt: 0, totalSalary: 0 }
  );

  const handleDownloadCsv = () => {
    if (!hasReport) return;
    const header = [
      'Employee ID', 'Employee Name', 'Department', 'Salary',
      'Date', 'Status',
      'Work Hrs', 'OT (×1.25)',
      'W.OT (×1.5)', 'H.OT (×2.5)',
      'Project', 'Notes',
    ];
    const rows: string[] = [header.join(',')];
    localReport.forEach((emp) => {
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
          body.print-attendance * { visibility: hidden; }
          body.print-attendance #attendance-print-area,
          body.print-attendance #attendance-print-area * { visibility: visible; }
          body.print-attendance #attendance-print-area { position: absolute; top: 0; left: 0; width: 100%; }
          .print-page-break { page-break-after: always; break-after: page; margin: 0 !important; }
          .no-print { display: none !important; }
          /* preserve background colours */
          .emp-hdr, .emp-summary { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          /* compact card */
          .emp-card { box-shadow: none !important; border: 1px solid #d1d5db; margin-top: 0 !important; border-radius: 0 !important; }
          /* compact header */
          .emp-hdr { padding: 5px 12px !important; }
          .emp-hdr .company-name { font-size: 5.5pt !important; letter-spacing: 0.04em !important; margin-bottom: 1px !important; }
          .emp-hdr h2 { font-size: 12pt !important; line-height: 1.2 !important; }
          .emp-hdr .text-sm, .emp-hdr .text-base { font-size: 7.5pt !important; }
          /* compact summary strip */
          .sum-card { padding: 3px 6px !important; }
          .sum-val { font-size: 11pt !important; line-height: 1.1 !important; }
          .sum-lbl { font-size: 5.5pt !important; letter-spacing: 0 !important; }
          /* compact table — rows sized to fill page evenly */
          .att-table { font-size: 7.5pt !important; table-layout: fixed !important; width: 100% !important; }
          .att-table th, .att-table td { padding: 3.5px 4px !important; line-height: 1.35 !important; vertical-align: middle !important; }
          .att-table th { font-size: 6.5pt !important; padding: 2px 4px !important; }
          .att-table .status-badge { padding: 0 4px !important; font-size: 6.5pt !important; border-radius: 3px !important; }
          .att-table .badge-dot { display: none !important; }
          .att-table .ot-rate { display: none !important; }
          /* date cell: compact two-line */
          .att-table .date-day { font-size: 7.5pt !important; }
          .att-table .date-wd  { font-size: 6pt !important; }
          /* project / notes: 1 line in print to guarantee row height */
          .att-table .cell-project { overflow: hidden !important; display: -webkit-box !important; -webkit-line-clamp: 1 !important; -webkit-box-orient: vertical !important; }
          .att-table .cell-notes  { overflow: hidden !important; display: -webkit-box !important; -webkit-line-clamp: 1 !important; -webkit-box-orient: vertical !important; }
          /* absent highlight must still print */
          .att-table tr.row-absent { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          /* section banners */
          .missing-banner { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; padding: 2px 8px !important; font-size: 6.5pt !important; }
          /* make edit inputs invisible in print */
          .att-table input, .att-table select { -webkit-appearance: none; appearance: none; border: none !important; background: transparent !important; padding: 0 !important; font-size: inherit !important; color: inherit !important; outline: none !important; box-shadow: none !important; width: auto !important; }
          /* header signature column */
          .emp-hdr-sig { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; min-height: 22mm !important; width: 50mm !important; border: 1.5pt solid #94a3b8 !important; }
          .emp-hdr-sig span { color: #e2e8f0 !important; font-size: 14pt !important; }
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
              type="button"
              disabled={!hasReport || loading}
              className="px-4 py-2 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
              onClick={() => {
                document.body.classList.add('print-attendance');
                window.print();
                document.body.classList.remove('print-attendance');
              }}
            >
              Print / Save as PDF
            </button>
            {hasReport && (
              <button
                type="button"
                onClick={() => setEditMode(m => !m)}
                className={`px-4 py-2 text-sm rounded border font-medium ${editMode ? 'bg-amber-100 border-amber-400 text-amber-800 hover:bg-amber-200' : 'border-gray-300 bg-white hover:bg-gray-50'}`}
              >
                {editMode ? 'Done Editing' : 'Edit Report'}
              </button>
            )}
            {editMode && (
              <button
                type="button"
                onClick={resetEdits}
                className="px-4 py-2 text-sm rounded border border-red-300 bg-white text-red-600 hover:bg-red-50"
              >
                Reset Changes
              </button>
            )}
          </div>

          {editMode && hasReport && (
            <p className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
              Editing mode — changes are local only and not saved to the database. Print or Download CSV to export with your edits.
            </p>
          )}
          {error && <p className="mt-3 text-red-500 text-sm">{error}</p>}
          {projectsWarning && !error && <p className="mt-3 text-amber-600 text-sm">{projectsWarning}</p>}

          <PayrollReportDeliveryPanel
            reportKind="attendance"
            hasReport={hasReport}
            disabled={loading}
            from={reportFrom || fromDate}
            to={reportTo || toDate}
            printAreaId="attendance-print-area"
            company={getDeptTheme(department).company}
            department={department === ALL ? null : department}
            employeeId={employeeId === ALL ? null : employeeId}
            filterLabel={
              department !== ALL
                ? department
                : employeeId !== ALL
                  ? employees.find((e) => e.employee_id === employeeId)?.name ?? employeeId
                  : 'All Departments'
            }
            onBuildAttendanceWhatsAppMessage={() =>
              buildAttendanceReportWhatsAppMessage({
                from: reportFrom || fromDate,
                to: reportTo || toDate,
                filterLabel:
                  department !== ALL
                    ? department
                    : 'All Departments',
                employeeCount: localReport.length,
                grandTotalSalary: grandTotals.totalSalary,
              })
            }
          />
        </div>
      </div>

      {/* Printable report area */}
      <div id="attendance-print-area">
        {localReport.map((empReport: AttendanceReportEmployeeReport) => {
          const deptTheme = getDeptTheme(empReport.employee.department);
          const { present, absent, vacation, weekend, holidayWork, workedDays, totalHours, otNormal, otHoliday, otPublicHoliday, absentDays } = computeSummary(empReport.days);
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

          // AWO / SL / A breakdown
          const awoCount = absentDays.filter(d => d.status_code === 'AWO').length;
          const slCount  = absentDays.filter(d => d.status_code === 'SL').length;
          const aCount   = absentDays.filter(d => d.status_code === 'A').length;
          const absentSub = absent > 0
            ? [awoCount > 0 ? `AWO: ${awoCount}` : '', slCount > 0 ? `SL: ${slCount}` : '', aCount > 0 ? `A: ${aCount}` : ''].filter(Boolean).join(' · ')
            : undefined;

          // Salary calculation (only when salary is set)
          const empSalary = empReport.employee.salary;
          let salarySummary: {
            monthDays: number;
            hourlyRate: number;
            baseSalary: number;
            otNormalAmount: number;
            otHolidayAmount: number;
            otPublicHolidayAmount: number;
            otAmount: number;
            awoDeduction: number;
            totalSalary: number;
          } | null = null;
          if (empSalary != null && empSalary > 0 && calFrom) {
            const payroll = computePayrollFromDays(empReport.days, empSalary, calFrom);
            salarySummary = {
              monthDays: payroll.monthDays,
              hourlyRate: payroll.hourlyRate,
              baseSalary: payroll.baseSalary,
              otNormalAmount: payroll.otNormalAmount,
              otHolidayAmount: payroll.otHolidayAmount,
              otPublicHolidayAmount: payroll.otPublicHolidayAmount,
              otAmount: payroll.overtimeAmount,
              awoDeduction: payroll.awoDeductionAmount,
              totalSalary: payroll.totalSalary,
            };
          }

          // Dynamic column visibility — hide columns that are all empty for this employee (always show all in edit mode)
          const showDailySalary = salarySummary !== null;
          const showWorkHours = editMode || empReport.days.some(d => d.working_hours > 0);
          const showOtNormal = editMode || empReport.days.some(d => d.overtime.normal > 0);
          const showOtHoliday = editMode || empReport.days.some(d => d.overtime.holiday > 0);
          const showOtPublicHoliday = editMode || empReport.days.some(d => d.overtime.public_holiday > 0);
          const showProjects = editMode || empReport.days.some(d => d.projects && d.projects !== '—');
          const showNotes = editMode || empReport.days.some(d => d.notes && d.notes !== '—');



          return (
            <div
              key={empReport.employee.id}
              className="emp-card bg-white rounded-lg shadow mt-6 overflow-hidden print-page-break"
            >
              {/* ── Employee Header: dark-left all info + white-right empty signature box ── */}
              <div className="flex items-stretch overflow-hidden">
                {/* Dark left — all text including period & supervisor label */}
                <div
                  className={`emp-hdr flex-1 bg-gradient-to-r ${deptTheme.gradient} text-white px-5 py-3`}
                  style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h2 className="text-xl font-bold tracking-wide leading-tight">{empReport.employee.name}</h2>
                    <span className="company-name text-xs text-slate-400 uppercase tracking-widest font-medium shrink-0">
                      {deptTheme.company}
                    </span>
                  </div>
                  {/* Row 2: ID · Dept · salary · rate · OT · Total */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0 mt-1 text-sm text-slate-300">
                    <span className="font-mono bg-slate-600 px-2 py-0.5 rounded text-xs">{empReport.employee.id}</span>
                    <span>{empReport.employee.department}</span>
                    {empReport.employee.salary != null && empReport.employee.salary > 0 && (
                      <>
                        <span className="text-slate-500">·</span>
                        <span>
                          <strong className="text-white">{empReport.employee.salary.toLocaleString('en-US')}</strong>/mo
                          {salarySummary && (
                            <>
                              <span className="font-mono text-slate-400 text-xs ml-1">@{salarySummary.hourlyRate.toFixed(2)}/h</span>
                              <span className="text-slate-300 text-xs ml-1">· 8hrs: <strong className="text-white">{Math.round(salarySummary.hourlyRate * 8).toLocaleString('en-US')}</strong></span>
                            </>
                          )}
                        </span>
                        {salarySummary && (
                          <>
                            {salarySummary.otNormalAmount > 0 && (
                              <span className="text-amber-300 text-xs">· OT {otNormal}h +{Math.round(salarySummary.otNormalAmount).toLocaleString('en-US')}</span>
                            )}
                            {salarySummary.otHolidayAmount > 0 && (
                              <span className="text-amber-200 text-xs">· W.OT {otHoliday}h +{Math.round(salarySummary.otHolidayAmount).toLocaleString('en-US')}</span>
                            )}
                            {salarySummary.otPublicHolidayAmount > 0 && (
                              <span className="text-yellow-300 text-xs">· H.OT {otPublicHoliday}h +{Math.round(salarySummary.otPublicHolidayAmount).toLocaleString('en-US')}</span>
                            )}
                            {salarySummary.awoDeduction > 0 && (
                              <span className="text-red-400 text-xs">· AWO −{Math.round(salarySummary.awoDeduction).toLocaleString('en-US')} <span className="text-red-500 opacity-70">({awoCount}d)</span></span>
                            )}
                            <span className="text-slate-400 text-xs">·</span>
                            <span className="font-bold text-white tabular-nums">
                              Total: {salarySummary.totalSalary.toLocaleString('en-US')}
                            </span>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  {/* Row 3: period+days left, supervisor label flush-right before the white box */}
                  <div className="flex items-center justify-between mt-1.5 text-xs text-slate-400">
                    <span>
                      <span className="font-semibold text-slate-200">{periodLabel}</span>
                      <span className="ml-1.5">· {calendarDays} days</span>
                    </span>
                    <span className="font-medium text-slate-300 uppercase tracking-wide whitespace-nowrap">
                      Supervisor / Engineer Signature →
                    </span>
                  </div>
                </div>
                {/* White right — empty signature box with border and watermark */}
                <div
                  className={`emp-hdr-sig w-48 shrink-0 border-2 ${deptTheme.border} bg-white flex items-center justify-center`}
                  style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
                >
                  <span className="text-2xl font-bold text-slate-200 select-none tracking-widest uppercase">
                    Signature
                  </span>
                </div>
              </div>

              {/* ── Summary Strip ── */}
              <div
                className="emp-summary border-b"
                style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
              >
                <div className="grid grid-cols-8 divide-x divide-gray-100">
                  {[
                    {
                      label: 'Worked',
                      value: workedDays,
                      color: 'text-emerald-600',
                      sub: holidayWork > 0 ? `${present}P + ${holidayWork}H` : present > 0 ? `${present}P` : undefined,
                    },
                    { label: 'Weekend',    value: weekend,                  color: weekend > 0          ? 'text-slate-600'     : 'text-gray-300' },
                    { label: 'Vacation',   value: vacation,                 color: vacation > 0         ? 'text-blue-600'      : 'text-gray-300' },
                    { label: 'Absent',     value: absent,                   color: absent > 0           ? 'text-red-600'       : 'text-gray-300', sub: absentSub },
                    { label: 'Work Hrs',   value: `${totalHours}h`,         color: totalHours > 0       ? 'text-slate-700'     : 'text-gray-300' },
                    { label: 'OT ×1.25',  value: `${otNormal}h`,           color: otNormal > 0         ? deptTheme.accentText : 'text-gray-300' },
                    { label: 'W.OT ×1.5', value: `${otHoliday}h`,          color: otHoliday > 0        ? 'text-amber-500'     : 'text-gray-300' },
                    { label: 'P.H OT ×2', value: `${otPublicHoliday}h`,    color: otPublicHoliday > 0  ? 'text-rose-500'      : 'text-gray-300' },
                  ].map(({ label, value, color, sub }) => (
                    <div key={label} className="sum-card p-3 text-center">
                      <div className={`sum-val text-2xl font-bold ${color}`}>{value}</div>
                      <div className="sum-lbl text-xs text-gray-400 mt-0.5 font-medium uppercase tracking-wide leading-tight">{label}</div>
                      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
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


              {/* ── Daily Attendance Table ── */}
              <div className="overflow-x-auto">
                <table className="att-table w-full text-sm border-collapse table-fixed">
                  <colgroup>
                    <col style={{ width: '88px' }} />
                    <col style={{ width: '62px' }} />
                    {showWorkHours        && <col style={{ width: '40px' }} />}
                    {showOtNormal         && <col style={{ width: '36px' }} />}
                    {showOtHoliday        && <col style={{ width: '40px' }} />}
                    {showOtPublicHoliday  && <col style={{ width: '40px' }} />}
                    {showDailySalary      && <col style={{ width: '60px' }} />}
                    {showProjects         && <col />}
                    {showNotes            && <col style={{ width: '150px' }} />}
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-2.5 text-left font-semibold">Date</th>
                      <th className="px-3 py-2.5 text-center font-semibold">Status</th>
                      {showWorkHours && <th className="px-3 py-2.5 text-right font-semibold">Hrs</th>}
                      {showOtNormal && (
                        <th className="px-3 py-2.5 text-right font-semibold">
                          OT<span className="ot-rate block text-gray-400 font-normal normal-case tracking-normal">×1.25</span>
                        </th>
                      )}
                      {showOtHoliday && (
                        <th className="px-3 py-2.5 text-right font-semibold">
                          W.OT<span className="ot-rate block text-gray-400 font-normal normal-case tracking-normal">×1.5</span>
                        </th>
                      )}
                      {showOtPublicHoliday && (
                        <th className="px-3 py-2.5 text-right font-semibold">
                          H.OT<span className="ot-rate block text-gray-400 font-normal normal-case tracking-normal">×2.5</span>
                        </th>
                      )}
                      {showDailySalary && <th className="px-3 py-2.5 text-right font-semibold">Pay</th>}
                      {showProjects && <th className="px-3 py-2.5 text-left font-semibold">Project</th>}
                      {showNotes && <th className="px-3 py-2.5 text-left font-semibold">Notes</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {empReport.days.map((day) => {
                      const meta = getMeta(day.status_code);
                      const isAbsent = ABSENT_CODES.has(day.status_code);
                      const eid = empReport.employee.id;
                      return (
                        <tr key={day.date} className={`row-absent ${isAbsent ? meta.bg : 'hover:bg-gray-50'} transition-colors`}>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            <div className="date-day font-medium text-gray-700 leading-tight text-sm">
                              {formatDateShort(day.date)}
                            </div>
                            <div className="date-wd text-xs text-gray-400 leading-tight">
                              {new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                            </div>
                            {editMode && (() => {
                              const st = saveStatus[`${eid}__${day.date}`];
                              if (st === 'saving') return <div className="text-xs text-amber-500 leading-tight">saving…</div>;
                              if (st === 'saved')  return <div className="text-xs text-emerald-600 leading-tight">saved ✓</div>;
                              if (st === 'error')  return <div className="text-xs text-red-500 leading-tight">save failed!</div>;
                              return null;
                            })()}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {editMode ? (
                              <select
                                value={day.status_code}
                                onChange={e => {
                                  const val = e.target.value;
                                  updateDay(eid, day.date, d => ({ ...d, status_code: val }));
                                  saveDay(eid, day.date, { ...day, status_code: val });
                                }}
                                className="text-xs border rounded px-1 py-0.5 w-full max-w-[72px]"
                              >
                                {['P','W','H','HDAM','HDPM','AWO','SL','A','V'].map(c => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                            ) : (
                              <span className={`status-badge inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${meta.bg} ${meta.color}`}>
                                <span className={`badge-dot w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                {day.status_code}
                              </span>
                            )}
                          </td>
                          {showWorkHours && (
                            <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                              {editMode ? (
                                <input
                                  type="number" min="0" step="0.5"
                                  value={day.working_hours}
                                  onChange={e => updateDay(eid, day.date, d => ({ ...d, working_hours: parseFloat(e.target.value) || 0 }))}
                                  onBlur={e => saveDay(eid, day.date, { ...day, working_hours: parseFloat(e.target.value) || 0 })}
                                  className="w-14 text-right border rounded px-1 py-0.5 text-xs"
                                />
                              ) : (
                                day.working_hours > 0 ? day.working_hours : <span className="text-gray-300">—</span>
                              )}
                            </td>
                          )}
                          {showOtNormal && (
                            <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                              {editMode ? (
                                <input
                                  type="number" min="0" step="0.5"
                                  value={day.overtime.normal}
                                  onChange={e => updateDay(eid, day.date, d => ({ ...d, overtime: { ...d.overtime, normal: parseFloat(e.target.value) || 0 } }))}
                                  onBlur={e => saveDay(eid, day.date, { ...day, overtime: { ...day.overtime, normal: parseFloat(e.target.value) || 0 } })}
                                  className="w-14 text-right border rounded px-1 py-0.5 text-xs"
                                />
                              ) : (
                                day.overtime.normal > 0 ? day.overtime.normal : <span className="text-gray-300">—</span>
                              )}
                            </td>
                          )}
                          {showOtHoliday && (
                            <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                              {editMode ? (
                                <input
                                  type="number" min="0" step="0.5"
                                  value={day.overtime.holiday}
                                  onChange={e => updateDay(eid, day.date, d => ({ ...d, overtime: { ...d.overtime, holiday: parseFloat(e.target.value) || 0 } }))}
                                  onBlur={e => saveDay(eid, day.date, { ...day, overtime: { ...day.overtime, holiday: parseFloat(e.target.value) || 0 } })}
                                  className="w-14 text-right border rounded px-1 py-0.5 text-xs"
                                />
                              ) : (
                                day.overtime.holiday > 0 ? day.overtime.holiday : <span className="text-gray-300">—</span>
                              )}
                            </td>
                          )}
                          {showOtPublicHoliday && (
                            <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                              {editMode ? (
                                <input
                                  type="number" min="0" step="0.5"
                                  value={day.overtime.public_holiday}
                                  onChange={e => updateDay(eid, day.date, d => ({ ...d, overtime: { ...d.overtime, public_holiday: parseFloat(e.target.value) || 0 } }))}
                                  onBlur={e => saveDay(eid, day.date, { ...day, overtime: { ...day.overtime, public_holiday: parseFloat(e.target.value) || 0 } })}
                                  className="w-14 text-right border rounded px-1 py-0.5 text-xs"
                                />
                              ) : (
                                day.overtime.public_holiday > 0 ? day.overtime.public_holiday : <span className="text-gray-300">—</span>
                              )}
                            </td>
                          )}
                          {showDailySalary && (() => {
                            const hr = salarySummary!.hourlyRate;
                            const isAwo = day.status_code === 'AWO';
                            const isOtherAbsent = !isAwo && ABSENT_CODES.has(day.status_code);
                            const dayPay = isOtherAbsent
                              ? null
                              : isAwo
                                ? -Math.round(8 * hr)
                                : Math.round(
                                    day.working_hours * hr +
                                    day.overtime.normal * 1.25 * hr +
                                    day.overtime.holiday * 1.5 * hr +
                                    day.overtime.public_holiday * 2.5 * hr
                                  );
                            return (
                              <td className="px-3 py-2 text-right tabular-nums text-xs font-medium">
                                {dayPay == null
                                  ? <span className="text-gray-300">—</span>
                                  : dayPay < 0
                                    ? <span className="text-red-500">−{Math.abs(dayPay).toLocaleString('en-US')}</span>
                                    : <span className="text-slate-600">{dayPay.toLocaleString('en-US')}</span>}
                              </td>
                            );
                          })()}
                          {showProjects && (
                            <td className="px-3 py-2 text-gray-600 text-xs">
                              {editMode ? (
                                <input
                                  type="text"
                                  value={day.projects === '—' ? '' : day.projects}
                                  onChange={e => updateDay(eid, day.date, d => ({ ...d, projects: e.target.value || '—' }))}
                                  className="w-full border rounded px-1 py-0.5 text-xs"
                                  placeholder="Project info"
                                />
                              ) : (
                                day.projects && day.projects !== '—'
                                  ? <span className="cell-project line-clamp-2">{day.projects}</span>
                                  : <span className="text-gray-300">—</span>
                              )}
                            </td>
                          )}
                          {showNotes && (
                            <td className="px-3 py-2 text-gray-500 italic text-xs">
                              {editMode ? (
                                <input
                                  type="text"
                                  value={day.notes ?? ''}
                                  onChange={e => updateDay(eid, day.date, d => ({ ...d, notes: e.target.value || null }))}
                                  onBlur={e => saveDay(eid, day.date, { ...day, notes: e.target.value || null })}
                                  className="w-full border rounded px-1 py-0.5 text-xs not-italic"
                                  placeholder="Notes"
                                />
                              ) : (
                                day.notes && day.notes !== '—'
                                  ? <span className="cell-notes line-clamp-1 not-italic">{day.notes}</span>
                                  : <span className="not-italic text-gray-300">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          );
        })}

        {/* ── Overall Summary Page ── */}
        {hasReport && (
          <div className="emp-card bg-white rounded-lg shadow mt-6 overflow-hidden">
            <div
              className="emp-hdr bg-gradient-to-r from-indigo-900 to-indigo-800 text-white px-6 py-4"
              style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <div>
                  <h2 className="text-xl font-bold tracking-wide leading-tight">Overall Summary</h2>
                  <div className="text-indigo-200 text-sm mt-1">
                    {department !== ALL ? department : 'All Departments'} · {localReport.length} employee{localReport.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="text-right text-indigo-200 text-sm">
                  <div className="text-white font-semibold text-base">{summaryPeriodLabel}</div>
                  <div>{summaryCalendarDays} calendar days</div>
                </div>
              </div>
            </div>

            {/* Period stats strip */}
            <div
              className="emp-summary border-b"
              style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
            >
              <div className="grid grid-cols-4 divide-x divide-gray-100">
                {[
                  { label: 'Calendar Days',  value: summaryCalendarDays,                         color: 'text-slate-700' },
                  { label: 'Weekend Days',   value: summaryPeriodWeekends,                        color: 'text-slate-500' },
                  { label: 'Work Days',      value: summaryCalendarDays - summaryPeriodWeekends,  color: 'text-emerald-600' },
                  { label: 'Employees',      value: localReport.length,                                color: 'text-indigo-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="sum-card p-3 text-center">
                    <div className={`sum-val text-2xl font-bold ${color}`}>{value}</div>
                    <div className="sum-lbl text-xs text-gray-400 mt-0.5 font-medium uppercase tracking-wide leading-tight">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Abbreviation legend */}
            <div
              className="px-5 py-2 bg-gray-50 border-b flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500"
              style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' } as React.CSSProperties}
            >
              {[
                ['P', 'Present'], ['H', 'Holiday-Work'], ['W', 'Weekend'], ['V', 'Vacation'],
                ['AWO', 'Absent – no excuse'], ['SL', 'Sick Leave'], ['A', 'Absent – excused'],
                ['OT', '×1.25 normal'], ['W.OT', '×1.5 weekend'], ['H.OT', '×2.5 public holiday'],
              ].map(([code, desc]) => (
                <span key={code}>
                  <span className="font-semibold text-gray-700">{code}</span>
                  <span className="text-gray-400 ml-1">= {desc}</span>
                </span>
              ))}
            </div>

            {/* Per-employee summary table */}
            <div className="overflow-x-auto">
              <table className="att-table w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                    <th className="px-4 py-2.5 text-left font-semibold">Employee</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-emerald-700">Worked</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-emerald-600">P</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-amber-600">H</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-slate-500">W</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-blue-600">V</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-red-600">AWO</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-orange-600">SL</th>
                    <th className="px-3 py-2.5 text-center font-semibold text-purple-600">A</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Work Hrs</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-amber-600">OT ×1.25</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-amber-600">W.OT ×1.5</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-amber-600">H.OT ×2.5</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-red-600">Deduction</th>
                    <th className="px-3 py-2.5 text-right font-semibold text-indigo-700">Total Salary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employeeSummaries.map((s) => (
                    <tr key={s.employee.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <div className="font-medium text-gray-800">{s.employee.name}</div>
                        <div className="text-xs text-gray-400 font-mono">{s.employee.id} · {s.employee.department}</div>
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-emerald-700">{s.workedDays}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-emerald-600">{s.present      || <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-amber-600">{s.holidayWork    || <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-slate-500">{s.weekend        || <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-blue-600">{s.vacation        || <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-red-600">{s.awo              || <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-orange-600">{s.sl            || <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2 text-center tabular-nums text-purple-600">{s.a             || <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                        {s.totalHours > 0 ? `${s.totalHours}h` : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-600">
                        {s.otNormal > 0
                          ? <><span className="font-medium">{s.otNormal}h</span>{s.otNormalAmt > 0 && <span className="text-xs text-amber-400 ml-1">+{Math.round(s.otNormalAmt).toLocaleString('en-US')}</span>}</>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-600">
                        {s.otHoliday > 0
                          ? <><span className="font-medium">{s.otHoliday}h</span>{s.otHolidayAmt > 0 && <span className="text-xs text-amber-400 ml-1">+{Math.round(s.otHolidayAmt).toLocaleString('en-US')}</span>}</>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-600">
                        {s.otPublicHoliday > 0
                          ? <><span className="font-medium">{s.otPublicHoliday}h</span>{s.otPublicHolidayAmt > 0 && <span className="text-xs text-amber-400 ml-1">+{Math.round(s.otPublicHolidayAmt).toLocaleString('en-US')}</span>}</>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600">
                        {s.awoDeductionAmt > 0
                          ? <>−{Math.round(s.awoDeductionAmt).toLocaleString('en-US')}</>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold text-indigo-700">
                        {s.totalSalary != null
                          ? s.totalSalary.toLocaleString('en-US')
                          : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="footer-bar bg-slate-50 border-t-2 border-slate-200 font-semibold text-slate-700 text-sm">
                    <td className="px-4 py-2.5">TOTAL — {localReport.length} employee{localReport.length !== 1 ? 's' : ''}</td>
                    <td className="px-3 py-2.5 text-center font-bold text-emerald-700">{grandTotals.workedDays}</td>
                    <td className="px-3 py-2.5 text-center text-emerald-600">{grandTotals.present      || '—'}</td>
                    <td className="px-3 py-2.5 text-center text-amber-600">{grandTotals.holidayWork    || '—'}</td>
                    <td className="px-3 py-2.5 text-center text-slate-500">{grandTotals.weekend        || '—'}</td>
                    <td className="px-3 py-2.5 text-center text-blue-600">{grandTotals.vacation        || '—'}</td>
                    <td className="px-3 py-2.5 text-center text-red-600">{grandTotals.awo              || '—'}</td>
                    <td className="px-3 py-2.5 text-center text-orange-600">{grandTotals.sl            || '—'}</td>
                    <td className="px-3 py-2.5 text-center text-purple-600">{grandTotals.a             || '—'}</td>
                    <td className="px-3 py-2.5 text-right">{grandTotals.totalHours > 0 ? `${grandTotals.totalHours}h` : '—'}</td>
                    <td className="px-3 py-2.5 text-right text-amber-600">
                      {grandTotals.otNormal > 0 ? <>{grandTotals.otNormal}h{grandTotals.otNormalAmt > 0 && <span className="text-xs ml-1">+{Math.round(grandTotals.otNormalAmt).toLocaleString('en-US')}</span>}</> : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-amber-600">
                      {grandTotals.otHoliday > 0 ? <>{grandTotals.otHoliday}h{grandTotals.otHolidayAmt > 0 && <span className="text-xs ml-1">+{Math.round(grandTotals.otHolidayAmt).toLocaleString('en-US')}</span>}</> : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-amber-600">
                      {grandTotals.otPublicHoliday > 0 ? <>{grandTotals.otPublicHoliday}h{grandTotals.otPublicHolidayAmt > 0 && <span className="text-xs ml-1">+{Math.round(grandTotals.otPublicHolidayAmt).toLocaleString('en-US')}</span>}</> : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-red-600">
                      {grandTotals.awoDeductionAmt > 0 ? <>−{Math.round(grandTotals.awoDeductionAmt).toLocaleString('en-US')}</> : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-indigo-700">
                      {grandTotals.totalSalary > 0 ? grandTotals.totalSalary.toLocaleString('en-US') : '—'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>

      {!loading && localReport.length === 0 && !error && fromDate && toDate && (
        <p className="mt-6 p-4 text-center text-gray-500 no-print">
          No attendance data for the selected date range.
        </p>
      )}
    </>
  );
}
