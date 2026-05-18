'use client';

import { useState, useEffect } from 'react';
import { useSalaryReport } from '../../hooks/useSalaryReport';
import { fetchDepartmentsService } from '../../services/departmentService';
import { fetchEmployeesService } from '../../services/employeeService';
import type { SalaryReportEmployee, ProjectCostEntry } from '../../types/salaryReport';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getMonthBounds(yearMonth: string): { from: string; to: string } {
  const [y, m] = yearMonth.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${last}` };
}

function toYearMonth(isoDate: string): string {
  return isoDate.slice(0, 7); // "YYYY-MM"
}

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtRate(r: number): string {
  return `×${r.toFixed(2)}`;
}

function monthLabel(from: string): string {
  if (!from) return '';
  const [y, m] = from.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  color = 'text-slate-700',
  sub,
}: {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="sal-sum-cell p-3 text-center">
      <div className={`sal-sum-val text-2xl font-bold tabular-nums ${color}`}>
        {value}
      </div>
      <div className="sal-sum-lbl text-xs text-gray-400 mt-0.5 font-medium uppercase tracking-wide leading-tight">
        {label}
      </div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function ProjectTable({ projects, hourlyRate }: { projects: ProjectCostEntry[]; hourlyRate: number }) {
  if (projects.length === 0) return null;
  const totalBase = projects.reduce((s, p) => s + p.baseValue, 0);
  const totalOtVal = projects.reduce((s, p) => s + p.overtimeValue, 0);
  const totalVal = totalBase + totalOtVal;

  return (
    <div className="overflow-x-auto">
      <table className="sal-table w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
            <th className="px-4 py-2.5 text-left font-semibold">Project</th>
            <th className="px-3 py-2.5 text-right font-semibold">Work Hrs</th>
            <th className="px-3 py-2.5 text-right font-semibold">
              <span dir="rtl">قيمة الأيام</span>
            </th>
            <th className="px-3 py-2.5 text-right font-semibold">OT Hrs</th>
            <th className="px-3 py-2.5 text-center font-semibold">OT Rate</th>
            <th className="px-3 py-2.5 text-right font-semibold">
              <span dir="rtl">قيمة الإضافي</span>
            </th>
            <th className="px-3 py-2.5 text-right font-semibold">Total Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {projects.map((p) => (
            <tr key={p.projectName} className="hover:bg-gray-50">
              <td className="px-4 py-2 font-medium text-gray-800">{p.projectName}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                {p.workingHours > 0 ? p.workingHours : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                {p.baseValue > 0 ? fmt(p.baseValue, 2) : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                {p.overtimeHours > 0 ? p.overtimeHours : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-3 py-2 text-center text-amber-700 font-mono text-xs">
                {p.overtimeHours > 0 ? fmtRate(p.overtimeRate) : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                {p.overtimeValue > 0 ? fmt(p.overtimeValue, 2) : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">
                {fmt(p.baseValue + p.overtimeValue, 2)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-slate-700 text-sm">
            <td className="px-4 py-2.5">TOTAL</td>
            <td className="px-3 py-2.5 text-right tabular-nums">
              {projects.reduce((s, p) => s + p.workingHours, 0)}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
              {fmt(totalBase, 2)}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums">
              {projects.reduce((s, p) => s + p.overtimeHours, 0) || '—'}
            </td>
            <td />
            <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
              {totalOtVal > 0 ? fmt(totalOtVal, 2) : '—'}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums">{fmt(totalVal, 2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const ALL = '';

export function SalaryReportSection() {
  const { report, from: reportFrom, loading, error, fetchReport } = useSalaryReport();

  const [yearMonth, setYearMonth] = useState('');
  const [department, setDepartment] = useState(ALL);
  const [employeeId, setEmployeeId] = useState(ALL);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<
    { employee_id: string; name: string; department: string }[]
  >([]);
  const [filtersLoading, setFiltersLoading] = useState(true);

  useEffect(() => {
    // Default to current month
    const now = new Date();
    setYearMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  }, []);

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
    return () => {
      cancelled = true;
    };
  }, []);

  const employeesInDept =
    department === ALL
      ? employees
      : employees.filter(
          (e) => e.department.toLowerCase() === department.toLowerCase()
        );

  const handleGenerate = () => {
    if (!yearMonth) return;
    const { from, to } = getMonthBounds(yearMonth);
    fetchReport(
      from,
      to,
      department === ALL ? null : department,
      employeeId === ALL ? null : employeeId
    );
  };

  const handlePrint = () => {
    document.body.classList.add('print-salary');
    window.print();
    document.body.classList.remove('print-salary');
  };

  const hasReport = report.length > 0;
  const displayMonth = hasReport
    ? monthLabel(reportFrom)
    : yearMonth
    ? monthLabel(getMonthBounds(yearMonth).from)
    : '';

  return (
    <>
      <style>{`
        @media print {
          body.print-salary * { visibility: hidden; }
          body.print-salary #salary-print-area,
          body.print-salary #salary-print-area * { visibility: visible; }
          body.print-salary #salary-print-area {
            position: absolute; top: 0; left: 0; width: 100%;
          }
          @page { size: A4 portrait; margin: 10mm 12mm; }

          /* Page breaks */
          .sal-page-break { page-break-after: always; break-after: page; margin: 0 !important; }

          /* Card */
          .sal-card { box-shadow: none !important; border: 1px solid #d1d5db; border-radius: 0 !important; margin-top: 0 !important; }

          /* Header & summary strips must print colours */
          .sal-hdr, .sal-summary { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          /* Summary cells */
          .sal-sum-cell { padding: 4px 6px !important; }
          .sal-sum-val { font-size: 14pt !important; line-height: 1.1 !important; }
          .sal-sum-lbl { font-size: 6pt !important; }

          /* Total bar */
          .sal-total-bar { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          /* Project table */
          .sal-table { font-size: 8pt !important; }
          .sal-table th, .sal-table td { padding: 2px 5px !important; }
        }
      `}</style>

      {/* ── Controls ── */}
      <div className="bg-white rounded-lg shadow mt-6 no-print">
        <div className="p-5 border-b">
          <h2 className="text-xl font-semibold mb-1">Salary &amp; Project Cost Report</h2>
          <p className="text-xs text-gray-400 mb-4">
            Monthly payroll breakdown with base salary, overtime, and per-project cost allocation.
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
                  {employeesInDept.map((e) => (
                    <option key={e.employee_id} value={e.employee_id}>
                      {e.name} ({e.employee_id}) — {e.department}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Month</label>
            <input
              type="month"
              value={yearMonth}
              onChange={(e) => setYearMonth(e.target.value)}
              className="p-2 border rounded"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !yearMonth}
              className="bg-indigo-600 text-white px-5 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Loading…' : 'Generate Salary Report'}
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={!hasReport || loading}
              className="px-4 py-2 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40"
            >
              Print / Save as PDF
            </button>
          </div>

          {error && <p className="mt-3 text-red-500 text-sm">{error}</p>}
        </div>
      </div>

      {/* ── Printable area ── */}
      <div id="salary-print-area">
        {report.map((empReport: SalaryReportEmployee) => {
          const {
            employee,
            monthDays,
            totalMonthHours,
            hourlyRate,
            workedDays,
            awoDeductions,
            effectiveBaseHours,
            baseSalary,
            overtimeAmount,
            totalSalary,
            projects,
          } = empReport;

          return (
            <div
              key={employee.id}
              className="sal-card sal-page-break bg-white rounded-lg shadow mt-6 overflow-hidden"
            >
              {/* ── Header ── */}
              <div
                className="sal-hdr bg-gradient-to-r from-indigo-900 to-indigo-700 text-white px-6 py-4"
                style={
                  {
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  } as React.CSSProperties
                }
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div>
                    <h2 className="text-xl font-bold tracking-wide leading-tight">
                      {employee.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-indigo-200">
                      <span className="font-mono bg-indigo-800 px-2 py-0.5 rounded text-xs">
                        {employee.id}
                      </span>
                      <span>{employee.department}</span>
                      {employee.salary != null && employee.salary > 0 && (
                        <span>
                          Monthly Salary:{' '}
                          <strong className="text-white">{fmt(employee.salary)}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-indigo-200 text-sm">
                    <div className="text-white font-semibold text-lg">{displayMonth}</div>
                    <div>{monthDays} days in month</div>
                  </div>
                </div>
              </div>

              {/* ── Summary strips ── */}
              <div
                className="sal-summary border-b"
                style={
                  {
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  } as React.CSSProperties
                }
              >
                {/* Row 1: period info */}
                <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
                  <StatCell label="Month Days" value={monthDays} color="text-slate-600" />
                  <StatCell label="Month Hours" value={`${totalMonthHours}h`} color="text-slate-600" />
                  <StatCell
                    label="Hourly Rate"
                    value={fmt(hourlyRate, 4)}
                    color="text-indigo-700"
                  />
                  <StatCell
                    label="Monthly Salary"
                    value={employee.salary != null ? fmt(employee.salary) : '—'}
                    color="text-slate-700"
                  />
                </div>
                {/* Row 2: base salary inputs */}
                <div className="grid grid-cols-4 divide-x divide-gray-100">
                  <StatCell
                    label="Worked Days"
                    value={workedDays}
                    color="text-emerald-600"
                    sub={`× 8h = ${workedDays * 8}h`}
                  />
                  <StatCell
                    label="AWO Penalty"
                    value={awoDeductions}
                    color={awoDeductions > 0 ? 'text-red-600' : 'text-gray-300'}
                    sub={awoDeductions > 0 ? `− ${awoDeductions * 8}h` : undefined}
                  />
                  <StatCell
                    label="Effective Hrs"
                    value={`${effectiveBaseHours}h`}
                    color="text-emerald-700"
                  />
                  <StatCell
                    label="Base Salary"
                    value={fmt(baseSalary, 2)}
                    color="text-emerald-700"
                  />
                </div>
              </div>

              {/* ── Total salary bar ── */}
              <div
                className="sal-total-bar flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-slate-50 border-b"
                style={
                  {
                    WebkitPrintColorAdjust: 'exact',
                    printColorAdjust: 'exact',
                  } as React.CSSProperties
                }
              >
                <div className="flex flex-wrap items-center gap-6 text-sm">
                  <div>
                    <span className="text-gray-500">Base Salary</span>
                    <span className="ml-2 font-semibold text-emerald-700 tabular-nums">
                      {fmt(baseSalary, 2)}
                    </span>
                  </div>
                  {overtimeAmount > 0 && (
                    <>
                      <span className="text-gray-400">+</span>
                      <div>
                        <span className="text-gray-500">Overtime</span>
                        <span className="ml-2 font-semibold text-amber-700 tabular-nums">
                          {fmt(overtimeAmount, 2)}
                        </span>
                      </div>
                      <span className="text-gray-400">=</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                    Total Salary
                  </span>
                  <span className="text-3xl font-bold text-indigo-700 tabular-nums">
                    {fmt(totalSalary)}
                  </span>
                </div>
              </div>

              {/* ── Project cost table ── */}
              {projects.length > 0 ? (
                <>
                  <div className="px-4 pt-3 pb-1 bg-white">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Project Cost Breakdown
                    </h3>
                  </div>
                  <ProjectTable projects={projects} hourlyRate={hourlyRate} />
                </>
              ) : (
                <div className="px-6 py-3 text-xs text-gray-400 italic">
                  No project tracking data for this period.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!loading && report.length === 0 && !error && yearMonth && (
        <p className="mt-6 p-4 text-center text-gray-500 no-print">
          No salary data found. Generate the report first.
        </p>
      )}
    </>
  );
}
