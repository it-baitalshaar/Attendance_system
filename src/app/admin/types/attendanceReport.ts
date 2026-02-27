/**
 * Types for the Attendance Report (monthly / date-range report).
 * Read-only: no DB schema changes. Uses existing Attendance, Attendance_projects, Employee, projects.
 */

export interface AttendanceReportEmployee {
  id: string;
  name: string;
  department: string;
  salary?: number | null;
}

export interface AttendanceReportDayOvertime {
  normal: number;
  weekend: number;
  holiday: number;
}

export interface AttendanceReportDay {
  date: string;
  status_code: string;
  working_hours: number;
  overtime: AttendanceReportDayOvertime;
  projects: string;
  notes: string | null;
}

export interface AttendanceReportEmployeeReport {
  employee: AttendanceReportEmployee;
  days: AttendanceReportDay[];
}

/**
 * Maps DB status + status_attendance to display code per spec.
 */
export function statusToCode(
  status: string | null | undefined,
  status_attendance: string | null | undefined
): string {
  const s = (status ?? '').toLowerCase();
  const sa = (status_attendance ?? '').trim();

  if (s === 'vacation') return 'V';
  if (s === 'present') {
    if (sa === 'Present') return 'P';
    if (sa === 'Weekend') return 'W';
    if (sa === 'Holiday-Work') return 'H';
    return 'P';
  }
  if (s === 'absent') {
    if (sa === 'Absence without excuse') return 'AWO';
    if (sa === 'Sick Leave') return 'SL';
    if (sa === 'Absence with excuse') return 'A';
    return 'AWO';
  }
  return sa || '—';
}
