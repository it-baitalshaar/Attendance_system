/**
 * Vacation periods for the Attendance / Salary report period.
 *
 * Returns Map<employee_id, { from_date, to_date, note }[]> for ranges that
 * overlap [from, to]. `buildAttendanceReport` then adds any day inside a period
 * that has no Attendance row as a V (Vacation) day, so it is counted as vacation
 * and never reported as "no attendance record".
 *
 * Errors are non-fatal (empty map) — the report still renders when the
 * `employee_vacations` migration has not been applied yet.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

const EMPLOYEE_BATCH = 100;

export interface VacationRange {
  from_date: string;
  to_date: string;
  note?: string | null;
}

function toDateOnly(value: unknown): string {
  return String(value ?? '').trim().slice(0, 10);
}

export async function fetchEmployeeVacationsForReport(
  supabase: SupabaseClient,
  params: { from: string; to: string; employeeIds: string[] }
): Promise<Map<string, VacationRange[]>> {
  const out = new Map<string, VacationRange[]>();
  const { from, to, employeeIds } = params;

  if (!from || !to || employeeIds.length === 0) return out;

  try {
    for (let i = 0; i < employeeIds.length; i += EMPLOYEE_BATCH) {
      const batch = employeeIds.slice(i, i + EMPLOYEE_BATCH);

      // Overlap test: a range counts when it starts on/before `to` and ends on/after `from`.
      const { data, error } = await supabase
        .from('employee_vacations')
        .select('employee_id, from_date, to_date, note')
        .in('employee_id', batch)
        .lte('from_date', to)
        .gte('to_date', from);

      if (error) {
        console.warn('[fetchEmployeeVacationsForReport] query failed (non-fatal):', error.message);
        return out;
      }

      for (const row of (data ?? []) as {
        employee_id?: string | null;
        from_date?: string | null;
        to_date?: string | null;
        note?: string | null;
      }[]) {
        const employeeId = String(row.employee_id ?? '');
        const rangeFrom = toDateOnly(row.from_date);
        const rangeTo = toDateOnly(row.to_date);
        if (!employeeId || !rangeFrom || !rangeTo) continue;

        const list = out.get(employeeId) ?? [];
        list.push({ from_date: rangeFrom, to_date: rangeTo, note: row.note ?? null });
        out.set(employeeId, list);
      }
    }

    // Stable order so synthesized rows are deterministic.
    for (const [employeeId, ranges] of Array.from(out.entries())) {
      out.set(
        employeeId,
        ranges.sort((a, b) => a.from_date.localeCompare(b.from_date))
      );
    }
  } catch (err) {
    console.warn('[fetchEmployeeVacationsForReport] unexpected error (non-fatal):', err);
  }

  return out;
}
