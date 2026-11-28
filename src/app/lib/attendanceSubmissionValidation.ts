/**
 * Attendance completeness rules — single source of truth.
 *
 * Used by BOTH:
 *  - the home submit guard (`useHomeSubmit`) and the API (`/api/submitAttendance`)
 *  - the monthly Attendance Report (`AttendanceReportSection` + Overall Summary)
 *
 * Do not duplicate these thresholds anywhere else. Extend this module instead.
 *
 * Why 8 / 4.5 / 3.5: payroll base pay is `working_hours x hourly_rate`, so a day
 * that should be 8h but was saved as 0h or 6h silently under/over-pays and shows
 * up later as `Hrs Δ` in the salary report.
 */

/** Expected regular (non-overtime) hours per attendance kind. */
export const EXPECTED_REGULAR_HOURS = {
  present: 8,
  halfDayAm: 4.5,
  halfDayPm: 3.5,
} as const;

/** Hours tolerance for float additions from multiple project rows. */
const HOURS_EPSILON = 0.01;

/** Normalized attendance kind shared by the submit flow and the report. */
export type AttendanceKind =
  | 'present'
  | 'weekend'
  | 'holiday-work'
  | 'half-day-am'
  | 'half-day-pm'
  | 'sick-leave'
  | 'absent-excused'
  | 'absent-no-excuse'
  | 'absent-no-reason'
  | 'vacation';

export type AttendanceIssueCode =
  | 'zero_hours'
  | 'hours_not_standard'
  | 'over_8_no_ot'
  | 'weekend_no_hours'
  | 'ot_without_hours'
  | 'overtime_on_leave'
  | 'no_absence_reason';

export type AttendanceIssueSeverity = 'error' | 'warning';

export interface AttendanceValidationIssue {
  employee_id: string;
  employee_name: string;
  code: AttendanceIssueCode;
  severity: AttendanceIssueSeverity;
  message: string;
  /** Set for report issues (one issue per day). */
  date?: string;
  hours?: number;
  overtime_hours?: number;
}

type RuleHit = {
  code: AttendanceIssueCode;
  severity: AttendanceIssueSeverity;
  message: string;
};

const ABSENCE_REASONS = ['Sick Leave', 'Absence with excuse', 'Absence without excuse'] as const;

/** Minimum characters required when overriding an incomplete submission. */
export const MIN_OVERRIDE_REASON_LENGTH = 5;

/** Client + server guard for the "Submit anyway" reason. */
export function isOverrideReasonValid(reason: string | null | undefined): boolean {
  return (reason ?? '').trim().length >= MIN_OVERRIDE_REASON_LENGTH;
}

/** Reads the `Attendance type: X` line written by the home cards. */
export function parseAttendanceTypeFromNotes(notes: string | null | undefined): string {
  const text = notes ?? '';
  const match = text.match(/Attendance\s+type:\s*(.+?)(?:\n|$)/i);
  return match?.[1]?.trim() ?? '';
}

/** Legacy cards stored the absence reason as free text in notes. */
export function absenceReasonFromNotes(notes: string | null | undefined): string {
  const text = notes ?? '';
  for (const reason of ABSENCE_REASONS) {
    if (text.includes(reason)) return reason;
  }
  return '';
}

/** Maps a submit row (status + attendance type + notes) to a shared kind. */
export function resolveSubmissionKind(input: {
  status: string | null | undefined;
  attendanceType?: string | null;
  notes?: string | null;
}): AttendanceKind {
  const status = (input.status ?? 'present').trim().toLowerCase();
  if (status === 'vacation') return 'vacation';

  const attendanceType =
    (input.attendanceType ?? '').trim() || parseAttendanceTypeFromNotes(input.notes);

  if (status === 'absent') {
    const reason = attendanceType || absenceReasonFromNotes(input.notes);
    if (reason === 'Sick Leave') return 'sick-leave';
    if (reason === 'Absence with excuse') return 'absent-excused';
    if (reason === 'Absence without excuse') return 'absent-no-excuse';
    return 'absent-no-reason';
  }

  // A lingering absence reason (e.g. the card was toggled back to present but the
  // Sick Leave reason was never cleared) still produces a leave day in the report.
  // Treat it as a leave day here so OT on it is caught before it is saved.
  if (attendanceType === 'Sick Leave') return 'sick-leave';
  if (attendanceType === 'Absence with excuse') return 'absent-excused';
  if (attendanceType === 'Absence without excuse') return 'absent-no-excuse';

  if (attendanceType === 'Weekend') return 'weekend';
  if (attendanceType === 'Holiday-Work' || attendanceType === 'Holiday') return 'holiday-work';
  if (attendanceType === 'Half Day AM') return 'half-day-am';
  if (attendanceType === 'Half Day PM') return 'half-day-pm';
  return 'present';
}

