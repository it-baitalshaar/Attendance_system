/**
 * Attendance Report templates — single source of truth.
 *
 * Two layouts share the same report data (`/api/attendance-report`):
 *
 *  - `standard`        — hours + OT + salary columns (the original report).
 *  - `attendance-only` — status counts only, no hours / OT / salary.
 *                        Used for Al Saqiya, which records status without hours.
 *
 * Neither template changes what the API returns; they only change how the
 * Attendance Report renders, exports and e-mails the data. The `standard`
 * template stays the default everywhere except Al Saqiya, so existing
 * Construction / Maintenance output is untouched.
 *
 * The chosen template is remembered per department in localStorage so a
 * supervisor who picked a layout for one department gets it back next time,
 * while still being able to switch at any moment.
 */

import { isSaqiyaDepartment } from '@/app/admin/services/employeeIdService';

export type AttendanceReportTemplate = 'standard' | 'attendance-only';

export const ATTENDANCE_REPORT_TEMPLATE_OPTIONS: {
  value: AttendanceReportTemplate;
  label: string;
  hint: string;
}[] = [
  {
    value: 'standard',
    label: 'Standard (hours + salary)',
    hint: 'Daily hours, overtime and salary — the original report.',
  },
  {
    value: 'attendance-only',
    label: 'Attendance only (no hours/salary)',
    hint: 'Status counts only — Present, Half Day, Weekend, Vacation, AWO, SL, A.',
  },
];

/** Department-driven default: Al Saqiya records no hours, so it defaults to attendance-only. */
export function defaultAttendanceReportTemplate(
  department: string | null | undefined
): AttendanceReportTemplate {
  return isSaqiyaDepartment(department) ? 'attendance-only' : 'standard';
}

/** `All departments` is its own scope so it remembers a separate choice. */
function scopeKey(department: string | null | undefined): string {
  const name = (department ?? '').trim();
  return name ? name.toLowerCase() : '__all__';
}

export function templateStorageKey(department: string | null | undefined): string {
  return `attendanceReportTemplate:${scopeKey(department)}`;
}

function isTemplateValue(value: unknown): value is AttendanceReportTemplate {
  return value === 'standard' || value === 'attendance-only';
}

/** Remembered pick for a scope, or null when nothing is stored / storage is unavailable. */
export function readRememberedTemplate(
  department: string | null | undefined
): AttendanceReportTemplate | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(templateStorageKey(department));
    return isTemplateValue(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function rememberTemplate(
  department: string | null | undefined,
  template: AttendanceReportTemplate
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(templateStorageKey(department), template);
  } catch {
    // Private mode / storage disabled — the in-memory selection still works.
  }
}

export function forgetRememberedTemplate(department: string | null | undefined): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(templateStorageKey(department));
  } catch {
    // Ignore — nothing to clear.
  }
}

/** Stored pick if present, otherwise the department default. */
export function resolveTemplateForDepartment(
  department: string | null | undefined
): AttendanceReportTemplate {
  return readRememberedTemplate(department) ?? defaultAttendanceReportTemplate(department);
}
