/**
 * Salary & Project Cost Report — pure computation, no DB access.
 *
 * Rates follow the payroll spec exactly:
 *   Present      → 1.25x
 *   Weekend      → 1.50x
 *   Holiday-Work → 1.50x
 *   Custom DB overtime_rate → used when present
 *
 * Base salary uses the 8-hour-per-day assumption:
 *   effectiveBaseHours = max(0, uniqueWorkedDays * 8 − awoUniqueDays * 8)
 *   baseSalary = effectiveBaseHours * hourlyRate
 *
 * Project cost uses actual logged hours from Attendance_projects.
 */

import type { SalaryReportEmployee, ProjectCostEntry } from '../types/salaryReport';
import type { RawAttendanceRow, RawEmployeeRow } from './attendanceReportService';
import { resolveProjectDisplayName } from '@/lib/projectDisplayName';

export interface RawSalaryProjectRow {
  attendance_id: string;
  project_id: string;
  working_hours: number;
  overtime_hours: number;
  overtime_type?: string | null;
  overtime_rate?: number | null; // custom DB rate; takes precedence when > 0
}

function getDaysInMonth(year: number, month: number): number {
  // month is 1-indexed; new Date(y, m, 0) gives last day of month m
  return new Date(year, month, 0).getDate();
}

function resolveOvertimeMultiplier(
  statusAttendance: string,
  overtimeType: string | null | undefined,
  customRate: number | null | undefined
): number {
  if (customRate != null && customRate > 0) return customRate;
  if (overtimeType === 'normal') return 1.25;
  if (overtimeType === 'holiday') return 1.5;
  if (overtimeType === 'public_holiday') return 1.5; // spec: holiday = 1.5x
  // Fall back to day status
  if (statusAttendance === 'Weekend') return 1.5;
  if (statusAttendance === 'Holiday-Work' || statusAttendance === 'Holiday') return 1.5;
  return 1.25; // Present or unrecognised → default
}