/** Leave kinds are full-day absences — they never earn overtime. */
export function isLeaveKind(kind: AttendanceKind): boolean {
  return (
    kind === 'sick-leave' ||
    kind === 'absent-excused' ||
    kind === 'absent-no-excuse' ||
    kind === 'vacation'
  );
}

/**
 * True when a home card's `status_employee` / attendance-type value is a full-day
 * leave (Sick Leave, Absence with/without excuse, vacation).
 */
export function isLeaveAttendanceType(attendanceType: string | null | undefined): boolean {
  const t = (attendanceType ?? '').trim();
  return (
    t === 'Sick Leave' ||
    t === 'Absence with excuse' ||
    t === 'Absence without excuse' ||
    t === 'vacation'
  );
}

/**
 * Field submit only stores project rows (hours + OT) for present days and Sick Leave
 * (SL hours are charged to a project). Absent / vacation days drop their rows, so
 * lingering Redux project hours must not be validated as if they will be saved.
 */
export function keepsProjectHours(input: {
  status: string | null | undefined;
  attendanceType?: string | null;
}): boolean {
  const status = (input.status ?? '').trim().toLowerCase();
  return status === 'present' || (input.attendanceType ?? '').trim() === 'Sick Leave';
}

/** Maps an Attendance Report day code (P / W / H / HDAM / …) to a shared kind. */
export function resolveReportKind(statusCode: string | null | undefined): AttendanceKind {
  switch ((statusCode ?? '').toUpperCase()) {
    case 'W':
      return 'weekend';
    case 'H':
      return 'holiday-work';
    case 'HDAM':
      return 'half-day-am';
    case 'HDPM':
      return 'half-day-pm';
    case 'SL':
      return 'sick-leave';
    case 'A':
      return 'absent-excused';
    case 'AWO':
      return 'absent-no-excuse';
    case 'V':
      return 'vacation';
    default:
      return 'present';
  }
}

const KIND_LABELS: Record<AttendanceKind, string> = {
  present: 'Present',
  weekend: 'Weekend',
  'holiday-work': 'Holiday-Work',
  'half-day-am': 'Half Day AM',
  'half-day-pm': 'Half Day PM',
  'sick-leave': 'Sick Leave',
  'absent-excused': 'Absent (excused)',
  'absent-no-excuse': 'Absent (no excuse)',
  'absent-no-reason': 'Absent',
  vacation: 'Vacation',
};

export function attendanceKindLabel(kind: AttendanceKind): string {
  return KIND_LABELS[kind] ?? kind;
}

