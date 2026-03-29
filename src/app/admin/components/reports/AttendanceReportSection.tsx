'use client';

import { useState, useEffect } from 'react';
import { useAttendanceReport } from '../../hooks/useAttendanceReport';
import { fetchDepartmentsService } from '../../services/departmentService';
import { fetchEmployeesService } from '../../services/employeeService';
import type { AttendanceReportEmployeeReport } from '../../types/attendanceReport';
import { WORKER_CARD_AR } from '@/app/constants/workerCardReportAr';

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr + 'Z').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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

const ALL = '';

export function AttendanceReportSection() {
  const {
    report,
    loading,
    error,
    projectsWarning,
    fetchReport,
  } = useAttendanceReport();

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
      fromDate,
      toDate,
      department === ALL ? null : department,
      employeeId === ALL ? null : employeeId
    );
  };

  const hasReport = report.length > 0;

  const handleDownloadCsv = () => {
    if (!hasReport) return;

    const header = [
      'Employee ID',
      'Employee Name',
      'Department',
      'Salary',
      WORKER_CARD_AR.date,
      'Status Code',
      WORKER_CARD_AR.workHours,
      WORKER_CARD_AR.overtimeNormal,
      WORKER_CARD_AR.overtimeHoliday,
      WORKER_CARD_AR.overtimePublicHoliday,
      WORKER_CARD_AR.project,
      WORKER_CARD_AR.notes,
    ];

    const rows: string[] = [];
    rows.push(header.join(','));

    report.forEach((emp) => {
      emp.days.forEach((day) => {
        rows.push(
          [
            csvEscape(emp.employee.id),
            csvEscape(emp.employee.name),
            csvEscape(emp.employee.department),
            csvEscape(emp.employee.salary ?? ''),
            csvEscape(day.date),
            csvEscape(day.status_code),
            csvEscape(day.working_hours),
            csvEscape(day.overtime.normal),
            csvEscape(day.overtime.holiday),
            csvEscape(day.overtime.public_holiday),
            csvEscape(day.projects),
            csvEscape(day.notes ?? ''),
          ].join(',')
        );
      });
    });

    const csv = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeFrom = fromDate || 'from';
    const safeTo = toDate || 'to';
    link.download = `attendance-report_${safeFrom}_${safeTo}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow mt-6">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold mb-4">Attendance Report (Monthly / History)</h2>
        <p className="text-sm text-gray-600 mb-4">
          Select department and/or employee, then date range, then generate. Sorted by <strong>department</strong>, then name. Status: P=Present, W=Weekend, H=Holiday-Work, AWO=Absence without excuse, SL=Sick Leave, A=Absence with excuse, V=Vacation.
          Overtime columns match the worker card (بطاقة عامل):{' '}
          <span className="font-medium" dir="rtl">
            {WORKER_CARD_AR.overtimeNormal}
          </span>
          ,{' '}
          <span className="font-medium" dir="rtl">
            {WORKER_CARD_AR.overtimeHoliday}
          </span>
          ,{' '}
          <span className="font-medium" dir="rtl">
            {WORKER_CARD_AR.overtimePublicHoliday}
          </span>{' '}
          — filled from each project&apos;s overtime type; older rows without a type use the day status (Present / Weekend / Holiday-Work) as before.
        </p>
        {!filtersLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Department</label>
              <select
                value={department}
                onChange={(e) => {
                  setDepartment(e.target.value);
                  setEmployeeId(ALL);
                }}
                className="w-full p-2 border rounded"
              >
                <option value={ALL}>All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
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
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">To date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Generate Attendance Report'}
        </button>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={!hasReport || loading}
            className="px-4 py-2 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Download Excel (CSV)
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!hasReport || loading}
            className="px-4 py-2 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Print / Save as PDF
          </button>
        </div>
        {error && (
          <p className="mt-2 text-red-500 text-sm">{error}</p>
        )}
        {projectsWarning && !error && (
          <p className="mt-2 text-amber-600 text-sm">{projectsWarning}</p>
        )}
      </div>

      {report.length > 0 && (
        <div className="p-4 overflow-x-auto">
          {report.map((empReport: AttendanceReportEmployeeReport) => (
            <div
              key={empReport.employee.id}
              className="mb-8 last:mb-0"
            >
              <h3 className="text-lg font-medium mb-2">
                {empReport.employee.name} ({empReport.employee.id})
                <span className="text-gray-500 font-normal ml-2">
                  — {empReport.employee.department}
                </span>
                {empReport.employee.salary != null && (
                  <span className="text-gray-500 font-normal ml-2">
                    — Salary: {empReport.employee.salary}
                  </span>
                )}
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        {WORKER_CARD_AR.date}
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Code
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">
                        {WORKER_CARD_AR.workHours}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 max-w-[7rem] whitespace-normal leading-tight">
                        {WORKER_CARD_AR.overtimeNormal}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 max-w-[7rem] whitespace-normal leading-tight">
                        {WORKER_CARD_AR.overtimeHoliday}
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 max-w-[7rem] whitespace-normal leading-tight">
                        {WORKER_CARD_AR.overtimePublicHoliday}
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        {WORKER_CARD_AR.project}
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">
                        {WORKER_CARD_AR.notes}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {empReport.days.map((day) => (
                      <tr key={day.date}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatDate(day.date)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap font-medium">
                          {day.status_code}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          {day.working_hours}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right text-gray-600">
                          {day.overtime.normal}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right text-gray-600">
                          {day.overtime.holiday}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right text-gray-600">
                          {day.overtime.public_holiday}
                        </td>
                        <td className="px-3 py-2 max-w-xs truncate">
                          {day.projects || '—'}
                        </td>
                        <td className="px-3 py-2 max-w-xs truncate text-gray-600">
                          {day.notes ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && report.length === 0 && !error && fromDate && toDate && (
        <p className="p-4 text-center text-gray-500">
          No attendance data for the selected date range.
        </p>
      )}
    </div>
  );
}
