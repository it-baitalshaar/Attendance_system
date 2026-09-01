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

/**
 * Payroll overtime hours per day (from Attendance_projects.overtime_type).
 * Arabic column titles: see `WORKER_CARD_AR` in `@/app/constants/workerCardReportAr`.
 */
export interface AttendanceReportDayOvertime {
  /** ساعات العمل الإضافية — normal OT (×1.25) */
  normal: number;
  /** ساعات العمل خلال الإجازة — holiday OT (×1.5) */
  holiday: number;
  /** ساعات العمل بالمناسبات الرسمية — public holiday OT (×2.5) */
  public_holiday: number;
}

/** Calendar-year SL law tier for a single sick-leave day (see sickLeaveLaw.ts). */
export interface AttendanceReportDaySickLeave {
  ordinal: number;
  year: number;
  tier: 'full' | 'half' | 'unpaid';
  paid_hours: number;
}

export interface AttendanceReportDay {
  date: string;
  status_code: string;
  working_hours: number;
  overtime: AttendanceReportDayOvertime;
  projects: string;
  notes: string | null;
  /** Present only when status_code === 'SL'. Payable hours already applied to working_hours. */
  sick_leave?: AttendanceReportDaySickLeave | null;
  /**
   * Paid SL hours inherited from the previous working day's project(s).
   * Empty/null when the SL day already had logged projects or no prior project was found.
   * Salary/project reports charge these hours so totals match.
   */
  sick_leave_projects?: { name: string; hours: number }[] | null;
}

/** Per-employee SL law rollup for the Overall Summary. */
export interface AttendanceReportSickLeaveSummary {
  /** One entry per calendar year touched by the year-to-date window (prior + period). */
  ytd: { year: number; daysUsed: number }[];
  periodDays: number;
  periodFullDays: number;
  periodHalfDays: number;
  periodUnpaidDays: number;
}

export interface AttendanceReportEmployeeReport {
  employee: AttendanceReportEmployee;
  days: AttendanceReportDay[];
  sickLeave?: AttendanceReportSickLeaveSummary | null;
}

/**
 * Maps DB status + status_attendance to display code per spec.
 */
export function dateOnly(date: string | null | undefined): string {
  return String(date ?? '').trim().slice(0, 10);
}

export function statusToCode(
  status: string | null | undefined,
  status_attendance: string | null | undefined
): string {
  const s = (status ?? '').toLowerCase();
  const sa = (status_attendance ?? '').trim().toLowerCase();

  if (s === 'vacation' || sa === 'vacation') return 'V';
  if (sa === 'sick leave' || sa === 'sick_leave') return 'SL';
  if (s === 'present') {
    if (sa === 'present') return 'P';
    if (sa === 'weekend') return 'W';
    if (sa === 'holiday-work' || sa === 'holiday_work') return 'H';
    if (sa === 'half day am' || sa === 'half_day_am') return 'HDAM';
    if (sa === 'half day pm' || sa === 'half_day_pm') return 'HDPM';
    return 'P';
  }
  if (s === 'absent') {
    if (sa === 'absence without excuse') return 'AWO';
    if (sa === 'absence with excuse') return 'A';
    return 'AWO';
  }
  return (status_attendance ?? '').trim() || '—';
}
