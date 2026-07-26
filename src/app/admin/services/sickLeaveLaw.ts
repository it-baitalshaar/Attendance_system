/**
 * UAE-style calendar-year sick leave pay tiers.
 * Per employee, per calendar year (Jan 1 – Dec 31):
 *   ordinals 1–15  → full pay (8h)
 *   ordinals 16–45 → half pay (4h)
 *   ordinal 46+    → unpaid (0h)
 *
 * Single source of truth — do not duplicate elsewhere.
 */

export const SL_FULL_PAY_DAYS = 15;
export const SL_HALF_PAY_DAYS = 30; // ordinals 16..45
export const SL_FULL_PAY_HOURS = 8;
export const SL_HALF_PAY_HOURS = 4;
export const SL_UNPAID_HOURS = 0;

export type SickLeaveTier = 'full' | 'half' | 'unpaid';

export interface SickLeaveAssignment {
  ordinal: number;
  year: number;
  tier: SickLeaveTier;
  paid_hours: number;
}

export function sickLeaveTierForOrdinal(n: number): SickLeaveTier {
  if (n <= SL_FULL_PAY_DAYS) return 'full';
  if (n <= SL_FULL_PAY_DAYS + SL_HALF_PAY_DAYS) return 'half';
  return 'unpaid';
}

export function sickLeavePaidHours(tier: SickLeaveTier): number {
  if (tier === 'full') return SL_FULL_PAY_HOURS;
  if (tier === 'half') return SL_HALF_PAY_HOURS;
  return SL_UNPAID_HOURS;
}

function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

/**
 * Assigns calendar-year ordinals and pay tiers to period sick-leave days.
 * Prior days (before the report `from`) count toward the ordinal but are not
 * returned in the map — only period days get keys.
 *
 * key = `${employee_id}|${date}` → assignment
 */
export function assignSickLeaveTiers(input: {
  periodSickLeaveDays: { employee_id: string; date: string }[];
  priorSickLeaveDaysByEmployee: Map<string, string[]>;
}): Map<string, SickLeaveAssignment> {
  const { periodSickLeaveDays, priorSickLeaveDaysByEmployee } = input;
  const result = new Map<string, SickLeaveAssignment>();

  // Collect unique dates per employee across prior + period
  const datesByEmployee = new Map<string, Set<string>>();

  for (const [empId, dates] of Array.from(priorSickLeaveDaysByEmployee.entries())) {
    const set = datesByEmployee.get(empId) ?? new Set<string>();
    for (const d of dates) set.add(d);
    datesByEmployee.set(empId, set);
  }

  const periodKeys = new Set<string>();
  for (const { employee_id, date } of periodSickLeaveDays) {
    const set = datesByEmployee.get(employee_id) ?? new Set<string>();
    set.add(date);
    datesByEmployee.set(employee_id, set);
    periodKeys.add(`${employee_id}|${date}`);
  }

  for (const [empId, dateSet] of Array.from(datesByEmployee.entries())) {
    // Bucket by calendar year, sort ascending, index from 1
    const byYear = new Map<number, string[]>();
    for (const d of Array.from(dateSet)) {
      const y = yearOf(d);
      const list = byYear.get(y) ?? [];
      list.push(d);
      byYear.set(y, list);
    }

    for (const [year, dates] of Array.from(byYear.entries())) {
      dates.sort();
      dates.forEach((date, idx) => {
        const key = `${empId}|${date}`;
        if (!periodKeys.has(key)) return; // only emit period days
        const ordinal = idx + 1;
        const tier = sickLeaveTierForOrdinal(ordinal);
        result.set(key, {
          ordinal,
          year,
          tier,
          paid_hours: sickLeavePaidHours(tier),
        });
      });
    }
  }

  return result;
}

/**
 * Build a year-to-date summary for one employee: total SL days used per calendar
 * year (prior + period) and the period-only tier split.
 */
export function summarizeEmployeeSickLeave(input: {
  employeeId: string;
  periodSickLeaveDates: string[];
  priorSickLeaveDates: string[];
  assignments: Map<string, SickLeaveAssignment>;
}): {
  ytd: { year: number; daysUsed: number }[];
  periodDays: number;
  periodFullDays: number;
  periodHalfDays: number;
  periodUnpaidDays: number;
} {
  const { employeeId, periodSickLeaveDates, priorSickLeaveDates, assignments } =
    input;

  const allDates = new Set([...priorSickLeaveDates, ...periodSickLeaveDates]);
  const countByYear = new Map<number, number>();
  for (const d of Array.from(allDates)) {
    const y = yearOf(d);
    countByYear.set(y, (countByYear.get(y) ?? 0) + 1);
  }
  const ytd = Array.from(countByYear.entries())
    .sort(([a], [b]) => a - b)
    .map(([year, daysUsed]) => ({ year, daysUsed }));

  let periodFullDays = 0;
  let periodHalfDays = 0;
  let periodUnpaidDays = 0;
  for (const date of periodSickLeaveDates) {
    const a = assignments.get(`${employeeId}|${date}`);
    if (!a) continue;
    if (a.tier === 'full') periodFullDays++;
    else if (a.tier === 'half') periodHalfDays++;
    else periodUnpaidDays++;
  }

  return {
    ytd,
    periodDays: periodSickLeaveDates.length,
    periodFullDays,
    periodHalfDays,
    periodUnpaidDays,
  };
}
