'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSalaryReport } from '../../hooks/useSalaryReport';
import { fetchDepartmentsService } from '../../services/departmentService';
import { fetchEmployeesService } from '../../services/employeeService';
import { fetchProjectsService } from '../../services/projectService';
import { pivotSalaryReportByProject, buildSalaryReconciliationSummary } from '../../services/projectCostReportService';
import type { SalaryReportEmployee, ProjectCostEntry } from '../../types/salaryReport';
import type { ProjectCostReport, ProjectEmployeeEntry, SalaryReconciliationSummary } from '../../types/projectCostReport';
import {
  getPayrollPeriodBounds,
  getCurrentPayrollYearMonth,
  formatPeriodLabel,
  payrollMonthLabel,
} from '@/lib/payrollPeriod';
import { PayrollReportDeliveryPanel } from './PayrollReportDeliveryPanel';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtRate(r: number): string {
  return `×${r.toFixed(2)}`;
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

function ProjectTable({ projects }: { projects: ProjectCostEntry[] }) {
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

function EmployeeCostTable({ employees }: { employees: ProjectEmployeeEntry[] }) {
  if (employees.length === 0) return null;
  const totalBase = employees.reduce((s, e) => s + e.baseValue, 0);
  const totalOtVal = employees.reduce((s, e) => s + e.overtimeValue, 0);
  const totalVal = totalBase + totalOtVal;

  return (
    <div className="overflow-x-auto">
      <table className="sal-table w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
            <th className="px-4 py-2.5 text-left font-semibold">Employee</th>
            <th className="px-3 py-2.5 text-left font-semibold">Department</th>
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
          {employees.map((e) => (
            <tr key={e.employeeId} className="hover:bg-gray-50">
              <td className="px-4 py-2">
                <div className="font-medium text-gray-800">{e.employeeName}</div>
                <div className="text-xs text-gray-400 font-mono">{e.employeeId}</div>
              </td>
              <td className="px-3 py-2 text-gray-600">{e.department}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                {e.workingHours > 0 ? e.workingHours : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                {e.baseValue > 0 ? fmt(e.baseValue, 2) : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                {e.overtimeHours > 0 ? e.overtimeHours : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-3 py-2 text-center text-amber-700 font-mono text-xs">
                {e.overtimeHours > 0 ? fmtRate(e.overtimeRate) : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                {e.overtimeValue > 0 ? fmt(e.overtimeValue, 2) : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-slate-700">
                {fmt(e.totalValue, 2)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-slate-700 text-sm">
            <td className="px-4 py-2.5" colSpan={2}>
              TOTAL
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums">
              {employees.reduce((s, e) => s + e.workingHours, 0)}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
              {fmt(totalBase, 2)}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums">
              {employees.reduce((s, e) => s + e.overtimeHours, 0) || '—'}
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

function VarianceCell({ value }: { value: number }) {
  const matched = Math.abs(value) <= 0.5;
  return (
    <span
      className={`tabular-nums font-medium ${
        matched ? 'text-emerald-600' : value > 0 ? 'text-amber-700' : 'text-red-600'
      }`}
    >
      {matched ? '✓' : fmt(value, 2)}
    </span>
  );
}

function OverallSummaryPage({
  summary,
  periodLabel,
  filterLabel,
  printColorStyle,
}: {
  summary: SalaryReconciliationSummary;
  periodLabel: string;
  filterLabel: string;
  printColorStyle: React.CSSProperties;
}) {
  return (
    <div className="sal-card sal-page-break bg-white rounded-lg shadow mt-6 overflow-hidden">
      <div
        className="sal-hdr bg-gradient-to-r from-indigo-900 to-indigo-800 text-white px-6 py-4"
        style={printColorStyle}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div>
            <h2 className="text-xl font-bold tracking-wide leading-tight">Overall Summary</h2>
            <div className="text-indigo-200 text-sm mt-1">
              {filterLabel} · {summary.employeeCount} employee
              {summary.employeeCount !== 1 ? 's' : ''} · {summary.projectCount} project
              {summary.projectCount !== 1 ? 's' : ''}
            </div>
          </div>
          <div className="text-right text-indigo-200 text-sm">
            <div className="text-white font-semibold text-base">{periodLabel}</div>
            <div>{summary.periodDays} days in period</div>
          </div>
        </div>
      </div>

      <div className="sal-summary border-b" style={printColorStyle}>
        <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-gray-100 border-b border-gray-100">
          <StatCell label="Total Salary" value={fmt(summary.grandTotalSalary)} color="text-indigo-700" />
          <StatCell
            label="Project Cost"
            value={fmt(summary.grandProjectCost, 2)}
            color="text-emerald-700"
          />
          <StatCell
            label="Variance"
            value={summary.isMatched ? '✓ Matched' : fmt(summary.grandVariance, 2)}
            color={summary.isMatched ? 'text-emerald-600' : 'text-amber-700'}
          />
          <StatCell
            label="Base Salary"
            value={fmt(summary.grandBaseSalary, 2)}
            color="text-emerald-700"
          />
          <StatCell
            label="Overtime"
            value={fmt(summary.grandOvertime, 2)}
            color="text-amber-700"
          />
          <StatCell
            label="Employees"
            value={summary.employeeCount}
            color="text-slate-600"
          />
        </div>
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          <StatCell
            label="Project Base"
            value={fmt(summary.grandProjectBase, 2)}
            color="text-emerald-700"
          />
          <StatCell
            label="Project OT"
            value={fmt(summary.grandProjectOvertime, 2)}
            color="text-amber-700"
          />
          <StatCell
            label="Projects"
            value={summary.projectCount}
            color="text-slate-600"
          />
        </div>
      </div>

      {!summary.isMatched && (
        <div className="px-6 py-3 bg-amber-50 border-b text-sm text-amber-800">
          Attendance salary total and project cost total differ by{' '}
          <strong>{fmt(Math.abs(summary.grandVariance), 2)}</strong>. Salary follows the same
          rules as the Attendance Report — fix missing or incorrect project hours in attendance
          (see Work Hrs vs Logged Hrs). Cost variance usually equals missing logged hours × hourly
          rate.
        </div>
      )}

      {summary.isMatched && (
        <div className="px-6 py-3 bg-emerald-50 border-b text-sm text-emerald-800">
          Attendance salary and project costs match for this period. All hours are allocated to
          projects.
        </div>
      )}

      <div className="px-4 pt-4 pb-1 bg-white">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Salary vs Project Cost — By Employee
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="sal-table w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-2.5 text-left font-semibold">Employee</th>
              <th className="px-3 py-2.5 text-right font-semibold">Base Salary</th>
              <th className="px-3 py-2.5 text-right font-semibold">Overtime</th>
              <th className="px-3 py-2.5 text-right font-semibold text-indigo-700">Total Salary</th>
              <th className="px-3 py-2.5 text-right font-semibold">Project Base</th>
              <th className="px-3 py-2.5 text-right font-semibold">Project OT</th>
              <th className="px-3 py-2.5 text-right font-semibold text-emerald-700">Project Total</th>
              <th className="px-3 py-2.5 text-right font-semibold">Work Hrs</th>
              <th className="px-3 py-2.5 text-right font-semibold">Logged Hrs</th>
              <th className="px-3 py-2.5 text-right font-semibold">Hrs Δ</th>
              <th className="px-3 py-2.5 text-center font-semibold">Cost Δ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {summary.employees.map((e) => (
              <tr key={e.employeeId} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <div className="font-medium text-gray-800">{e.employeeName}</div>
                  <div className="text-xs text-gray-400 font-mono">
                    {e.employeeId} · {e.department}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                  {fmt(e.baseSalary, 2)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                  {e.overtimeAmount > 0 ? fmt(e.overtimeAmount, 2) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-indigo-700">
                  {fmt(e.totalSalary)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                  {e.projectBaseCost > 0 ? fmt(e.projectBaseCost, 2) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                  {e.projectOvertimeCost > 0 ? fmt(e.projectOvertimeCost, 2) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-700">
                  {e.projectTotalCost > 0 ? fmt(e.projectTotalCost, 2) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {e.totalHours > 0 ? `${e.totalHours}h` : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                  {e.projectHours > 0 ? `${e.projectHours}h` : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {Math.abs(e.hoursVariance) <= 0.01 ? (
                    <span className="text-emerald-600">✓</span>
                  ) : (
                    <span className="text-amber-700 font-medium">{e.hoursVariance}h</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  <VarianceCell value={e.variance} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-slate-700 text-sm">
              <td className="px-4 py-2.5">TOTAL</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                {fmt(summary.grandBaseSalary, 2)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
                {fmt(summary.grandOvertime, 2)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-indigo-700">
                {fmt(summary.grandTotalSalary)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                {fmt(summary.grandProjectBase, 2)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
                {fmt(summary.grandProjectOvertime, 2)}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                {fmt(summary.grandProjectCost, 2)}
              </td>
              <td colSpan={2} />
              <td />
              <td className="px-3 py-2.5 text-center">
                <VarianceCell value={summary.grandVariance} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {summary.projects.length > 0 && (
        <div className="sal-page-break-before border-t">
          <div className="px-4 pt-4 pb-1 bg-white">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Project Cost Totals
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="sal-table w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-left font-semibold">Project</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Work Hrs</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Base Cost</th>
                  <th className="px-3 py-2.5 text-right font-semibold">OT Cost</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Total Cost</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.projects.map((p) => (
                  <tr key={p.projectName} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-800">{p.projectName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.totalWorkingHours}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">
                      {fmt(p.totalBaseValue, 2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-700">
                      {p.totalOvertimeValue > 0 ? fmt(p.totalOvertimeValue, 2) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold text-indigo-700">
                      {fmt(p.totalCost, 2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                      {summary.grandProjectCost > 0
                        ? `${((p.totalCost / summary.grandProjectCost) * 100).toFixed(1)}%`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-slate-700 text-sm">
                  <td className="px-4 py-2.5">TOTAL</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {summary.projects.reduce((s, p) => s + p.totalWorkingHours, 0)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                    {fmt(summary.grandProjectBase, 2)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
                    {fmt(summary.grandProjectOvertime, 2)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-indigo-700">
                    {fmt(summary.grandProjectCost, 2)}
                  </td>
                  <td className="px-3 py-2.5 text-right">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

type ViewMode = 'employee' | 'project';

// ── Main component ────────────────────────────────────────────────────────────

const ALL = '';

export function SalaryReportSection() {
  const { report, from: reportFrom, to: reportTo, loading, error, fetchReport } = useSalaryReport();

  const [payrollYearMonth, setPayrollYearMonth] = useState('');
  const [customRange, setCustomRange] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [department, setDepartment] = useState(ALL);
  const [employeeId, setEmployeeId] = useState(ALL);
  const [projectFilter, setProjectFilter] = useState(ALL);
  const [viewMode, setViewMode] = useState<ViewMode>('employee');
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<
    { employee_id: string; name: string; department: string }[]
  >([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [filtersLoading, setFiltersLoading] = useState(true);

  useEffect(() => {
    const current = getCurrentPayrollYearMonth();
    setPayrollYearMonth(current);
    const { from, to } = getPayrollPeriodBounds(current);
    setFromDate(from);
    setToDate(to);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setFiltersLoading(true);
      try {
        const [deptRes, empRes, projRes] = await Promise.all([
          fetchDepartmentsService(),
          fetchEmployeesService(),
          fetchProjectsService(),
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
          setProjects(
            projRes.map((p) => ({
              id: p.project_id,
              name: p.project_name,
            }))
          );
        }
      } catch {
        if (!cancelled) {
          setDepartments([]);
          setProjects([]);
        }
      } finally {
        if (!cancelled) setFiltersLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePayrollMonthChange = (value: string) => {
    setPayrollYearMonth(value);
    if (!customRange && value) {
      const { from, to } = getPayrollPeriodBounds(value);
      setFromDate(from);
      setToDate(to);
    }
  };

  const handleCustomRangeToggle = (checked: boolean) => {
    setCustomRange(checked);
    if (!checked && payrollYearMonth) {
      const { from, to } = getPayrollPeriodBounds(payrollYearMonth);
      setFromDate(from);
      setToDate(to);
    }
  };

  const employeesInDept =
    department === ALL
      ? employees
      : employees.filter(
          (e) => e.department.toLowerCase() === department.toLowerCase()
        );

  const handleGenerate = () => {
    if (!fromDate || !toDate) return;
    fetchReport(
      fromDate,
      toDate,
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
  const displayFrom = reportFrom || fromDate;
  const displayTo = reportTo || toDate;
  const periodLabel = formatPeriodLabel(displayFrom, displayTo);

  const projectReport = useMemo(
    () =>
      pivotSalaryReportByProject(
        report,
        projectFilter === ALL ? null : projectFilter
      ),
    [report, projectFilter]
  );

  const reconciliationSummary = useMemo(
    () => (report.length > 0 ? buildSalaryReconciliationSummary(report) : null),
    [report]
  );

  const filterLabel = [
    department !== ALL ? department : 'All Departments',
    employeeId !== ALL
      ? employees.find((e) => e.employee_id === employeeId)?.name ?? employeeId
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const printColorStyle = {
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  } as React.CSSProperties;

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
          .sal-page-break { page-break-after: always; break-after: page; margin: 0 !important; }
          .sal-page-break-before { page-break-before: always; break-before: page; }
          .sal-card { box-shadow: none !important; border: 1px solid #d1d5db; border-radius: 0 !important; margin-top: 0 !important; }
          .sal-hdr, .sal-summary { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .sal-sum-cell { padding: 4px 6px !important; }
          .sal-sum-val { font-size: 14pt !important; line-height: 1.1 !important; }
          .sal-sum-lbl { font-size: 6pt !important; }
          .sal-total-bar { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .sal-table { font-size: 8pt !important; }
          .sal-table th, .sal-table td { padding: 2px 5px !important; }
        }
      `}</style>

      {/* ── Controls ── */}
      <div className="bg-white rounded-lg shadow mt-6 no-print">
        <div className="p-5 border-b">
          <h2 className="text-xl font-semibold mb-1">Salary &amp; Project Cost Report</h2>
          <p className="text-xs text-gray-400 mb-4">
            Uses the same payroll rules as the Attendance Report. Project variance highlights rows
            to fix in attendance.
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Payroll month</label>
              <input
                type="month"
                value={payrollYearMonth}
                onChange={(e) => handlePayrollMonthChange(e.target.value)}
                disabled={customRange}
                className="w-full p-2 border rounded disabled:bg-gray-50 disabled:text-gray-500"
              />
              {!customRange && payrollYearMonth && (
                <p className="text-xs text-gray-400 mt-1">
                  {payrollMonthLabel(payrollYearMonth)}: {fromDate} → {toDate}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Report view</label>
              <div className="flex rounded border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('employee')}
                  className={`flex-1 px-3 py-2 text-sm font-medium ${
                    viewMode === 'employee'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  By Employee
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('project')}
                  className={`flex-1 px-3 py-2 text-sm font-medium border-l ${
                    viewMode === 'project'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  By Project
                </button>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={customRange}
                onChange={(e) => handleCustomRangeToggle(e.target.checked)}
                className="rounded"
              />
              Custom date range
            </label>
          </div>

          {customRange && (
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
          )}

          {viewMode === 'project' && (
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Project</label>
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="w-full sm:w-80 p-2 border rounded"
              >
                <option value={ALL}>All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
                <option value="Office/Other">Office/Other</option>
              </select>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading || !fromDate || !toDate}
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

          <PayrollReportDeliveryPanel
            reportKind="salary"
            hasReport={hasReport}
            disabled={loading}
            from={displayFrom}
            to={displayTo}
            department={department === ALL ? null : department}
            employeeId={employeeId === ALL ? null : employeeId}
            viewMode={viewMode}
            filterLabel={filterLabel}
            reconciliationSummary={reconciliationSummary}
          />
        </div>
      </div>

      {/* ── Printable area ── */}
      <div id="salary-print-area">
        {hasReport && reconciliationSummary && (
          <OverallSummaryPage
            summary={reconciliationSummary}
            periodLabel={periodLabel}
            filterLabel={filterLabel}
            printColorStyle={printColorStyle}
          />
        )}

        {viewMode === 'employee' &&
          report.map((empReport: SalaryReportEmployee) => {
            const {
              employee,
              periodDays,
              monthDays,
              totalMonthHours,
              hourlyRate,
              workedDays,
              totalHours,
              awoDeductions,
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
                <div
                  className="sal-hdr bg-gradient-to-r from-indigo-900 to-indigo-700 text-white px-6 py-4"
                  style={printColorStyle}
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
                      <div className="text-white font-semibold text-lg">{periodLabel}</div>
                      <div>{periodDays} days in period</div>
                    </div>
                  </div>
                </div>

                <div className="sal-summary border-b" style={printColorStyle}>
                  <div className="grid grid-cols-4 divide-x divide-gray-100 border-b border-gray-100">
                    <StatCell label="Period Days" value={periodDays} color="text-slate-600" />
                    <StatCell
                      label="Month Days"
                      value={monthDays}
                      color="text-slate-600"
                      sub={`rate ÷ ${totalMonthHours}h`}
                    />
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
                  <div className="grid grid-cols-4 divide-x divide-gray-100">
                    <StatCell
                      label="Worked Days"
                      value={workedDays}
                      color="text-emerald-600"
                      sub="Present + Holiday"
                    />
                    <StatCell
                      label="Work Hrs"
                      value={`${totalHours}h`}
                      color="text-emerald-700"
                    />
                    <StatCell
                      label="AWO Days"
                      value={awoDeductions}
                      color={awoDeductions > 0 ? 'text-red-600' : 'text-gray-300'}
                    />
                    <StatCell
                      label="Base Salary"
                      value={fmt(baseSalary, 2)}
                      color="text-emerald-700"
                    />
                  </div>
                </div>

                <div
                  className="sal-total-bar flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-slate-50 border-b"
                  style={printColorStyle}
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

                {projects.length > 0 ? (
                  <>
                    <div className="px-4 pt-3 pb-1 bg-white">
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Project Cost Breakdown
                      </h3>
                    </div>
                    <ProjectTable projects={projects} />
                  </>
                ) : (
                  <div className="px-6 py-3 text-xs text-gray-400 italic">
                    No project tracking data for this period.
                  </div>
                )}
              </div>
            );
          })}

        {viewMode === 'project' &&
          projectReport.map((projReport: ProjectCostReport) => (
            <div
              key={projReport.projectName}
              className="sal-card sal-page-break bg-white rounded-lg shadow mt-6 overflow-hidden"
            >
              <div
                className="sal-hdr bg-gradient-to-r from-emerald-900 to-emerald-700 text-white px-6 py-4"
                style={printColorStyle}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div>
                    <h2 className="text-xl font-bold tracking-wide leading-tight">
                      {projReport.projectName}
                    </h2>
                    <div className="text-sm text-emerald-200 mt-1">
                      {projReport.employees.length} employee
                      {projReport.employees.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="text-right text-emerald-200 text-sm">
                    <div className="text-white font-semibold text-lg">{periodLabel}</div>
                    <div>{projReport.totalWorkingHours} work hours logged</div>
                  </div>
                </div>
              </div>

              <div className="sal-summary border-b" style={printColorStyle}>
                <div className="grid grid-cols-4 divide-x divide-gray-100">
                  <StatCell
                    label="Work Hours"
                    value={projReport.totalWorkingHours}
                    color="text-slate-600"
                  />
                  <StatCell
                    label="Base Cost"
                    value={fmt(projReport.totalBaseValue, 2)}
                    color="text-emerald-700"
                  />
                  <StatCell
                    label="OT Cost"
                    value={
                      projReport.totalOvertimeValue > 0
                        ? fmt(projReport.totalOvertimeValue, 2)
                        : '—'
                    }
                    color="text-amber-700"
                  />
                  <StatCell
                    label="Total Cost"
                    value={fmt(projReport.totalCost, 2)}
                    color="text-indigo-700"
                  />
                </div>
              </div>

              <div className="px-4 pt-3 pb-1 bg-white">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Employee Cost Breakdown
                </h3>
              </div>
              <EmployeeCostTable employees={projReport.employees} />
            </div>
          ))}
      </div>

      {!loading && report.length === 0 && !error && fromDate && toDate && (
        <p className="mt-6 p-4 text-center text-gray-500 no-print">
          No salary data found. Generate the report first.
        </p>
      )}

      {!loading &&
        viewMode === 'project' &&
        report.length > 0 &&
        projectReport.length === 0 &&
        !error && (
          <p className="mt-6 p-4 text-center text-gray-500 no-print">
            No project cost data for the selected filters.
          </p>
        )}
    </>
  );
}
