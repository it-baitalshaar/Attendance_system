import {
  DEFAULT_OVERTIME_TYPE,
  type OvertimeType,
} from '@/app/constants/overtime';

/** 0 = Sunday … 6 = Saturday (matches JavaScript Date.getDay()). */
export const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
] as const;

/** Fallback when DB column is missing or empty. */
export const DEFAULT_WEEKEND_DAYS_BY_DEPARTMENT: Record<string, number[]> = {
  construction: [6],
  maintenance: [0],
};

export interface OvertimeCalendarConfig {
  weekendDays: number[];
  holidayDates: string[];
  allowHolidayOvertime: boolean;
  allowPublicHolidayOvertime: boolean;
}

export function normalizeDateKey(dateStr: string): string {
  return dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
}

export function getDayOfWeekFromDateStr(dateStr: string): number {
  const [y, m, d] = normalizeDateKey(dateStr).split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function resolveWeekendDaysForDepartment(
  departmentName: string | null | undefined,
  weekendDaysFromDb: number[] | null | undefined
): number[] {
  if (Array.isArray(weekendDaysFromDb) && weekendDaysFromDb.length > 0) {
    return [...weekendDaysFromDb].sort((a, b) => a - b);
  }
  const key = (departmentName ?? '').trim().toLowerCase();
  return DEFAULT_WEEKEND_DAYS_BY_DEPARTMENT[key] ?? [];
}

export function isWeekendForDepartment(dateStr: string, weekendDays: number[]): boolean {
  if (!weekendDays.length) return false;
  return weekendDays.includes(getDayOfWeekFromDateStr(dateStr));
}

/** Count calendar days in [from, to] that fall on configured weekend DOWs (0=Sun … 6=Sat). */
export function countWeekendDaysInRange(
  fromDate: string,
  toDate: string,
  weekendDays: number[]
): number {
  if (!fromDate || !toDate || !weekendDays.length) return 0;
  let count = 0;
  const cur = new Date(fromDate + 'T00:00:00');
  const end = new Date(toDate + 'T00:00:00');
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    if (isWeekendForDepartment(`${y}-${m}-${d}`, weekendDays)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/** Union weekend DOWs for report summary when multiple departments are in scope. */
export function resolveSummaryWeekendDays(params: {
  departmentFilter: string | null | undefined;
  departments: { name: string; weekend_days?: number[] | null }[];
  reportDepartmentNames?: string[];
}): number[] {
  const { departmentFilter, departments, reportDepartmentNames } = params;
  const filter = (departmentFilter ?? '').trim();

  if (filter) {
    const row = departments.find((d) => d.name.toLowerCase() === filter.toLowerCase());
    return resolveWeekendDaysForDepartment(filter, row?.weekend_days);
  }

  const names =
    reportDepartmentNames?.length
      ? Array.from(new Set(reportDepartmentNames.map((n) => n.trim()).filter(Boolean)))
      : departments.map((d) => d.name);

  const union = new Set<number>();
  for (const name of names) {
    const row = departments.find((d) => d.name.toLowerCase() === name.toLowerCase());
    for (const dow of resolveWeekendDaysForDepartment(name, row?.weekend_days)) {
      union.add(dow);
    }
  }
  return Array.from(union).sort((a, b) => a - b);
}

export function isPublicHolidayDate(
  dateStr: string,
  holidayDates: string[]
): boolean {
  const key = normalizeDateKey(dateStr);
  return holidayDates.includes(key);
}

/** Admin holiday name(s) for a date, e.g. "Eid ul Adha". */
export function resolveHolidayNameForDate(
  dateStr: string,
  holidays: { holiday_date: string; name: string }[]
): string | null {
  const key = normalizeDateKey(dateStr);
  const names = holidays
    .filter((h) => normalizeDateKey(h.holiday_date) === key)
    .map((h) => h.name.trim())
    .filter(Boolean);
  if (!names.length) return null;
  return names.join(' · ');
}

export type SuggestedAttendanceStatus = 'Present' | 'Weekend' | 'Holiday-Work';

export function resolveSuggestedAttendanceStatus(params: {
  dateStr: string;
  weekendDays: number[];
  holidayDates: string[];
}): SuggestedAttendanceStatus {
  const { dateStr, weekendDays, holidayDates } = params;
  if (isPublicHolidayDate(dateStr, holidayDates)) return 'Holiday-Work';
  if (isWeekendForDepartment(dateStr, weekendDays)) return 'Weekend';
  return 'Present';
}

/**
 * Default payroll overtime type for a project row on a given date.
 * `holiday` = weekend OT (×1.5); `public_holiday` = named holiday OT (×2.5).
 * Admin calendar dates always drive the default (toggles only limit manual pick on regular days).
 */
export function resolveDefaultOvertimeType(params: {
  dateStr: string;
  config: OvertimeCalendarConfig;
  attendanceStatus?: string | null;
}): OvertimeType {
  const { dateStr, config, attendanceStatus } = params;
  const status = (attendanceStatus ?? '').trim();

  if (isPublicHolidayDate(dateStr, config.holidayDates) || status === 'Holiday-Work') {
    return 'public_holiday';
  }

  if (isWeekendForDepartment(dateStr, config.weekendDays) || status === 'Weekend') {
    return 'holiday';
  }

  return DEFAULT_OVERTIME_TYPE;
}

export function formatWeekendDaysSummary(days: number[]): string {
  if (!days.length) return 'No weekend days configured';
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_OPTIONS.find((w) => w.value === d)?.short ?? String(d))
    .join(', ');
}
