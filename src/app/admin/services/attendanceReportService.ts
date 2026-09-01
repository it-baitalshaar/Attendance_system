/**
 * Attendance Report — read-only aggregation from existing tables.
 * No DB schema changes. Uses: Attendance, Attendance_projects, projects, Employee.
 */

import type {
  AttendanceReportEmployeeReport,
  AttendanceReportDay,
} from '../types/attendanceReport';
import { dateOnly, statusToCode } from '../types/attendanceReport';
import { resolveProjectDisplayName } from '@/lib/projectDisplayName';
import { bucketOvertimeHours } from './payrollCalculation';
import { maxRegularHoursForStatus } from '@/app/lib/employeeRegularHours';
import {
  assignSickLeaveTiers,
  summarizeEmployeeSickLeave,
} from './sickLeaveLaw';
import type { LookbackWorkDay } from './inheritSickLeaveProjects';
import {
  allocateSickLeaveHours,
  formatSickLeaveProjectsText,
  hasLoggedProjects,
  latestLookbackProjects,
  mergeProjectParts,
} from './inheritSickLeaveProjects';

export interface RawAttendanceRow {
  id: string;
  employee_id: string;
  date: string;
  status: string | null;
  status_attendance: string | null;
  notes: string | null;
  /** Department at submission time; used for historical report filtering. */
  department?: string | null;
}

export interface RawAttendanceProjectRow {
  attendance_id: string;
  project_id: string;
  working_hours: number;
  overtime_hours: number;
  /** When set, drives payroll OT columns (normal / holiday / public_holiday). */
  overtime_type?: string | null;
}

export interface RawEmployeeRow {
  employee_id: string;
  name: string;
  department?: string | null;
  salary?: number | null;
  /** When false, regular hours capped at 8 (or half-day) and OT excluded from report. */
  overtime_enabled?: boolean | null;
}

export interface BuildReportInput {
  attRows: RawAttendanceRow[];
  attProjRows: RawAttendanceProjectRow[];
  projectNameById: Map<string, string>;
  employees: RawEmployeeRow[];
  /**
   * Sick leave dates before the report `from` date (same calendar year),
   * keyed by employee_id. Used so SL law ordinals continue across periods.
   * Optional — defaults to empty (treats period SL days as starting at ordinal 1).
   */
  priorSickLeaveDaysByEmployee?: Map<string, string[]>;
  /**
   * Work days with projects before the report `from` date, keyed by employee_id.
   * Used so an SL day at the start of the period can inherit the previous project's name.
   */
  lookbackWorkDaysByEmployee?: Map<string, LookbackWorkDay[]>;
}

/**
 * Builds the attendance report per spec:
 * - One row per employee per calendar day
 * - Sum hours and overtime per day
 * - Sick Leave: calendar-year law (1–15 → 8h, 16–45 → 4h, 46+ → 0h); see sickLeaveLaw.ts
 * - Overtime by payroll type from each project row (overtime_type), with legacy fallback from day status when type is missing
 * - Project text: "Name Xhrs + Name Yhrs", NULL → "Unknown"
 * - Sick Leave with no logged projects inherits the previous working day's project
 *   (charged to that project on salary/project reports)
 * - Sort by employee_id, date asc
 */
