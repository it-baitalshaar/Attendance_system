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
import { buildBaitalshaarReportBasename } from '@/lib/reportPdf/baitalshaarReportFilename';
import { PayrollReportDeliveryPanel } from './PayrollReportDeliveryPanel';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

const COST_MATCH_TOLERANCE = 0.5;
const HOURS_MATCH_TOLERANCE = 0.01;

function isEmployeeMismatch(e: {
  hoursVariance: number;
  variance: number;
}): boolean {
  return (
    Math.abs(e.hoursVariance) > HOURS_MATCH_TOLERANCE ||
    Math.abs(e.variance) > COST_MATCH_TOLERANCE
  );
}

function varianceReasonLabel(e: {
  varianceReason: string;
  sickLeaveExplainedHours: number;
  sickLeaveDays: number;
  unexplainedHours: number;
}): string | null {
  switch (e.varianceReason) {
    case 'sick_leave':
      return e.sickLeaveDays > 0
        ? `Sick Leave (${e.sickLeaveExplainedHours}h · ${e.sickLeaveDays}d)`
        : `Sick Leave (${e.sickLeaveExplainedHours}h)`;
    case 'mixed':
      return `SL ${e.sickLeaveExplainedHours}h + missing ${e.unexplainedHours}h`;
    case 'missing_project_hours':
      return `Missing project hours (${e.unexplainedHours}h)`;
    case 'rounding':
      return 'Rounding';
    default:
      return null;
  }
}

