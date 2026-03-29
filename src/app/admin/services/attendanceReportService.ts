/**
 * Attendance Report — read-only aggregation from existing tables.
 * No DB schema changes. Uses: Attendance, Attendance_projects, projects, Employee.
 */

import type {
  AttendanceReportEmployeeReport,
  AttendanceReportDay,
} from '../types/attendanceReport';
import { statusToCode } from '../types/attendanceReport';
import { normalizeOvertimeType } from '@/app/constants/overtime';
import { resolveProjectDisplayName } from '@/lib/projectDisplayName';

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
    let overtime_normal = 0;
    let overtime_holiday = 0;
    let overtime_public_holiday = 0;
    for (const p of projRows) {
      const ot = Number(p.overtime_hours ?? 0);
      if (ot === 0) continue;
      const typeRaw = p.overtime_type;
      const t =
        typeRaw != null && String(typeRaw).trim() !== ''
          ? normalizeOvertimeType(typeRaw)
          : null;

      // Explicit payroll types from the app (holiday / public holiday) always win.
      if (t === 'holiday') {
        overtime_holiday += ot;
      } else if (t === 'public_holiday') {
        overtime_public_holiday += ot;
      } else {
        // `normal`, missing type, or legacy backfill: bucket by day status so migrated
        // rows (all defaulted to 'normal') still match weekend/holiday OT columns.
        if (sa === 'Present') overtime_normal += ot;
        else if (sa === 'Weekend') overtime_holiday += ot;
        else if (sa === 'Holiday-Work') overtime_public_holiday += ot;
        else overtime_normal += ot;
      }
    }
    return { overtime_normal, overtime_holiday, overtime_public_holiday };
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

    const sa = att.status_attendance ?? '';
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
        status_attendance: att.status_attendance,
        notes: att.notes,
        working_hours,
        overtime_normal,
        overtime_holiday,
        overtime_public_holiday,
        projectParts,
      });
    }
  }

  // Apply 8hr default: if working_hours=0 and (Weekend or Holiday-Work) → 8
  dayDataByKey.forEach((v) => {
    if (
      v.working_hours === 0 &&
      (v.status_attendance === 'Weekend' || v.status_attendance === 'Holiday-Work')
    ) {
      v.working_hours = 8;
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