function formatHours(hours: number): string {
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

/**
 * Core rules. Returns every issue for one employee-day.
 * `context` only affects weekend / holiday-work days with no hours:
 *  - submit: an error (the supervisor is claiming work)
 *  - report: ignored (a genuine rest day is legitimate)
 */
export function evaluateEntry(params: {
  kind: AttendanceKind;
  hours: number;
  overtimeHours: number;
  context: 'submit' | 'report';
}): RuleHit[] {
  const { kind, context } = params;
  const hours = Number.isFinite(params.hours) ? params.hours : 0;
  const overtimeHours = Number.isFinite(params.overtimeHours) ? params.overtimeHours : 0;

  if (kind === 'absent-no-reason') {
    return [
      {
        code: 'no_absence_reason',
        severity: 'error',
        message: 'Absent with no reason — select Sick Leave, Absence with excuse, or Absence without excuse.',
      },
    ];
  }

  // No regular hours are expected for these kinds.
  if (isLeaveKind(kind)) {
    // A leave day is a full-day absence: OT can never be earned on it. This is the
    // combination that used to slip through (SL day paid 8h + project OT ×1.25).
    if (overtimeHours > HOURS_EPSILON) {
      return [
        {
          code: 'overtime_on_leave',
          severity: 'error',
          message: `${attendanceKindLabel(kind)} day with ${formatHours(
            overtimeHours
          )} overtime logged — overtime is not allowed on a leave day. Clear the OT or change the status.`,
        },
      ];
    }
    return [];
  }

  const hits: RuleHit[] = [];

  if (hours <= HOURS_EPSILON) {
    if (overtimeHours > 0) {
      hits.push({
        code: 'ot_without_hours',
        severity: 'error',
        message: `Overtime logged (${formatHours(overtimeHours)}) but no regular hours.`,
      });
      return hits;
    }
    // In the report a weekend/holiday day with no hours is a rest day, not a data error.
    // The submit guard still blocks it because the supervisor is claiming work.
    if (context === 'report' && (kind === 'weekend' || kind === 'holiday-work')) {
      return hits;
    }
    if (kind === 'weekend') {
      hits.push({
        code: 'weekend_no_hours',
        severity: 'error',
        message: 'Weekend marked but no hours filled.',
      });
    } else {
      const expected = expectedHoursForKind(kind);
      hits.push({
        code: 'zero_hours',
        severity: 'error',
        message:
          expected != null
            ? `No hours filled — expected ${formatHours(expected)}.`
            : 'No hours filled.',
      });
    }
    return hits;
  }

  // Weekend / holiday work hours legitimately vary (the empty case is handled above),
  // so no standard-hours or over-8 rule applies to them.
  if (kind === 'weekend' || kind === 'holiday-work') return hits;

  if (hours > EXPECTED_REGULAR_HOURS.present + HOURS_EPSILON && overtimeHours <= HOURS_EPSILON) {
    hits.push({
      code: 'over_8_no_ot',
      severity: 'error',
      message: `Entered ${formatHours(hours)} but no overtime logged. Keep 8h regular and log the rest as OT.`,
    });
    return hits;
  }

  const expected = expectedHoursForKind(kind);
  if (expected == null) return hits;

  // A normal day may run long as long as the extra time is logged as OT (checked above).
  // Half days must match exactly — a half day cannot be a full 8h regular day.
  const isHalfDay = kind === 'half-day-am' || kind === 'half-day-pm';
  const underFilled = hours < expected - HOURS_EPSILON;
  const overHalfDay = isHalfDay && hours > expected + HOURS_EPSILON;

  if (underFilled || overHalfDay) {
    hits.push({
      code: 'hours_not_standard',
      severity: 'error',
      message: `Entered ${formatHours(hours)}, expected ${formatHours(expected)}.`,
    });
  }

  return hits;
}

function expectedHoursForKind(kind: AttendanceKind): number | null {
  if (kind === 'present') return EXPECTED_REGULAR_HOURS.present;
  if (kind === 'half-day-am') return EXPECTED_REGULAR_HOURS.halfDayAm;
  if (kind === 'half-day-pm') return EXPECTED_REGULAR_HOURS.halfDayPm;
  // Weekend / holiday-work deliberately not constrained.
  return null;
}

export interface AttendanceSubmissionRow {
  employee_id: string;
  employee_name: string;
  status: 'present' | 'absent' | 'vacation' | string;
  /** `Attendance type: X` from notes when available. */
  attendance_type?: string | null;
  notes?: string | null;
  /** Sum of regular (non-OT) project hours for the day. */
  hours: number;
  /** Sum of project overtime hours for the day. */
  overtime_hours: number;
}

/**
 * Validates a whole day's roster before submit.
 * `checkHours: false` is used for departments that do not collect hours (Al Saqiya).
 */
export function validateAttendanceSubmission(
  rows: AttendanceSubmissionRow[],
  options: { checkHours?: boolean } = {}
): AttendanceValidationIssue[] {
  const checkHours = options.checkHours !== false;
  const issues: AttendanceValidationIssue[] = [];

  for (const row of rows) {
    const kind = resolveSubmissionKind({
      status: row.status,
      attendanceType: row.attendance_type,
      notes: row.notes,
    });

    // Absence reason is enforced for every department.
    if (kind === 'absent-no-reason') {
      const [hit] = evaluateEntry({ kind, hours: 0, overtimeHours: 0, context: 'submit' });
      issues.push(toIssue(row, hit, row.hours, row.overtime_hours));
      continue;
    }

    if (!checkHours) continue;

    const hits = evaluateEntry({
      kind,
      hours: row.hours,
      overtimeHours: row.overtime_hours,
      context: 'submit',
    });
    for (const hit of hits) {
      issues.push(toIssue(row, hit, row.hours, row.overtime_hours));
    }
  }

  return issues;
}

function toIssue(
  row: AttendanceSubmissionRow,
  hit: RuleHit,
  hours: number,
  overtimeHours: number
): AttendanceValidationIssue {
  return {
    employee_id: row.employee_id,
    employee_name: row.employee_name,
    code: hit.code,
    severity: hit.severity,
    message: hit.message,
    hours,
    overtime_hours: overtimeHours,
  };
}

/** Minimal shape of an Attendance Report day needed for validation. */
export interface ReportIssueDay {
  date: string;
  status_code: string;
  working_hours: number;
  overtime: { normal: number; holiday: number; public_holiday: number };
  /** Raw OT found on a leave day but not paid (see AttendanceReportDay.ignored_overtime). */
  ignored_overtime?: number | null;
}

/** Report day codes we understand (see statusToCode). */
const REPORT_STATUS_CODES = new Set(['P', 'W', 'H', 'HDAM', 'HDPM', 'SL', 'A', 'AWO', 'V']);

/** Departments whose home cards collect per-project hours. */
export function collectsAttendanceHours(department: string | null | undefined): boolean {
  const d = (department ?? '').trim().toLowerCase();
  return d === 'construction' || d === 'maintenance';
}

/** Per-day issues for the monthly report (weekend rest days are ignored here). */
export function findEmployeeReportIssues(
  days: ReportIssueDay[],
  options: { checkHours?: boolean } = {}
): AttendanceValidationIssue[] {
  const checkHours = options.checkHours !== false;
  const issues: AttendanceValidationIssue[] = [];

  for (const day of days) {
    // Unknown / custom status codes are not ours to judge.
    if (!REPORT_STATUS_CODES.has((day.status_code ?? '').toUpperCase())) continue;

    const kind = resolveReportKind(day.status_code);
    const overtimeHours =
      (day.overtime?.normal ?? 0) +
      (day.overtime?.holiday ?? 0) +
      (day.overtime?.public_holiday ?? 0);

    // Departments that do not collect hours are only judged on absence reasons.
    if (!checkHours && kind !== 'absent-no-reason') continue;

    const hits = evaluateEntry({
      kind,
      hours: day.working_hours ?? 0,
      overtimeHours,
      context: 'report',
    });

    for (const hit of hits) {
      issues.push({
        employee_id: '',
        employee_name: '',
        code: hit.code,
        severity: hit.severity,
        message: `${attendanceKindLabel(kind)} · ${hit.message}`,
        date: day.date,
        hours: day.working_hours ?? 0,
        overtime_hours: overtimeHours,
      });
    }

    // Stored OT on a leave day is not paid (see bucketOvertimeHours) but is still
    // bad data — surface it so an admin can clean the day.
    const ignoredOvertime = Number(day.ignored_overtime ?? 0);
    if (
      isLeaveKind(kind) &&
      checkHours &&
      ignoredOvertime > HOURS_EPSILON &&
      overtimeHours <= HOURS_EPSILON
    ) {
      issues.push({
        employee_id: '',
        employee_name: '',
        code: 'overtime_on_leave',
        severity: 'error',
        message: `${attendanceKindLabel(kind)} · ${formatHours(
          ignoredOvertime
        )} overtime is stored on this leave day but not paid — remove the OT.`,
        date: day.date,
        hours: day.working_hours ?? 0,
        overtime_hours: ignoredOvertime,
      });
    }
  }

  return issues;
}

export function countIssues(issues: AttendanceValidationIssue[]): {
  total: number;
  errors: number;
  warnings: number;
} {
  let errors = 0;
  let warnings = 0;
  for (const issue of issues) {
    if (issue.severity === 'warning') warnings++;
    else errors++;
  }
  return { total: issues.length, errors, warnings };
}