function OtHoursCell({ n, color = 'text-gray-600' }: { n: number; color?: string }) {
  if (n <= 0) return <span className="text-gray-300">—</span>;
  return <span className={`tabular-nums ${color}`}>{n}</span>;
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
  const totalOtNormal = projects.reduce((s, p) => s + p.otNormal, 0);
  const totalOtHoliday = projects.reduce((s, p) => s + p.otHoliday, 0);
  const totalOtPublic = projects.reduce((s, p) => s + p.otPublicHoliday, 0);

  return (
    <div className="sal-scroll overflow-x-auto print:overflow-visible">
      <table className="sal-table w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
            <th className="px-4 py-2.5 text-left font-semibold">Project</th>
            <th className="px-3 py-2.5 text-right font-semibold">Work Hrs</th>
            <th className="px-3 py-2.5 text-right font-semibold">
              <span dir="rtl">قيمة الأيام</span>
            </th>
            <th className="px-3 py-2.5 text-right font-semibold">OT Hrs</th>
            <th className="px-3 py-2.5 text-right font-semibold text-amber-600">OT ×1.25</th>
            <th className="px-3 py-2.5 text-right font-semibold text-amber-600">W.OT ×1.5</th>
            <th className="px-3 py-2.5 text-right font-semibold text-amber-600">H.OT ×2.5</th>
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
              <td className="px-3 py-2 text-right">
                <OtHoursCell n={p.overtimeHours} />
              </td>
              <td className="px-3 py-2 text-right">
                <OtHoursCell n={p.otNormal} color="text-amber-700" />
              </td>
              <td className="px-3 py-2 text-right">
                <OtHoursCell n={p.otHoliday} color="text-amber-700" />
              </td>
              <td className="px-3 py-2 text-right">
                <OtHoursCell n={p.otPublicHoliday} color="text-amber-700" />
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
            <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
              {totalOtNormal > 0 ? totalOtNormal : '—'}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
              {totalOtHoliday > 0 ? totalOtHoliday : '—'}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
              {totalOtPublic > 0 ? totalOtPublic : '—'}
            </td>
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
  const totalOtNormal = employees.reduce((s, e) => s + e.otNormal, 0);
  const totalOtHoliday = employees.reduce((s, e) => s + e.otHoliday, 0);
  const totalOtPublic = employees.reduce((s, e) => s + e.otPublicHoliday, 0);

  return (
    <div className="sal-scroll overflow-x-auto print:overflow-visible">
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
            <th className="px-3 py-2.5 text-right font-semibold text-amber-600">OT ×1.25</th>
            <th className="px-3 py-2.5 text-right font-semibold text-amber-600">W.OT ×1.5</th>
            <th className="px-3 py-2.5 text-right font-semibold text-amber-600">H.OT ×2.5</th>
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
              <td className="px-3 py-2 text-right">
                <OtHoursCell n={e.overtimeHours} />
              </td>
              <td className="px-3 py-2 text-right">
                <OtHoursCell n={e.otNormal} color="text-amber-700" />
              </td>
              <td className="px-3 py-2 text-right">
                <OtHoursCell n={e.otHoliday} color="text-amber-700" />
              </td>
              <td className="px-3 py-2 text-right">
                <OtHoursCell n={e.otPublicHoliday} color="text-amber-700" />
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
            <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
              {totalOtNormal > 0 ? totalOtNormal : '—'}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
              {totalOtHoliday > 0 ? totalOtHoliday : '—'}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
              {totalOtPublic > 0 ? totalOtPublic : '—'}
            </td>
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
  const matched = Math.abs(value) <= COST_MATCH_TOLERANCE;
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
  const [showMismatchesOnly, setShowMismatchesOnly] = useState(!summary.isMatched);

  const mismatchedEmployees = useMemo(
    () => summary.employees.filter(isEmployeeMismatch),
    [summary.employees]
  );

  const sortedEmployees = useMemo(() => {
    const list = showMismatchesOnly ? mismatchedEmployees : summary.employees;
    return [...list].sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  }, [summary.employees, mismatchedEmployees, showMismatchesOnly]);

  const topMismatch = mismatchedEmployees.reduce<(typeof mismatchedEmployees)[0] | null>(
    (best, e) =>
      !best || Math.abs(e.variance) > Math.abs(best.variance) ? e : best,
    null
  );

  const sickLeaveEmployees = useMemo(
    () =>
      summary.employees
        .filter((e) => e.sickLeaveExplainedHours > HOURS_MATCH_TOLERANCE)
        .sort((a, b) => b.sickLeaveExplainedHours - a.sickLeaveExplainedHours),
    [summary.employees]
  );

  const scrollToEmployee = (employeeId: string) => {
    const el = document.getElementById(`sal-emp-${employeeId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const renderSickLeaveEmployeeLinks = () => {
    if (sickLeaveEmployees.length === 0) return null;
    return (
      <>
        {' '}
        from{' '}
        {sickLeaveEmployees.map((e, i) => (
          <span key={e.employeeId}>
            {i > 0 && (i === sickLeaveEmployees.length - 1 ? ' and ' : ', ')}
            <button
              type="button"
              onClick={() => scrollToEmployee(e.employeeId)}
              className="underline font-semibold hover:opacity-80 no-print font-mono"
            >
              {e.employeeId}
            </button>
            <span className="hidden print:inline font-mono font-semibold">{e.employeeId}</span>
            <span className="opacity-80">
              {' '}
              ({e.sickLeaveExplainedHours}h
              {e.sickLeaveDays > 0 ? ` · ${e.sickLeaveDays}d` : ''})
            </span>
          </span>
        ))}
      </>
    );
  };

  return (
    <div className="sal-card sal-page-break sal-overall-summary bg-white rounded-lg shadow mt-6 overflow-hidden">
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

      {!summary.isMatched && summary.isExplained && (
        <div className="px-6 py-3 bg-sky-50 border-b text-sm text-sky-900">
          Attendance salary and project cost differ by{' '}
          <strong>{fmt(Math.abs(summary.grandVariance), 2)}</strong>
          {summary.grandSickLeaveExplainedHours > 0 && (
            <>
              {' '}
              — explained by <strong>Sick Leave</strong> pay (
              {summary.grandSickLeaveExplainedHours}h)
              {renderSickLeaveEmployeeLinks()}
              , which is paid in salary but not charged to projects. No attendance fix needed.
              Click an ID to open that employee’s card.
            </>
          )}
          {summary.grandSickLeaveExplainedHours <= 0 && (
            <> — within rounding tolerance for project hours. No attendance fix needed.</>
          )}
        </div>
      )}

      {!summary.isMatched && !summary.isExplained && (
        <div className="px-6 py-3 bg-amber-50 border-b text-sm text-amber-800">
          Attendance salary total and project cost total differ by{' '}
          <strong>{fmt(Math.abs(summary.grandVariance), 2)}</strong>
          {mismatchedEmployees.length > 0 && (
            <>
              {' '}
              — <strong>{mismatchedEmployees.length}</strong> employee
              {mismatchedEmployees.length !== 1 ? 's' : ''} with Hrs Δ / Cost Δ
              {topMismatch && (
                <>
                  {' '}
                  (largest:{' '}
                  <button
                    type="button"
                    onClick={() => scrollToEmployee(topMismatch.employeeId)}
                    className="underline font-semibold hover:text-amber-950 no-print font-mono"
                  >
                    {topMismatch.employeeId}
                  </button>
                  <span className="hidden print:inline font-mono font-semibold">
                    {topMismatch.employeeId}
                  </span>
                  , {topMismatch.hoursVariance}h / {fmt(topMismatch.variance, 2)}
                  {topMismatch.varianceReason === 'sick_leave' ||
                  topMismatch.varianceReason === 'mixed'
                    ? ` · ${varianceReasonLabel(topMismatch)}`
                    : ''}
                  )
                </>
              )}
            </>
          )}
          {summary.grandSickLeaveExplainedHours > 0 && (
            <>
              {' '}
              Part of the gap is <strong>Sick Leave</strong> (
              {summary.grandSickLeaveExplainedHours}h paid, not on projects)
              {renderSickLeaveEmployeeLinks()}
              {summary.grandUnexplainedHours > 0 && (
                <>
                  ; remaining unexplained{' '}
                  <strong>{summary.grandUnexplainedHours}h</strong> needs project hours fixed in
                  the Attendance Report
                </>
              )}
              .
            </>
          )}
          {summary.grandSickLeaveExplainedHours <= 0 && (
            <>
              . Fix missing or incorrect project hours in the Attendance Report (Work Hrs vs Logged
              Hrs). Click a mismatched employee to jump to their card.
            </>
          )}
        </div>
      )}

      {summary.isMatched && (
        <div className="px-6 py-3 bg-emerald-50 border-b text-sm text-emerald-800">
          Attendance salary and project costs match for this period. All hours are allocated to
          projects.
        </div>
      )}

      <div className="px-4 pt-4 pb-1 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Salary vs Project Cost — By Employee
        </h3>
        <label className="no-print flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showMismatchesOnly}
            onChange={(e) => setShowMismatchesOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          Show mismatches only
          {mismatchedEmployees.length > 0 && (
            <span className="text-amber-700 font-medium">({mismatchedEmployees.length})</span>
          )}
        </label>
      </div>
      <div className="sal-scroll overflow-x-auto print:overflow-visible">
        <table className="sal-table sal-recon-table w-full text-xs sm:text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b text-[10px] sm:text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-2 py-2 text-left font-semibold">Employee</th>
              <th className="px-2 py-2 text-right font-semibold">Base</th>
              <th className="px-2 py-2 text-right font-semibold">OT</th>
              <th className="px-2 py-2 text-right font-semibold text-indigo-700">Total</th>
              <th className="px-2 py-2 text-right font-semibold">P.Base</th>
              <th className="px-2 py-2 text-right font-semibold">P.OT</th>
              <th className="px-2 py-2 text-right font-semibold text-emerald-700">P.Total</th>
              <th className="px-2 py-2 text-right font-semibold">Work</th>
              <th className="px-2 py-2 text-right font-semibold">Logged</th>
              <th className="px-2 py-2 text-right font-semibold">Hrs Δ</th>
              <th className="px-2 py-2 text-center font-semibold">Cost Δ / Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedEmployees.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-6 text-center text-sm text-gray-500">
                  {showMismatchesOnly
                    ? 'No mismatches — all employees match within tolerance.'
                    : 'No employees in this report.'}
                </td>
              </tr>
            ) : (
              sortedEmployees.map((e) => {
                const mismatch = isEmployeeMismatch(e);
                const reason = varianceReasonLabel(e);
                const rowTone =
                  e.varianceReason === 'sick_leave'
                    ? 'bg-sky-50/80 hover:bg-sky-50'
                    : mismatch
                      ? 'bg-amber-50/80 hover:bg-amber-50'
                      : 'hover:bg-gray-50';
                return (
                  <tr key={e.employeeId} className={rowTone}>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => scrollToEmployee(e.employeeId)}
                        className="text-left group no-print"
                      >
                        <div className="font-medium text-gray-800 group-hover:text-indigo-700 group-hover:underline">
                          {e.employeeName}
                        </div>
                        <div className="text-xs text-gray-400 font-mono">
                          {e.employeeId} · {e.department}
                        </div>
                      </button>
                      <div className="hidden print:block">
                        <div className="font-medium text-gray-800">{e.employeeName}</div>
                        <div className="text-xs text-gray-400 font-mono">
                          {e.employeeId} · {e.department}
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">
                      {fmt(e.baseSalary, 2)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-amber-700">
                      {e.overtimeAmount > 0 ? fmt(e.overtimeAmount, 2) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-indigo-700">
                      {fmt(e.totalSalary)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">
                      {e.projectBaseCost > 0 ? fmt(e.projectBaseCost, 2) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-amber-700">
                      {e.projectOvertimeCost > 0 ? fmt(e.projectOvertimeCost, 2) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums font-semibold text-emerald-700">
                      {e.projectTotalCost > 0 ? fmt(e.projectTotalCost, 2) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gray-600">
                      {e.totalHours > 0 ? `${e.totalHours}h` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gray-600">
                      {e.projectHours > 0 ? `${e.projectHours}h` : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {Math.abs(e.hoursVariance) <= HOURS_MATCH_TOLERANCE ? (
                        <span className="text-emerald-600">✓</span>
                      ) : (
                        <span
                          className={`font-medium ${
                            e.varianceReason === 'sick_leave'
                              ? 'text-sky-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {e.hoursVariance}h
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <div>
                        <VarianceCell value={e.variance} />
                      </div>
                      {reason ? (
                        <div
                          className={`mt-0.5 text-[10px] leading-tight ${
                            e.varianceReason === 'sick_leave'
                              ? 'text-sky-800 font-medium'
                              : e.varianceReason === 'missing_project_hours' ||
                                  e.varianceReason === 'mixed'
                                ? 'text-amber-800 font-medium'
                                : 'text-gray-500'
                          }`}
                        >
                          {reason}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-slate-700 text-sm">
              <td className="px-2 py-2">TOTAL</td>
              <td className="px-2 py-2 text-right tabular-nums text-emerald-700">
                {fmt(summary.grandBaseSalary, 2)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-amber-700">
                {fmt(summary.grandOvertime, 2)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-indigo-700">
                {fmt(summary.grandTotalSalary)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-emerald-700">
                {fmt(summary.grandProjectBase, 2)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-amber-700">
                {fmt(summary.grandProjectOvertime, 2)}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-emerald-700">
                {fmt(summary.grandProjectCost, 2)}
              </td>
              <td colSpan={2} />
              <td />
              <td className="px-2 py-2 text-center">
                <div>
                  <VarianceCell value={summary.grandVariance} />
                </div>
                {summary.grandSickLeaveExplainedHours > 0 && (
                  <div className="mt-0.5 text-[10px] font-normal text-sky-800">
                    SL {summary.grandSickLeaveExplainedHours}h
                  </div>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {summary.projects.length > 0 && (
        <div className="sal-project-totals border-t">
          <div className="px-4 pt-4 pb-1 bg-white">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Project Cost Totals
            </h3>
          </div>
          <div className="sal-scroll overflow-x-auto print:overflow-visible">
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

  const hasReport = report.length > 0;
  const displayFrom = reportFrom || fromDate;
  const displayTo = reportTo || toDate;
  const periodLabel = formatPeriodLabel(displayFrom, displayTo);

  const handlePrint = () => {
    const prevTitle = document.title;
    document.title = buildBaitalshaarReportBasename({
      department: department === ALL ? null : department,
      from: displayFrom,
      to: displayTo,
    });
    document.body.classList.add('print-salary');
    let restored = false;
    const restore = () => {
      if (restored) return;
      restored = true;
      document.body.classList.remove('print-salary');
      document.title = prevTitle;
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    window.print();
    window.setTimeout(restore, 60_000);
  };

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
          @page { size: A4 landscape; margin: 6mm 8mm; }
          .sal-page-break { page-break-after: always; break-after: page; margin: 0 !important; }
          .sal-page-break-before { page-break-before: always; break-before: page; }
          .sal-card { box-shadow: none !important; border: 1px solid #d1d5db; border-radius: 0 !important; margin-top: 0 !important; overflow: visible !important; }
          .sal-hdr, .sal-summary { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .sal-sum-cell { padding: 2px 3px !important; }
          .sal-sum-val { font-size: 10pt !important; line-height: 1.05 !important; }
          .sal-sum-lbl { font-size: 5pt !important; }
          .sal-total-bar { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .sal-scroll {
            overflow: visible !important;
            max-width: 100% !important;
          }
          .sal-table {
            font-size: 6.5pt !important;
            width: 100% !important;
            table-layout: fixed !important;
          }
          .sal-table th, .sal-table td {
            padding: 1px 2px !important;
            word-wrap: break-word;
            overflow-wrap: anywhere;
          }
          .sal-recon-table { font-size: 6pt !important; }
          .sal-recon-table th { font-size: 5pt !important; }
          /* Keep Overall Summary + Project Cost Totals on one landscape page */
          .sal-overall-summary .sal-hdr { padding: 6px 10px !important; }
          .sal-overall-summary .sal-hdr h2 { font-size: 12pt !important; }
          .sal-overall-summary .sal-hdr .text-sm { font-size: 7pt !important; }
          .sal-overall-summary .sal-hdr .text-base { font-size: 9pt !important; }
          .sal-overall-summary .px-6.py-3 { padding: 4px 10px !important; font-size: 7pt !important; }
          .sal-overall-summary .px-4.pt-4 { padding-top: 4px !important; padding-left: 8px !important; padding-right: 8px !important; }
          .sal-project-totals { page-break-before: avoid !important; break-before: avoid !important; }
          .sal-project-totals h3 { margin: 0 !important; padding-top: 2px !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* ── Controls ── */}
      <div className="bg-white rounded-lg shadow mt-6 no-print">
        <div className="p-5 border-b">
          <h2 className="text-xl font-semibold mb-1">Salary &amp; Project Cost Report</h2>
          <p className="text-xs text-gray-400 mb-4">
            Uses the same payroll rules as the Attendance Report. Overall Summary lists Cost Δ /
            Hrs Δ with a Reason (e.g. Sick Leave vs missing project hours). OT shows ×1.25 / ×1.5 /
            ×2.5 separately.
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
            key={`${periodLabel}-${reconciliationSummary.grandVariance}-${reconciliationSummary.employeeCount}`}
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
              sickLeaveHours,
              sickLeaveDays,
              projects,
            } = empReport;

            const loggedProjectHours = projects.reduce((s, p) => s + p.workingHours, 0);
            const hoursGap = totalHours - loggedProjectHours;

            return (
              <div
                key={employee.id}
                id={`sal-emp-${employee.id}`}
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
                    {hoursGap > HOURS_MATCH_TOLERANCE &&
                      sickLeaveHours > 0 &&
                      Math.abs(hoursGap - sickLeaveHours) <= HOURS_MATCH_TOLERANCE && (
                        <div className="mx-4 mb-2 px-3 py-2 rounded bg-sky-50 border border-sky-100 text-sm text-sky-900">
                          Work Hrs ({totalHours}h) exceed logged project hours ({loggedProjectHours}h)
                          by <strong>{hoursGap}h</strong> because of{' '}
                          <strong>
                            Sick Leave
                            {sickLeaveDays > 0 ? ` (${sickLeaveDays} day${sickLeaveDays !== 1 ? 's' : ''})` : ''}
                          </strong>
                          — paid in salary, not charged to projects.
                        </div>
                      )}
                    {hoursGap > HOURS_MATCH_TOLERANCE &&
                      !(
                        sickLeaveHours > 0 &&
                        Math.abs(hoursGap - sickLeaveHours) <= HOURS_MATCH_TOLERANCE
                      ) && (
                        <div className="mx-4 mb-2 px-3 py-2 rounded bg-amber-50 border border-amber-100 text-sm text-amber-900">
                          Work Hrs ({totalHours}h) vs logged ({loggedProjectHours}h) — gap{' '}
                          <strong>{hoursGap}h</strong>
                          {sickLeaveHours > 0 && (
                            <>
                              {' '}
                              (of which <strong>{Math.min(hoursGap, sickLeaveHours)}h</strong> is
                              Sick Leave; remaining may need project hours fixed)
                            </>
                          )}
                          {sickLeaveHours <= 0 && <> — check attendance project rows.</>}
                        </div>
                      )}
                    <ProjectTable projects={projects} />
                  </>
                ) : (
                  <div className="px-6 py-3 text-xs text-gray-400 italic">
                    No project tracking data for this period.
                    {sickLeaveHours > 0 && (
                      <span className="block mt-1 text-sky-700 not-italic">
                        Sick Leave {sickLeaveHours}h is paid in salary but not charged to projects.
                      </span>
                    )}
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
