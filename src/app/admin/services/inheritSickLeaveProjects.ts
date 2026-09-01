/**
 * Charge paid Sick Leave hours to the project from the previous working day
 * so employee salary totals and project cost totals match.
 *
 * Walks back past weekends / vacation / other SL days until a day with
 * logged project hours is found. Consecutive SL days all inherit that project.
 */

import { dateOnly, statusToCode } from '../types/attendanceReport';

export interface ProjectHoursPart {
  name: string;
  hours: number;
}

export interface LookbackWorkDay {
  date: string;
  projectParts: ProjectHoursPart[];
}

export interface SickLeaveCharge {
  date: string;
  hours: number;
  amount: number;
}

function roundHours(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatHours(n: number): string {
  const rounded = roundHours(n);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function formatAmount(n: number): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateShort(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function mergeProjectParts(parts: ProjectHoursPart[]): ProjectHoursPart[] {
  const byName = new Map<string, number>();
  for (const p of parts) {
    const name = (p.name ?? '').trim();
    if (!name) continue;
    byName.set(name, (byName.get(name) ?? 0) + Number(p.hours ?? 0));
  }
  return Array.from(byName.entries()).map(([name, hours]) => ({ name, hours }));
}

/** True when the day has at least one named project with hours logged. */
export function hasLoggedProjects(parts: ProjectHoursPart[] | undefined | null): boolean {
  if (!parts || parts.length === 0) return false;
  return parts.some((p) => (p.name ?? '').trim().length > 0 && Number(p.hours) > 0);
}

/**
 * Allocate paid SL hours across the previous day's projects.
 * Single project → all hours. Multiple → proportional to that day's hours
 * (equal split if the previous day had 0 logged hours).
 */
export function allocateSickLeaveHours(
  paidHours: number,
  previousProjects: ProjectHoursPart[]
): ProjectHoursPart[] {
  const merged = mergeProjectParts(previousProjects);
  if (merged.length === 0 || paidHours <= 0) return [];
  if (merged.length === 1) {
    return [{ name: merged[0].name, hours: roundHours(paidHours) }];
  }
  const totalPrev = merged.reduce((s, p) => s + Math.max(0, p.hours), 0);
  if (totalPrev <= 0) {
    const each = roundHours(paidHours / merged.length);
    return merged.map((p, i) => ({
      name: p.name,
      hours: i === merged.length - 1 ? roundHours(paidHours - each * (merged.length - 1)) : each,
    }));
  }
  let allocated = 0;
  return merged.map((p, i) => {
    const hours =
      i === merged.length - 1
        ? roundHours(paidHours - allocated)
        : roundHours((p.hours / totalPrev) * paidHours);
    allocated += hours;
    return { name: p.name, hours };
  });
}

/** Most recent lookback day (strictly before `beforeDate`) that has logged projects. */
export function latestLookbackProjects(
  lookbackDays: LookbackWorkDay[] | undefined,
  beforeDate: string
): ProjectHoursPart[] {
  if (!lookbackDays || lookbackDays.length === 0) return [];
  const sorted = [...lookbackDays]
    .filter((d) => dateOnly(d.date) < dateOnly(beforeDate) && hasLoggedProjects(d.projectParts))
    .sort((a, b) => dateOnly(a.date).localeCompare(dateOnly(b.date)));
  if (sorted.length === 0) return [];
  return mergeProjectParts(sorted[sorted.length - 1].projectParts);
}

/**
 * Display line for project reports:
 * `Sick leave Salem Al Zaabi, 8h, 33.33 · Jul 1`
 */
export function formatSickLeaveChargeLabel(
  projectName: string,
  hours: number,
  amount: number,
  dates?: string[]
): string {
  const line = `Sick leave ${projectName}, ${formatHours(hours)}h, ${formatAmount(amount)}`;
  if (!dates || dates.length === 0) return line;
  return `${line} · ${dates.map(formatDateShort).join(', ')}`;
}

/** Attendance-report project cell: `Sick leave · Salem Al Zaabi 8hrs`. */
export function formatSickLeaveProjectsText(parts: ProjectHoursPart[]): string {
  const merged = mergeProjectParts(parts);
  if (merged.length === 0) return '';
  const inner = merged.map((p) => `${p.name} ${formatHours(p.hours)}hrs`).join(' + ');
  return `Sick leave · ${inner}`;
}

export function effectiveStatusAttendance(att: {
  status_attendance?: string | null;
  notes?: string | null;
}): string {
  const saRaw = att.status_attendance?.trim() ?? '';
  const notesType =
    (att.notes ?? '').match(/Attendance\s+type:\s*(.+?)(?:\n|$)/i)?.[1]?.trim() ?? '';
  return notesType || saRaw;
}

export function formatSickLeaveRowSub(
  hours: number,
  dates?: string[]
): string {
  const dayCount = dates?.length ?? 0;
  const dayLabel = dayCount === 1 ? '1 day' : dayCount > 1 ? `${dayCount} days` : '';
  const parts = [dayLabel, `${formatHours(hours)}h`].filter(Boolean);
  if (dates && dates.length > 0) parts.push(dates.map(formatDateShort).join(', '));
  return parts.join(' · ');
}

/**
 * Walk attendance rows in date order and allocate each SL day's paid hours
 * onto the most recent prior day that has logged project hours.
 */
export function allocateSickLeaveFromAttendanceRows(params: {
  attRows: Array<{
    id: string;
    date: string;
    status: string | null;
    status_attendance?: string | null;
    notes?: string | null;
  }>;
  projectPartsByAttendanceId: Map<string, ProjectHoursPart[]>;
  paidHoursByDate: Map<string, number>;
  lookbackDays?: LookbackWorkDay[];
}): Map<string, ProjectHoursPart[]> {
  const { attRows, projectPartsByAttendanceId, paidHoursByDate, lookbackDays } = params;
  const out = new Map<string, ProjectHoursPart[]>();
  const sorted = [...attRows].sort((a, b) =>
    dateOnly(a.date).localeCompare(dateOnly(b.date))
  );
  const firstDate = sorted[0] ? dateOnly(sorted[0].date) : '9999-99-99';
  let lastWork = latestLookbackProjects(lookbackDays, firstDate);

  for (const att of sorted) {
    const d = dateOnly(att.date);
    const code = statusToCode(att.status, effectiveStatusAttendance(att));
    const parts =
      projectPartsByAttendanceId.get(String(att.id)) ??
      projectPartsByAttendanceId.get(att.id) ??
      [];

    if (code === 'SL') {
      const paid = paidHoursByDate.get(d) ?? 0;
      if (paid > 0 && lastWork.length > 0 && !out.has(d)) {
        out.set(d, allocateSickLeaveHours(paid, lastWork));
      }
      continue;
    }

    if (hasLoggedProjects(parts)) {
      lastWork = mergeProjectParts(parts);
    }
  }

  return out;
}

export function collectSickLeaveEmployeeIds(
  attRows: Array<{
    employee_id: string;
    status: string | null;
    status_attendance?: string | null;
    notes?: string | null;
  }>
): string[] {
  const ids = new Set<string>();
  for (const r of attRows) {
    const sa = effectiveStatusAttendance(r);
    if (statusToCode(r.status, sa) === 'SL') ids.add(r.employee_id);
  }
  return Array.from(ids);
}

type ChargeableProject = {
  workingHours: number;
  sickLeaveHours?: number;
  sickLeaveValue?: number;
  sickLeaveCharges?: { date: string; hours: number; amount: number }[];
};

/**
 * If paid SL hours were not inherited from the previous working day, charge
 * them to the project with the most logged hours in the period so employee
 * and project totals still match.
 */
export function attachUnchargedSickLeaveToLargestProject<T extends ChargeableProject>(
  projects: T[],
  remainingHours: number,
  hourlyRate: number,
  dates: string[]
): T[] {
  if (remainingHours <= 0.01 || projects.length === 0) return projects;
  let best = 0;
  for (let i = 1; i < projects.length; i++) {
    if ((projects[i].workingHours ?? 0) > (projects[best].workingHours ?? 0)) best = i;
  }
  const chargeDates = dates.length > 0 ? dates : [''];
  const hoursEach = remainingHours / chargeDates.length;
  const amountEach = hoursEach * hourlyRate;
  return projects.map((p, i) => {
    if (i !== best) return p;
    const extraCharges = chargeDates.map((date) => ({
      date,
      hours: roundHours(hoursEach),
      amount: amountEach,
    }));
    const sickLeaveHours = (p.sickLeaveHours ?? 0) + remainingHours;
    return {
      ...p,
      sickLeaveHours,
      sickLeaveValue: sickLeaveHours * hourlyRate,
      sickLeaveCharges: [...(p.sickLeaveCharges ?? []), ...extraCharges],
    };
  });
}