export function buildAttendanceReport(
  input: BuildReportInput
): AttendanceReportEmployeeReport[] {
  const {
    attRows,
    attProjRows,
    projectNameById,
    employees,
    priorSickLeaveDaysByEmployee = new Map(),
    lookbackWorkDaysByEmployee = new Map(),
  } = input;

  const attendanceById = new Map<string, RawAttendanceRow>();
  attRows.forEach((r) => attendanceById.set(r.id, r));

  const projectsByAttendanceId = new Map<string, RawAttendanceProjectRow[]>();
  attProjRows.forEach((r) => {
    const attId = String(r.attendance_id ?? '');
    const list = projectsByAttendanceId.get(attId) ?? [];
    list.push(r);
    projectsByAttendanceId.set(attId, list);
  });

  const employeeMap = new Map<string, RawEmployeeRow>();
  employees.forEach((e) => employeeMap.set(e.employee_id, e));

  // Group by employee_id + date (one day record per key)
  type Key = string;
  const key = (empId: string, d: string) => `${empId}|${dateOnly(d)}`;
  const dayDataByKey = new Map<
    Key,
    {
      status: string | null;
      status_attendance: string | null;
      notes: string | null;
      working_hours: number;
      overtime_normal: number;
      overtime_holiday: number;
      overtime_public_holiday: number;
      projectParts: { name: string; hours: number }[];
    }
  >();

  const addOvertimeToBuckets = (
    projRows: RawAttendanceProjectRow[],
    sa: string
  ) => {
    const b = bucketOvertimeHours(projRows, sa);
    return {
      overtime_normal: b.normal,
      overtime_holiday: b.holiday,
      overtime_public_holiday: b.public_holiday,
    };
  };

  for (const att of attRows) {
    const k = key(att.employee_id, att.date);
    const projRows = projectsByAttendanceId.get(String(att.id ?? '')) ?? [];
    let working_hours = 0;
    const projectParts: { name: string; hours: number }[] = [];

    for (const p of projRows) {
      const hrs = Number(p.working_hours ?? 0);
      working_hours += hrs;
      const name = resolveProjectDisplayName(p.project_id, projectNameById);
      projectParts.push({ name, hours: hrs });
    }

    // Notes "Attendance type: Weekend/Holiday-Work" override status_attendance.
    // Some records have status_attendance='Present' but the real type is in notes.
    const saRaw = att.status_attendance?.trim() ?? '';
    const notesType = (att.notes ?? '').match(/Attendance\s+type:\s*(.+?)(?:\n|$)/i)?.[1]?.trim() ?? '';
    const sa = notesType || saRaw;

    const { overtime_normal, overtime_holiday, overtime_public_holiday } = addOvertimeToBuckets(
      projRows,
      sa
    );

    const existing = dayDataByKey.get(k);
    if (existing) {
      existing.working_hours += working_hours;
      existing.overtime_normal += overtime_normal;
      existing.overtime_holiday += overtime_holiday;
      existing.overtime_public_holiday += overtime_public_holiday;
      existing.projectParts.push(...projectParts);
      if (!existing.notes && att.notes) existing.notes = att.notes;
    } else {
      dayDataByKey.set(k, {
        status: att.status,
        status_attendance: sa || att.status_attendance,
        notes: att.notes,
        working_hours,
        overtime_normal,
        overtime_holiday,
        overtime_public_holiday,
        projectParts,
      });
    }
  }

  // Apply hour defaults:
  // - Weekend/Holiday-Work: 8hr default only when project rows exist (Construction/Maintenance track per-project).
  // - Sick Leave: temporary 8hr default; overwritten by SL law tiers below.
  // - Half Day AM: 4.5hr for all employees (7:30–12:00), regardless of project rows.
  // - Half Day PM: 3.5hr for all employees (13:00–16:30), regardless of project rows.
  dayDataByKey.forEach((v) => {
    if (v.working_hours === 0) {
      if (
        v.projectParts.length > 0 &&
        (v.status_attendance === 'Weekend' || v.status_attendance === 'Holiday-Work')
      ) {
        v.working_hours = 8;
      } else if (v.status_attendance === 'Sick Leave') {
        v.working_hours = 8;
      } else if (v.status_attendance === 'Half Day AM') {
        v.working_hours = 4.5;
      } else if (v.status_attendance === 'Half Day PM') {
        v.working_hours = 3.5;
      }
    }
  });

  // Calendar-year SL law: force payable hours by ordinal (1–15 → 8h, 16–45 → 4h, 46+ → 0h).
  // Applies even when the SL day has project rows — the law fixes payable hours.
  const periodSickLeaveDays: { employee_id: string; date: string }[] = [];
  dayDataByKey.forEach((v, k) => {
    const code = statusToCode(v.status, v.status_attendance);
    if (code !== 'SL') return;
    const [empId, date] = k.split('|');
    periodSickLeaveDays.push({ employee_id: empId, date });
  });
  const slAssignments = assignSickLeaveTiers({
    periodSickLeaveDays,
    priorSickLeaveDaysByEmployee,
  });
  for (const [key, assignment] of Array.from(slAssignments.entries())) {
    const v = dayDataByKey.get(key);
    if (v) v.working_hours = assignment.paid_hours;
  }

  // Employees with overtime disabled: cap regular hours, exclude OT from payroll report.
  dayDataByKey.forEach((v, k) => {
    const empId = k.split('|')[0];
    const emp = employeeMap.get(empId);
    if (emp?.overtime_enabled === false) {
      const max = maxRegularHoursForStatus(v.status_attendance);
      if (v.working_hours > max) v.working_hours = max;
      v.overtime_normal = 0;
      v.overtime_holiday = 0;
      v.overtime_public_holiday = 0;
    }
  });

  // Build report per employee
  const employeeIds = Array.from(
    new Set(attRows.map((r) => r.employee_id))
  ).sort();
  const result: AttendanceReportEmployeeReport[] = [];

  for (const empId of employeeIds) {
    const emp = employeeMap.get(empId);
    const days: AttendanceReportDay[] = [];
    const dates = Array.from(
      new Set(attRows.filter((r) => r.employee_id === empId).map((r) => dateOnly(r.date)))
    ).sort();
    const periodSlDates: string[] = [];
    let lastWorkProjects = latestLookbackProjects(
      lookbackWorkDaysByEmployee.get(empId),
      dates[0] ?? '9999-99-99'
    );

    for (const date of dates) {
      const k = key(empId, date);
      const d = dayDataByKey.get(k);
      if (!d) continue;

      const statusCode = statusToCode(d.status, d.status_attendance);
      const loggedParts = mergeProjectParts(d.projectParts);
      const hoursByProjectName = new Map<string, number>();
      loggedParts.forEach((p) => {
        hoursByProjectName.set(p.name, p.hours);
      });
      const loggedProjectsText =
        hoursByProjectName.size === 0
          ? ''
          : Array.from(hoursByProjectName.entries())
              .map(([name, hrs]) => `${name} ${hrs}hrs`)
              .join(' + ');

      const slAssignment =
        statusCode === 'SL' ? slAssignments.get(k) ?? null : null;
      if (statusCode === 'SL') periodSlDates.push(date);

      let inheritedParts: { name: string; hours: number }[] | null = null;
      let projectsText = loggedProjectsText;

      if (statusCode === 'SL' && hasLoggedProjects(loggedParts)) {
        projectsText = formatSickLeaveProjectsText(loggedParts);
      } else if (statusCode === 'SL' && lastWorkProjects.length > 0) {
        const paidHours = d.working_hours ?? 0;
        inheritedParts =
          paidHours > 0
            ? allocateSickLeaveHours(paidHours, lastWorkProjects)
            : lastWorkProjects.map((p) => ({ name: p.name, hours: 0 }));
        const displayParts =
          paidHours > 0 ? inheritedParts : lastWorkProjects.map((p) => ({ name: p.name, hours: 0 }));
        projectsText = formatSickLeaveProjectsText(displayParts);
        if (paidHours <= 0) inheritedParts = null;
      }

      if (statusCode !== 'SL' && hasLoggedProjects(loggedParts)) {
        lastWorkProjects = loggedParts;
      }

      days.push({
        date,
        status_code: statusCode,
        working_hours: d.working_hours,
        overtime: {
          normal: d.overtime_normal,
          holiday: d.overtime_holiday,
          public_holiday: d.overtime_public_holiday,
        },
        projects:
          statusCode === 'SL'
            ? projectsText || '—'
            : loggedProjectsText || '—',
        notes: d.notes,
        sick_leave: slAssignment
          ? {
              ordinal: slAssignment.ordinal,
              year: slAssignment.year,
              tier: slAssignment.tier,
              paid_hours: slAssignment.paid_hours,
            }
          : null,
        sick_leave_projects:
          statusCode === 'SL' && inheritedParts && inheritedParts.length > 0
            ? inheritedParts
            : null,
      });
    }

    const sickLeave = summarizeEmployeeSickLeave({
      employeeId: empId,
      periodSickLeaveDates: periodSlDates,
      priorSickLeaveDates: priorSickLeaveDaysByEmployee.get(empId) ?? [],
      assignments: slAssignments,
    });

    result.push({
      employee: {
        id: empId,
        name: emp?.name ?? 'Unknown',
        department: emp?.department ?? '—',
        salary: emp?.salary ?? null,
      },
      days,
      sickLeave:
        sickLeave.ytd.length > 0 || sickLeave.periodDays > 0
          ? sickLeave
          : null,
    });
  }

  // Sort by department first, then by employee name, then id — easier to find issues
  result.sort((a, b) => {
    const deptA = (a.employee.department ?? '').toLowerCase();
    const deptB = (b.employee.department ?? '').toLowerCase();
    if (deptA !== deptB) return deptA.localeCompare(deptB);
    const nameA = (a.employee.name ?? '').toLowerCase();
    const nameB = (b.employee.name ?? '').toLowerCase();
    if (nameA !== nameB) return nameA.localeCompare(nameB);
    return (a.employee.id ?? '').localeCompare(b.employee.id ?? '');
  });

  return result;
}
