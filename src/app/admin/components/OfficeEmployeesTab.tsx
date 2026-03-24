'use client';

import { useCallback, useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useOfficeEmployeesRealtime, type OfficeEmployeeRow } from '../hooks/useOfficeEmployeesRealtime';
import { createSupabbaseFrontendClient } from '@/lib/supabase';

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

type DayEntry = { checkIn: string | null; checkOut: string | null; hours: number };
type ReportResult = {
  employee: { id: string; employee_code: string; name: string; department: string };
  daily: Record<string, DayEntry>;
  monthlyTotal: number;
};

function getDatesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start);
  const e = new Date(end);
  while (d <= e) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function formatTimeShort(value: string | null): string {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '—';
  }
}
type PunchRow = {
  employeeId: string;
  employee_code: string;
  name: string;
  department: string;
  datetime: string;
  type: 'checkin' | 'checkout';
};

const OFFICE_EMPLOYEE_DEPARTMENTS = ['Bait Alshaar', 'Al Saqia', 'Office'] as const;

const DAYS_PER_PDF_PAGE = 15;

function downloadReportAsPDF(
  rows: ReportResult[],
  dates: string[],
  start: string,
  end: string,
  grandTotal: number
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;

  const title = `Monthly report ${start} to ${end}`;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(31, 41, 55);
  doc.text(title, margin, 10);
  doc.setFont('helvetica', 'normal');

  const dateChunks: string[][] = [];
  for (let i = 0; i < dates.length; i += DAYS_PER_PDF_PAGE) {
    dateChunks.push(dates.slice(i, i + DAYS_PER_PDF_PAGE));
  }
  if (dateChunks.length === 0) dateChunks.push([]);

  function buildTable(chunk: string[]) {
    const head = [
      'Employee',
      'Code',
      'Dept',
      ...chunk.map((d) => d.slice(8, 10)),
      'Reg (h)',
    ];
    const body = rows.map((r) => [
      r.employee.name,
      r.employee.employee_code || '—',
      r.employee.department || '—',
      ...chunk.map((date) => {
        const day = r.daily[date];
        if (!day) return '—';
        const inStr = formatTimeShort(day.checkIn);
        const outStr = formatTimeShort(day.checkOut);
        return `In:  ${inStr}\nOut: ${outStr}`;
      }),
      String(r.monthlyTotal.toFixed(1)),
    ]);
    return { head, body };
  }

  const dateColWidth = 14;

  for (let p = 0; p < dateChunks.length; p++) {
    if (p > 0) {
      doc.addPage('a4', 'l');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text(title, margin, 10);
      doc.setFont('helvetica', 'normal');
    }

    const chunk = dateChunks[p];
    const { head, body } = buildTable(chunk);
    const dateColumnStyles: Record<number, { cellWidth: number }> = {};
    for (let i = 3; i < head.length - 1; i++) dateColumnStyles[i] = { cellWidth: dateColWidth };

    autoTable(doc, {
      head: [head],
      body,
      startY: 14,
      margin: { left: margin, right: margin },
      styles: { fontSize: 6, textColor: [31, 41, 55], cellPadding: 1 },
      headStyles: {
        fillColor: [55, 65, 81],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 6,
        cellPadding: 1,
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 14 },
        2: { cellWidth: 16 },
        ...dateColumnStyles,
        [head.length - 1]: { cellWidth: 12 },
      },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY ?? 18;
    if (p === dateChunks.length - 1) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(31, 41, 55);
      doc.text(`Grand total: ${grandTotal.toFixed(2)} hours`, margin, finalY + 8);
    }
  }

  doc.save(`monthly-report-${start}-${end}.pdf`);
}

