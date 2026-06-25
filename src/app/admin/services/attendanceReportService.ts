/**
 * Attendance Report — read-only aggregation from existing tables.
 * No DB schema changes. Uses: Attendance, Attendance_projects, projects, Employee.
 */

import type {
  AttendanceReportEmployeeReport,
  AttendanceReportDay,
} from '../types/attendanceReport';
import { statusToCode } from '../types/attendanceReport';
import { resolveProjectDisplayName } from '@/lib/projectDisplayName';
import { bucketOvertimeHours } from './payrollCalculation';
import { maxRegularHoursForStatus } from '@/app/lib/employeeRegularHours';

export interface RawAttendanceRow {
  id: string;
  employee_id: string;
  date: string;
  status: string | null;
  status_attendance: string | null;
  notes: string | null;
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
}

/**
 * Builds the attendance report per spec:
 * - One row per employee per calendar day
 * - Sum hours and overtime per day
 * - 8hr default for Weekend/Holiday-Work when working_hours=0
 * - Overtime by payroll type from each project row (overtime_type), with legacy fallback from day status when type is missing
 * - Project text: "Name Xhrs + Name Yhrs", NULL → "Unknown"
 * - Sort by employee_id, date asc
 */
export function buildAttendanceReport(
  input: BuildReportInput
): AttendanceReportEmployeeReport[] {
  const { attRows, attProjRows, projectNameById, employees } = input;

  const attendanceById = new Map<string, RawAttendanceRow>();
  attRows.forEach((r) => attendanceById.set(r.id, r));

  const projectsByAttendanceId = new Map<string, RawAttendanceProjectRow[]>();
  attProjRows.forEach((r) => {
    const list = projectsByAttendanceId.get(r.attendance_id) ?? [];
    list.push(r);
    projectsByAttendanceId.set(r.attendance_id, list);
  });

  const employeeMap = new Map<string, RawEmployeeRow>();
  employees.forEach((e) => employeeMap.set(e.employee_id, e));

  // Group by employee_id + date (one day record per key)
  type Key = string;
  const key = (empId: string, d: string) => `${empId}|${d}`;
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
    const projRows = projectsByAttendanceId.get(att.id) ?? [];
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
  // - Half Day AM: 4.5hr for all employees (7:30–12:00), regardless of project rows.
  // - Half Day PM: 3.5hr for all employees (13:00–16:30), regardless of project rows.
  dayDataByKey.forEach((v) => {
    if (v.working_hours === 0) {
      if (
        v.projectParts.length > 0 &&
        (v.status_attendance === 'Weekend' || v.status_attendance === 'Holiday-Work')
      ) {
        v.working_hours = 8;
      } else if (v.status_attendance === 'Half Day AM') {
        v.working_hours = 4.5;
      } else if (v.status_attendance === 'Half Day PM') {
        v.working_hours = 3.5;
      }
    }
  });

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
      new Set(attRows.filter((r) => r.employee_id === empId).map((r) => r.date))
    ).sort();

    for (const date of dates) {
      const k = key(empId, date);
      const d = dayDataByKey.get(k);
      if (!d) continue;

      const statusCode = statusToCode(d.status, d.status_attendance);
      const hoursByProjectName = new Map<string, number>();
      d.projectParts.forEach((p) => {
        const current = hoursByProjectName.get(p.name) ?? 0;
        hoursByProjectName.set(p.name, current + p.hours);
      });
      const projectsText =
        hoursByProjectName.size === 0
          ? ''
          : Array.from(hoursByProjectName.entries())
              .map(([name, hrs]) => `${name} ${hrs}hrs`)
              .join(' + ');

      days.push({
        date,
        status_code: statusCode,
        working_hours: d.working_hours,
        overtime: {
          normal: d.overtime_normal,
          holiday: d.overtime_holiday,
          public_holiday: d.overtime_public_holiday,
        },
        projects: projectsText || '—',
        notes: d.notes,
      });
    }

    result.push({
      employee: {
        id: empId,
        name: emp?.name ?? 'Unknown',
        department: emp?.department ?? '—',
        salary: emp?.salary ?? null,
      },
      days,
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
