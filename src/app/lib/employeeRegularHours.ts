/**
 * Regular (non-overtime) hours cap for employees with overtime disabled
 * (e.g. foremen / supervisors). Overtime is always zero for these employees.
 */

export function maxRegularHoursForStatus(statusEmployee: string | null | undefined): number {
  const s = (statusEmployee ?? '').trim();
  if (s === 'Half Day AM') return 4.5;
  if (s === 'Half Day PM') return 3.5;
  return 8;
}

export function sumPositiveHours(hours: number[]): number {
  return hours.reduce((sum, h) => sum + (h > 0 ? h : 0), 0);
}

/**
 * When total regular hours exceed max, scale down (last row absorbs rounding remainder).
 */
export function capRegularHoursAcrossProjects(hours: number[], maxTotal: number): number[] {
  const total = sumPositiveHours(hours);
  if (total <= maxTotal) return [...hours];

  const positive = hours.map((h, i) => ({ h, i })).filter(({ h }) => h > 0);
  if (positive.length === 0) return hours.map(() => 0);

  const out = [...hours];
  if (positive.length === 1) {
    out[positive[0].i] = maxTotal;
    return out;
  }

  let allocated = 0;
  for (let j = 0; j < positive.length; j++) {
    const { h, i } = positive[j];
    if (j === positive.length - 1) {
      out[i] = Math.max(0, Math.round((maxTotal - allocated) * 100) / 100);
    } else {
      const scaled = Math.floor((h / total) * maxTotal * 100) / 100;
      out[i] = scaled;
      allocated += scaled;
    }
  }
  return out;
}

export interface ProjectHoursRow {
  hours: number;
  overtime?: number;
}

export function enforceNoOvertimeRegularHoursCap<T extends ProjectHoursRow>(
  rows: T[],
  maxTotal: number
): { rows: T[]; tthour: number } {
  const hours = rows.map((r) => Number(r.hours) || 0);
  const capped = capRegularHoursAcrossProjects(hours, maxTotal);
  const newRows = rows.map((r, i) => ({
    ...r,
    hours: capped[i],
    overtime: 0,
  }));
  return { rows: newRows, tthour: sumPositiveHours(capped) };
}