function downloadReportAsExcel(
  rows: ReportResult[],
  dates: string[],
  start: string,
  end: string,
  grandTotal: number
) {
  const headerRow = [
    'Employee',
    'Employee ID',
    'Department',
    ...dates.map((d) => d.slice(8, 10)),
    'Regular (h)',
  ];
  const dataRows = rows.map((r) => [
    r.employee.name,
    r.employee.employee_code || '',
    r.employee.department || '—',
    ...dates.map((date) => {
      const day = r.daily[date];
      return day
        ? `${formatTimeShort(day.checkIn)}–${formatTimeShort(day.checkOut)}`
        : '—';
    }),
    r.monthlyTotal.toFixed(1),
  ]);
  const footerRow = [
    '',
    '',
    'Grand total',
    ...dates.map(() => ''),
    grandTotal.toFixed(2),
  ];
  const aoa = [headerRow, ...dataRows, footerRow];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const colWidths = [
    { wch: 24 },
    { wch: 14 },
    { wch: 18 },
    ...dates.map(() => ({ wch: 12 })),
    { wch: 10 },
  ];
  ws['!cols'] = colWidths;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Monthly report');
  XLSX.writeFile(wb, `monthly-report-${start}-${end}.xlsx`);
}

export function OfficeEmployeesTab() {
  const supabase = useMemo(() => createSupabbaseFrontendClient(), []);
  const { employees, attendanceToday, loading, error } = useOfficeEmployeesRealtime();
  const [query, setQuery] = useState('');
  const [editEmployee, setEditEmployee] = useState<OfficeEmployeeRow | null>(null);
  const [editForm, setEditForm] = useState<{
    personal_email: string;
    phone: string;
    department: string;
    salary: string;
    min_working_hours: string;
    max_working_hours: string;
    auto_daily_report_enabled: boolean;
    auto_daily_report_time: string;
    auto_month_end_report_enabled: boolean;
    auto_month_end_report_time: string;
  }>({
    personal_email: '',
    phone: '',
    department: 'Office',
    salary: '',
    min_working_hours: '',
    max_working_hours: '',
    auto_daily_report_enabled: false,
    auto_daily_report_time: '10:00',
    auto_month_end_report_enabled: false,
    auto_month_end_report_time: '18:00',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [sendingReportId, setSendingReportId] = useState<string | null>(null);
  const [reportSendStatus, setReportSendStatus] = useState<{ id: string; msg: string } | null>(null);
  const [sendingDueNow, setSendingDueNow] = useState(false);
  const [dueNowStatus, setDueNowStatus] = useState('');

  const now = useMemo(() => new Date(), []);
  const [reportStart, setReportStart] = useState(getMonthStart(now));
  const [reportEnd, setReportEnd] = useState(getMonthEnd(now));
  const [reportData, setReportData] = useState<{ results: ReportResult[]; grandTotal: number } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  type ReportSortKey = 'name' | 'department' | 'monthlyTotal';
  const [reportSortBy, setReportSortBy] = useState<ReportSortKey>('name');
  const [reportSortDir, setReportSortDir] = useState<'asc' | 'desc'>('asc');
  const [reportDepartmentFilter, setReportDepartmentFilter] = useState<string>('');
  type EmployeeSortKey = 'name' | 'employee_code' | 'department' | 'created_at';
  const [employeeSortBy, setEmployeeSortBy] = useState<EmployeeSortKey>('name');
  const [employeeSortDir, setEmployeeSortDir] = useState<'asc' | 'desc'>('asc');
  const [employeeDepartmentFilter, setEmployeeDepartmentFilter] = useState<string>('');

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
    const terms = q.split(/\s+/).filter(Boolean);
    return employees.filter((e) => {
      const hay = [
        e.employee_code,
        e.name,
        e.email,
        e.personal_email ?? '',
        e.phone ?? '',
        e.department,
        e.device_id ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return terms.every((term) => hay.includes(term));
    });
  }, [employees, query]);

  const employeeDepartments = useMemo(() => {
    const set = new Set(employees.map((e) => e.department).filter(Boolean));
    return Array.from(set).sort();
  }, [employees]);

  const sortedAndFiltered = useMemo(() => {
    let list = filtered;
    if (employeeDepartmentFilter) {
      list = list.filter((e) => e.department === employeeDepartmentFilter);
    }
    const dir = employeeSortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (employeeSortBy === 'name') {
        return dir * (a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      }
      if (employeeSortBy === 'employee_code') {
        return dir * (a.employee_code.localeCompare(b.employee_code, undefined, { sensitivity: 'base' }));
      }
      if (employeeSortBy === 'department') {
        return dir * ((a.department || '').localeCompare(b.department || '', undefined, { sensitivity: 'base' }));
      }
      if (employeeSortBy === 'created_at') {
        return dir * (a.created_at.localeCompare(b.created_at));
      }
      return 0;
    });
  }, [filtered, employeeDepartmentFilter, employeeSortBy, employeeSortDir]);

  const employeeById = useMemo(() => {
    const m = new Map<string, { employee_code: string; name: string; department: string }>();
    employees.forEach((e) => m.set(e.id, { employee_code: e.employee_code, name: e.name, department: e.department }));
    return m;
  }, [employees]);

  const reportDates = useMemo(() => getDatesInRange(reportStart, reportEnd), [reportStart, reportEnd]);

  const reportDepartments = useMemo(() => {
    if (!reportData?.results.length) return [];
    const set = new Set(reportData.results.map((r) => r.employee.department).filter(Boolean));
    return Array.from(set).sort();
  }, [reportData?.results]);

  const reportRows = useMemo(() => {
    if (!reportData?.results.length) return [];
    let list = reportData.results;
    if (reportDepartmentFilter) {
      list = list.filter((r) => r.employee.department === reportDepartmentFilter);
    }
    const dir = reportSortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      if (reportSortBy === 'name') {
        return dir * (a.employee.name.localeCompare(b.employee.name, undefined, { sensitivity: 'base' }));
      }
      if (reportSortBy === 'department') {
        return dir * (a.employee.department.localeCompare(b.employee.department, undefined, { sensitivity: 'base' }));
      }
      return dir * (a.monthlyTotal - b.monthlyTotal);
    });
    return list;
  }, [reportData?.results, reportDepartmentFilter, reportSortBy, reportSortDir]);

  const toggleReportSort = (key: ReportSortKey) => {
    if (reportSortBy === key) setReportSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setReportSortBy(key);
      setReportSortDir('asc');
    }
  };

  const openEdit = useCallback((e: OfficeEmployeeRow) => {
    setEditEmployee(e);
    setEditForm({
      personal_email: e.personal_email ?? '',
      phone: e.phone ?? '',
      department: e.department,
      salary: e.salary != null ? String(e.salary) : '',
      min_working_hours: e.min_working_hours != null ? String(e.min_working_hours) : '',
      max_working_hours: e.max_working_hours != null ? String(e.max_working_hours) : '',
      auto_daily_report_enabled: !!e.auto_daily_report_enabled,
      auto_daily_report_time: (e.auto_daily_report_time || '10:00').slice(0, 5),
      auto_month_end_report_enabled: !!e.auto_month_end_report_enabled,
      auto_month_end_report_time: (e.auto_month_end_report_time || '18:00').slice(0, 5),
    });
    setEditError('');
  }, []);

  const closeEdit = useCallback(() => {
    setEditEmployee(null);
    setEditError('');
  }, []);

  const sendEmployeeReport = useCallback(async (employeeId: string) => {
    setSendingReportId(employeeId);
    setReportSendStatus(null);
    try {
      const res = await fetch('/api/office/send-employee-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (data as { error?: string })?.error ?? 'Failed to send';
        setReportSendStatus({ id: employeeId, msg });
      } else if ((data as { ok?: boolean }).ok) {
        setReportSendStatus({ id: employeeId, msg: 'Report sent.' });
        setTimeout(() => setReportSendStatus(null), 3000);
      } else {
        setReportSendStatus({ id: employeeId, msg: (data as { error?: string })?.error ?? 'Failed to send' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setReportSendStatus({ id: employeeId, msg });
    } finally {
      setSendingReportId(null);
    }
  }, []);

  const sendEmployeeMonthEndReport = useCallback(async (employeeId: string) => {
    setSendingReportId(employeeId);
    setReportSendStatus(null);
    try {
      const res = await fetch('/api/office/send-employee-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, reportType: 'monthEnd' }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = (data as { error?: string })?.error ?? 'Failed to send';
        setReportSendStatus({ id: employeeId, msg });
      } else if ((data as { ok?: boolean }).ok) {
        setReportSendStatus({ id: employeeId, msg: 'Month-end report sent.' });
        setTimeout(() => setReportSendStatus(null), 3000);
      } else {
        setReportSendStatus({ id: employeeId, msg: (data as { error?: string })?.error ?? 'Failed to send' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Request failed';
      setReportSendStatus({ id: employeeId, msg });
    } finally {
      setSendingReportId(null);
    }
  }, []);

  const runDueReportsNow = useCallback(async () => {
    setSendingDueNow(true);
    setDueNowStatus('');
    try {
      const res = await fetch('/api/office/send-employee-reports-due', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = (await res.json().catch(() => ({}))) as {
        sentDaily?: number;
        sentMonthEnd?: number;
        errors?: string[];
        error?: string;
      };
      if (!res.ok) {
        setDueNowStatus((data.error ?? data.errors?.join('; ') ?? 'Failed to run due reports').trim());
        return;
      }
      const sentDaily = data.sentDaily ?? 0;
      const sentMonthEnd = data.sentMonthEnd ?? 0;
      const errs = data.errors?.length ? ` Errors: ${data.errors.length}` : '';
      setDueNowStatus(`Done. Daily: ${sentDaily}, Month-end: ${sentMonthEnd}.${errs}`);
    } catch (err) {
      setDueNowStatus(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSendingDueNow(false);
    }
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editEmployee) return;
    setEditSaving(true);
    setEditError('');
    const salaryNum = editForm.salary.trim() === '' ? null : Number(editForm.salary);
    const minH = editForm.min_working_hours.trim() === '' ? null : Number(editForm.min_working_hours);
    const maxH = editForm.max_working_hours.trim() === '' ? null : Number(editForm.max_working_hours);
    if (salaryNum != null && (Number.isNaN(salaryNum) || salaryNum < 0)) {
      setEditError('Salary must be a non-negative number.');
      setEditSaving(false);
      return;
    }
    if (minH != null && (Number.isNaN(minH) || minH < 0 || minH > 744)) {
      setEditError('Min working hours must be between 0 and 744 (hours per month).');
      setEditSaving(false);
      return;
    }
    if (maxH != null && (Number.isNaN(maxH) || maxH < 0 || maxH > 744)) {
      setEditError('Max working hours must be between 0 and 744 (hours per month).');
      setEditSaving(false);
      return;
    }
    if (minH != null && maxH != null && minH > maxH) {
      setEditError('Min working hours cannot exceed max working hours.');
      setEditSaving(false);
      return;
    }
    const { error: updateError } = await supabase
      .from('office_employees')
      .update({
        personal_email: editForm.personal_email.trim() || null,
        phone: editForm.phone.trim() || null,
        salary: salaryNum,
        min_working_hours: minH,
        max_working_hours: maxH,
        auto_daily_report_enabled: editForm.auto_daily_report_enabled,
        auto_daily_report_time: editForm.auto_daily_report_time,
        auto_month_end_report_enabled: editForm.auto_month_end_report_enabled,
        auto_month_end_report_time: editForm.auto_month_end_report_time,
      })
      .eq('id', editEmployee.id);
    setEditSaving(false);
    if (updateError) {
      setEditError(updateError.message ?? 'Failed to update employee');
      return;
    }
    closeEdit();
  }, [editEmployee, editForm, supabase, closeEdit]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Office Employees</h2>
          <p className="text-sm text-gray-600">
            Realtime view from <code>office_employees</code> and today&apos;s check-in/check-out.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Auto schedule is manual-trigger only: click <strong>Run due reports now</strong> to send all currently due
            employee reports.
          </p>
        </div>
        <div className="w-full sm:w-80 space-y-2">
          <label className="block text-sm text-gray-600 mb-1">Search employees</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="code, name, email, department..."
            className="w-full border rounded px-3 py-2"
          />
          <button
            type="button"
            onClick={runDueReportsNow}
            disabled={sendingDueNow}
            className="w-full text-sm px-3 py-2 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {sendingDueNow ? 'Running due reports…' : 'Run due reports now'}
          </button>
          {dueNowStatus && <p className="text-xs text-gray-600">{dueNowStatus}</p>}
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
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Department:</label>
                <select
                  value={reportDepartmentFilter}
                  onChange={(e) => setReportDepartmentFilter(e.target.value)}
                  className="border rounded px-2 py-1.5 text-sm bg-white min-w-[140px]"
                >
                  <option value="">All departments</option>
                  {reportDepartments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <p className="text-sm text-gray-600">
                Showing <strong>{reportRows.length}</strong> of {reportData.results.length} employees
                {reportDepartmentFilter && ` in ${reportDepartmentFilter}`}
              </p>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-gray-500">Download:</span>
                <button
                  type="button"
                  onClick={() =>
                    downloadReportAsPDF(
                      reportRows,
                      reportDates,
                      reportStart,
                      reportEnd,
                      reportRows.reduce((s, r) => s + r.monthlyTotal, 0)
                    )
                  }
                  className="px-3 py-1.5 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  PDF
                </button>
                <button
                  type="button"
                  onClick={() =>
                    downloadReportAsExcel(
                      reportRows,
                      reportDates,
                      reportStart,
                      reportEnd,
                      reportRows.reduce((s, r) => s + r.monthlyTotal, 0)
                    )
                  }
                  className="px-3 py-1.5 rounded border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Excel
                </button>
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="sticky left-0 z-10 bg-gray-50 w-[160px] max-w-[160px] px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap border-r border-gray-200">
                      <button type="button" onClick={() => toggleReportSort('name')} className="flex items-center gap-1 hover:text-gray-900">
                        Employee
                        {reportSortBy === 'name' && (reportSortDir === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                    </th>
                    <th className="sticky left-[160px] z-10 bg-gray-50 w-[120px] max-w-[120px] px-3 py-2.5 text-left font-medium text-gray-600 whitespace-nowrap border-r border-gray-200">
                      <button type="button" onClick={() => toggleReportSort('department')} className="flex items-center gap-1 hover:text-gray-900">
                        Department
                        {reportSortBy === 'department' && (reportSortDir === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                    </th>
                    {reportDates.map((date) => {
                      const day = date.slice(8, 10);
                      return (
                        <th key={date} className="px-2 py-2 text-center font-medium text-gray-500 whitespace-nowrap min-w-[88px]">
                          {day}
                        </th>
                      );
                    })}
                    <th className="sticky right-0 z-10 bg-gray-50 w-[72px] max-w-[72px] px-2 py-2.5 text-right font-medium text-gray-600 whitespace-nowrap border-l border-gray-200">
                      <button type="button" onClick={() => toggleReportSort('monthlyTotal')} className="flex items-center justify-end gap-1 w-full hover:text-gray-900">
                        Regular (h)
                        {reportSortBy === 'monthlyTotal' && (reportSortDir === 'asc' ? ' ↑' : ' ↓')}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {reportRows.map((r) => (
                    <tr key={r.employee.id} className="group hover:bg-gray-50/80">
                      <td className="sticky left-0 z-[1] bg-white group-hover:bg-gray-50/80 w-[160px] max-w-[160px] px-3 py-2 border-r border-gray-100 whitespace-nowrap">
                        <div className="font-medium text-gray-900 truncate" title={r.employee.name}>{r.employee.name}</div>
                        {r.employee.employee_code && (
                          <div className="text-xs text-gray-500">{r.employee.employee_code}</div>
                        )}
                      </td>
                      <td className="sticky left-[160px] z-[1] bg-white group-hover:bg-gray-50/80 w-[120px] max-w-[120px] px-3 py-2 border-r border-gray-100 whitespace-nowrap text-gray-700">
                        {r.employee.department || '—'}
                      </td>
                      {reportDates.map((date) => {
                        const day = r.daily[date];
                        const text = day
                          ? `${formatTimeShort(day.checkIn)}–${formatTimeShort(day.checkOut)}`
                          : '—';
                        return (
                          <td key={date} className="px-2 py-1.5 text-center text-gray-700 whitespace-nowrap">
                            {text}
                          </td>
                        );
                      })}
                      <td className="sticky right-0 z-[1] bg-white group-hover:bg-gray-50/80 w-[72px] max-w-[72px] px-2 py-2 border-l border-gray-100 text-right font-medium tabular-nums">
                        {r.monthlyTotal.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm font-medium text-gray-700">
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
            <span className="font-semibold">{sortedAndFiltered.length}</span>
          </div>
          <div className="text-gray-500">
            Updates automatically on insert/update/delete (enable Realtime publication for <code>office_employees</code>).
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              value={employeeDepartmentFilter}
              onChange={(e) => setEmployeeDepartmentFilter(e.target.value)}
              className="border rounded px-3 py-2 text-sm bg-white min-w-[160px]"
            >
              <option value="">All departments</option>
              {employeeDepartments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort by</label>
            <select
              value={`${employeeSortBy}-${employeeSortDir}`}
              onChange={(e) => {
                const v = e.target.value;
                const [by, dir] = v.split('-') as [EmployeeSortKey, 'asc' | 'desc'];
                setEmployeeSortBy(by);
                setEmployeeSortDir(dir);
              }}
              className="border rounded px-3 py-2 text-sm bg-white min-w-[180px]"
            >
              <option value="name-asc">Name (A–Z)</option>
              <option value="name-desc">Name (Z–A)</option>
              <option value="employee_code-asc">Code (A–Z)</option>
              <option value="employee_code-desc">Code (Z–A)</option>
              <option value="department-asc">Department (A–Z)</option>
              <option value="department-desc">Department (Z–A)</option>
              <option value="created_at-desc">Newest first</option>
              <option value="created_at-asc">Oldest first</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="p-4 text-center">Loading office employees…</p>
        ) : sortedAndFiltered.length === 0 ? (
          <p className="p-4 text-center text-gray-600">No office employees match your search or filter.</p>
        ) : (
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Code</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Email (BioTime)</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Personal email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Department</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Salary</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Min / Max (h/mo)</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Device ID</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Token</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedAndFiltered.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => openEdit(e)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => sendEmployeeReport(e.id)}
                          disabled={sendingReportId === e.id || (!e.personal_email && !e.email)}
                          title={e.personal_email || e.email ? 'Email this employee their work hours' : 'Add personal email to send report'}
                          className="text-sm px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sendingReportId === e.id ? 'Sending…' : 'Email report'}
                        </button>
                        <button
                          type="button"
                          onClick={() => sendEmployeeMonthEndReport(e.id)}
                          disabled={sendingReportId === e.id || (!e.personal_email && !e.email)}
                          title={e.personal_email || e.email ? 'Email this employee month-end work hours' : 'Add personal email to send report'}
                          className="text-sm px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sendingReportId === e.id ? 'Sending…' : 'Month-end'}
                        </button>
                        {reportSendStatus?.id === e.id && (
                          <span className="text-xs text-gray-600">{reportSendStatus.msg}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">{e.employee_code}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{e.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.personal_email ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.phone ?? '-'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.department}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{e.salary != null ? Number(e.salary).toLocaleString() : '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {e.min_working_hours != null || e.max_working_hours != null
                        ? `${e.min_working_hours ?? '—'} / ${e.max_working_hours ?? '—'}`
                        : '—'}
                    </td>
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

      {/* Edit employee modal */}
      {editEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="edit-employee-title">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b">
              <h3 id="edit-employee-title" className="text-lg font-semibold">Edit employee</h3>
              <p className="text-sm text-gray-500 mt-1">
                {editEmployee.name} ({editEmployee.employee_code})
              </p>
            </div>
            <form
              className="p-4 space-y-4"
              onSubmit={(ev) => {
                ev.preventDefault();
                saveEdit();
              }}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department (from BioTime)</label>
                <input
                  type="text"
                  value={editEmployee.department ?? ''}
                  readOnly
                  className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600"
                  title="Synced from BioTime; not editable here"
                />
                <p className="text-xs text-gray-500 mt-0.5">From BioTime sync. Not editable here.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email (from BioTime)</label>
                <input
                  type="text"
                  value={editEmployee.email ?? ''}
                  readOnly
                  className="w-full border rounded px-3 py-2 bg-gray-100 text-gray-600"
                  title="Synced from BioTime; not editable here"
                />
                <p className="text-xs text-gray-500 mt-0.5">Synced from BioTime. Use Personal email for reports.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Personal email</label>
                <input
                  type="email"
                  value={editForm.personal_email}
                  onChange={(e) => setEditForm((f) => ({ ...f, personal_email: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  placeholder="For work hours report"
                />
                <p className="text-xs text-gray-500 mt-0.5">Work hours report is sent to this email (or BioTime email if empty).</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Salary</label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={editForm.salary}
                  onChange={(e) => setEditForm((f) => ({ ...f, salary: e.target.value }))}
                  className="w-full border rounded px-3 py-2"
                  placeholder="Optional"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min working hours/month</label>
                  <input
                    type="number"
                    min={0}
                    max={744}
                    step="1"
                    value={editForm.min_working_hours}
                    onChange={(e) => setEditForm((f) => ({ ...f, min_working_hours: e.target.value }))}
                    className="w-full border rounded px-3 py-2"
                    placeholder="e.g. 160"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max working hours/month</label>
                  <input
                    type="number"
                    min={0}
                    max={744}
                    step="1"
                    value={editForm.max_working_hours}
                    onChange={(e) => setEditForm((f) => ({ ...f, max_working_hours: e.target.value }))}
                    className="w-full border rounded px-3 py-2"
                    placeholder="e.g. 200"
                  />
                </div>
              </div>
              <div className="rounded border border-gray-200 p-3 space-y-3 bg-gray-50">
                <h4 className="text-sm font-semibold text-gray-800">Auto report schedule (UAE time)</h4>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.auto_daily_report_enabled}
                    onChange={(e) => setEditForm((f) => ({ ...f, auto_daily_report_enabled: e.target.checked }))}
                  />
                  Enable daily automatic report for this employee
                </label>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Daily report time (UAE)</label>
                  <input
                    type="time"
                    value={editForm.auto_daily_report_time}
                    onChange={(e) => setEditForm((f) => ({ ...f, auto_daily_report_time: e.target.value }))}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.auto_month_end_report_enabled}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, auto_month_end_report_enabled: e.target.checked }))
                    }
                  />
                  Enable month-end automatic report
                </label>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Month-end report time (UAE)</label>
                  <input
                    type="time"
                    value={editForm.auto_month_end_report_time}
                    onChange={(e) => setEditForm((f) => ({ ...f, auto_month_end_report_time: e.target.value }))}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Manual trigger endpoint: <code>/api/office/send-employee-reports-due</code>. Use the{' '}
                  <strong>Run due reports now</strong> button on this page to send all due employee reports.
                </p>
              </div>
              {editError && (
                <p className="text-sm text-red-600">{editError}</p>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={closeEdit}
                  className="px-4 py-2 rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

