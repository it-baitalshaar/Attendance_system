/**
 * Attendance Report — pre-joining window.
 *
 * Single source of truth for "which calendar days is this employee expected to
 * have attendance for?". An employee who joined on 6 Nov is not a gap on 26 Oct
 * – 5 Nov, so those days must not appear as `no attendance record`, and must not
 * inflate the `Not recorded` / `Missing` counters (screen, print/PDF, e-mail).
 *
 * Joining date is stored on `Employee.joining_date` (migration
 * `add_employee_joining_date.sql`). Employees without a joining date keep the
 * original behaviour: the whole report range is expected.
 *
 * The hide toggle is remembered per department in localStorage, mirroring the
 * template pick in `attendanceReportTemplate.ts`. It defaults to ON because a
 * pre-joining day is never a payroll problem.
 */

import type { AttendanceReportDay } from '@/app/admin/types/attendanceReport';

const HIDE_STORAGE_PREFIX = 'attendanceReportHidePreJoin';

function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(value: string | null | undefined): Date | null {
  const text = String(value ?? '').trim().slice(0, 10);
  if (!text) return null;
  const d = new Date(text + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Inclusive day count between two ISO dates (0 when either is missing/invalid). */
export function inclusiveDayCount(from: string, to: string): number {
  const a = parseIso(from);
  const b = parseIso(to);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
}

export interface ExpectedWindow {
  /** First expected day — later of the period start and the joining date. */
  from: string;
  /** Last expected day — the period end. */
  to: string;
  /** Inclusive length of the expected window. */
  days: number;
  /**
   * Period days that fall before the joining date. Empty when the joining date
   * is unknown, earlier than the period, or hiding is off.
   */
  preJoinDates: string[];
}

/**
 * Resolves the expected-attendance window for one employee.
 *
 * `hidePreJoin` false → the whole period is expected (original behaviour).
 * The joining day itself IS expected — only strictly earlier days are skipped.
 */
export function resolveExpectedWindow(params: {
  calFrom: string;
  calTo: string;
  joiningDate?: string | null;
  hidePreJoin: boolean;
}): ExpectedWindow {
  const { calFrom, calTo, joiningDate, hidePreJoin } = params;
  const periodFrom = String(calFrom ?? '').trim().slice(0, 10);
  const periodTo = String(calTo ?? '').trim().slice(0, 10);

  const full: ExpectedWindow = {
    from: periodFrom,
    to: periodTo,
    days: inclusiveDayCount(periodFrom, periodTo),
    preJoinDates: [],
  };

  if (!hidePreJoin) return full;

  const joined = parseIso(joiningDate);
  const start = parseIso(periodFrom);
  const end = parseIso(periodTo);
  if (!joined || !start || !end) return full;
  // Nothing to hide when the employee was already on board at the period start.
  if (joined.getTime() <= start.getTime()) return full;
  // Period ends before the joining date: no expected days at all.
  if (joined.getTime() > end.getTime()) {
    return {
      from: periodTo,
      to: periodTo,
      days: 0,
      preJoinDates: eachIsoDay(start, end),
    };
  }

  const preJoinDates = eachIsoDay(start, new Date(joined.getTime() - 86400000));
  return {
    from: toLocalIso(joined),
    to: periodTo,
    days: inclusiveDayCount(toLocalIso(joined), periodTo),
    preJoinDates,
  };
}

function eachIsoDay(from: Date, to: Date): string[] {
  const out: string[] = [];
  const cur = new Date(from.getTime());
  while (cur.getTime() <= to.getTime()) {
    out.push(toLocalIso(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Calendar days in the window that have no attendance row. */
export function missingDatesInWindow(
  days: AttendanceReportDay[],
  window: ExpectedWindow
): string[] {
  const from = parseIso(window.from);
  const to = parseIso(window.to);
  if (!from || !to || window.days <= 0) return [];

  const recorded = new Set(days.map((d) => String(d.date ?? '').slice(0, 10)));
  const missing: string[] = [];
  const cur = new Date(from.getTime());
  while (cur.getTime() <= to.getTime()) {
    const iso = toLocalIso(cur);
    if (!recorded.has(iso)) missing.push(iso);
    cur.setDate(cur.getDate() + 1);
  }
  return missing;
}

// ── Remembered toggle (per department, like attendanceReportTemplate) ──

/** `All departments` is its own scope so it remembers a separate choice. */
function scopeKey(department: string | null | undefined): string {
  const name = (department ?? '').trim();
  return name ? name.toLowerCase() : '__all__';
}

export function hidePreJoinStorageKey(department: string | null | undefined): string {
  return `${HIDE_STORAGE_PREFIX}:${scopeKey(department)}`;
}

/**
 * Remembered pick for a scope. Defaults to `true` (hide) — the safe choice,
 * since pre-joining days were never payroll absences.
 */
export function readRememberedHidePreJoin(
  department: string | null | undefined
): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(hidePreJoinStorageKey(department));
    return raw === null ? true : raw !== 'false';
  } catch {
    return true;
  }
}

export function rememberHidePreJoin(
  department: string | null | undefined,
  hide: boolean
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(hidePreJoinStorageKey(department), String(hide));
  } catch {
    // Private mode / storage disabled — the in-memory selection still works.
  }
}