export function buildSalaryReport(input: {
  attRows: RawAttendanceRow[];
  attProjRows: RawSalaryProjectRow[];
  projectNameById: Map<string, string>;
  employees: RawEmployeeRow[];
  fromDate: string; // YYYY-MM-DD — month derived from this
}): SalaryReportEmployee[] {
  const { attRows, attProjRows, projectNameById, employees, fromDate } = input;

  const [yearStr, monthStr] = fromDate.split('-');
  const monthDays = getDaysInMonth(Number(yearStr), Number(monthStr));
  const totalMonthHours = monthDays * 8;

  const employeeMap = new Map<string, RawEmployeeRow>();
  employees.forEach((e) => employeeMap.set(e.employee_id, e));

  // attendance_id → effective status_attendance (respects notes-based override)
  const saByAttId = new Map<string, string>();
  attRows.forEach((att) => {
    const saRaw = att.status_attendance?.trim() ?? '';
    const notesOverride =
      (att.notes ?? '').match(/Attendance\s+type:\s*([\w-]+)/i)?.[1] ?? '';
    saByAttId.set(att.id, notesOverride || saRaw);
  });

  // Group project rows by attendance_id
  const projByAttId = new Map<string, RawSalaryProjectRow[]>();
  attProjRows.forEach((p) => {
    const list = projByAttId.get(p.attendance_id) ?? [];
    list.push(p);
    projByAttId.set(p.attendance_id, list);
  });

  // Group attendance rows by employee_id
  const attByEmpId = new Map<string, RawAttendanceRow[]>();
  attRows.forEach((att) => {
    const list = attByEmpId.get(att.employee_id) ?? [];
    list.push(att);
    attByEmpId.set(att.employee_id, list);
  });

  const employeeIds = Array.from(new Set(attRows.map((r) => r.employee_id))).sort();
  const result: SalaryReportEmployee[] = [];

  for (const empId of employeeIds) {
    const emp = employeeMap.get(empId);
    const salary = emp?.salary ?? 0;
    const hourlyRate =
      salary > 0 && totalMonthHours > 0 ? salary / totalMonthHours : 0;

    const empAttRows = attByEmpId.get(empId) ?? [];

    // Deduplicate by date — first row per date carries the status for AWO check
    const dateFirstAtt = new Map<string, RawAttendanceRow>();
    empAttRows.forEach((att) => {
      if (!dateFirstAtt.has(att.date)) dateFirstAtt.set(att.date, att);
    });

    const workedDays = dateFirstAtt.size;

    // AWO: count unique dates with status_attendance === 'Absence without excuse'
    let awoDeductions = 0;
    dateFirstAtt.forEach((att) => {
      if ((saByAttId.get(att.id) ?? '') === 'Absence without excuse') awoDeductions++;
    });

    const effectiveBaseHours = Math.max(0, workedDays * 8 - awoDeductions * 8);
    const baseSalary = effectiveBaseHours * hourlyRate;

    // Per-project cost aggregation
    type ProjAccum = { workingHours: number; otEntries: { hours: number; rate: number }[] };
    const projectMap = new Map<string, ProjAccum>();

    for (const att of empAttRows) {
      const sa = saByAttId.get(att.id) ?? '';
      const projRows = projByAttId.get(att.id) ?? [];

      for (const proj of projRows) {
        const rawName = resolveProjectDisplayName(proj.project_id, projectNameById);
        const projectName =
          !rawName || rawName === 'Unknown' ? 'Office/Other' : rawName;

        const wh = Number(proj.working_hours ?? 0);
        const oth = Number(proj.overtime_hours ?? 0);
        const rate = resolveOvertimeMultiplier(
          sa,
          proj.overtime_type,
          proj.overtime_rate ?? null
        );

        const existing = projectMap.get(projectName);
        if (existing) {
          existing.workingHours += wh;
          if (oth > 0) existing.otEntries.push({ hours: oth, rate });
        } else {
          projectMap.set(projectName, {
            workingHours: wh,
            otEntries: oth > 0 ? [{ hours: oth, rate }] : [],
          });
        }
      }
    }

    let overtimeAmount = 0;
    const projects: ProjectCostEntry[] = [];

    for (const [projectName, data] of Array.from(projectMap.entries())) {
      const baseValue = data.workingHours * hourlyRate;

      // Aggregate OT by rate bucket, then sum values
      const otByRate = new Map<number, number>();
      data.otEntries.forEach((e) => {
        otByRate.set(e.rate, (otByRate.get(e.rate) ?? 0) + e.hours);
      });

      let totalOtHours = 0;
      let totalOtValue = 0;
      otByRate.forEach((hours, rate) => {
        totalOtHours += hours;
        totalOtValue += hours * rate * hourlyRate;
      });
      overtimeAmount += totalOtValue;

      // Effective display rate: single-rate → show it; mixed → show computed average
      const effectiveRate =
        totalOtHours > 0
          ? otByRate.size === 1
            ? Array.from(otByRate.keys())[0]
            : totalOtValue / (totalOtHours * (hourlyRate || 1))
          : 0;

      projects.push({
        projectName,
        workingHours: data.workingHours,
        baseValue,
        overtimeHours: totalOtHours,
        overtimeRate: effectiveRate,
        overtimeValue: totalOtValue,
      });
    }

    projects.sort((a, b) => a.projectName.localeCompare(b.projectName));

    const totalSalary = Math.round(baseSalary + overtimeAmount);

    result.push({
      employee: {
        id: empId,
        name: emp?.name ?? 'Unknown',
        department: emp?.department ?? '—',
        salary: emp?.salary ?? null,
      },
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
    });
  }

  result.sort((a, b) => {
    const dA = (a.employee.department ?? '').toLowerCase();
    const dB = (b.employee.department ?? '').toLowerCase();
    if (dA !== dB) return dA.localeCompare(dB);
    return (a.employee.name ?? '')
      .toLowerCase()
      .localeCompare((b.employee.name ?? '').toLowerCase());
  });

  return result;
}
