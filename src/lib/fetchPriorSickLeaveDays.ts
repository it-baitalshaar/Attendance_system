/**
 * Fetch sick-leave days that fall before the report period but within the same
 * calendar year as `from`. Used so SL law ordinals continue correctly across
 * payroll periods (days 1–15 full, 16–45 half, 46+ unpaid).
 *
 * Errors are non-fatal: returns an empty map so the report still renders.
 */

import { statusToCode } from '@/app/admin/types/attendanceReport';
import type { SupabaseClient } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;
const EMPLOYEE_BATCH = 100;

function effectiveStatusAttendance(
  status_attendance: string | null | undefined,
  notes: string | null | undefined
): string {
  const saRaw = status_attendance?.trim() ?? '';
  const notesType =
    (notes ?? '').match(/Attendance\s+type:\s*(.+?)(?:\n|$)/i)?.[1]?.trim() ??
    '';
  return notesType || saRaw;
}

function isSickLeaveRow(row: {
  status: string | null;
  status_attendance: string | null;
  notes: string | null;
}): boolean {
  const sa = effectiveStatusAttendance(row.status_attendance, row.notes);
  return statusToCode(row.status, sa) === 'SL';
}

/**
 * Day before `yyyy-mm-dd` (UTC calendar math). Returns null if already Jan 1.
 */
function dayBefore(isoDate: string): string | null {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * Returns Map<employee_id, sorted unique SL dates> for dates in
 * [Jan 1 of from-year, from) for the given employees.
 */
export async function fetchPriorSickLeaveDays(
  supabase: SupabaseClient,
  params: { from: string; employeeIds: string[] }
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const { from, employeeIds } = params;

  if (!from || employeeIds.length === 0) return out;

  const yearStart = `${from.slice(0, 4)}-01-01`;
  if (from <= yearStart) return out; // nothing prior in this year

  const priorTo = dayBefore(from);
  if (!priorTo || priorTo < yearStart) return out;

  const cols = 'employee_id, date, status, status_attendance, notes';

  try {
    for (let i = 0; i < employeeIds.length; i += EMPLOYEE_BATCH) {
      const batch = employeeIds.slice(i, i + EMPLOYEE_BATCH);
      let offset = 0;

      while (true) {
        const { data, error } = await supabase
          .from('Attendance')
          .select(cols)
          .eq('status', 'absent')
          .gte('date', yearStart)
          .lte('date', priorTo)
          .in('employee_id', batch)
          .order('date', { ascending: true })
          .order('employee_id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
          console.warn(
            '[fetchPriorSickLeaveDays] query failed (non-fatal):',
            error.message
          );
          return out;
        }

        const rows = (data ?? []) as {
          employee_id: string;
          date: string;
          status: string | null;
          status_attendance: string | null;
          notes: string | null;
        }[];

        for (const row of rows) {
          if (!isSickLeaveRow(row)) continue;
          const list = out.get(row.employee_id) ?? [];
          if (!list.includes(row.date)) list.push(row.date);
          out.set(row.employee_id, list);
        }

        if (rows.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
    }

    // Ensure sorted unique dates
    for (const [empId, dates] of Array.from(out.entries())) {
      out.set(empId, Array.from(new Set(dates)).sort());
    }
  } catch (err) {
    console.warn('[fetchPriorSickLeaveDays] unexpected error (non-fatal):', err);
  }

  return out;
}
