/**
 * Fetch project allocations from the days immediately before the report period.
 * Used so a Sick Leave day on (or near) the first day of a payroll period can
 * inherit the previous working day's project.
 *
 * Errors are non-fatal: returns an empty map so the report still renders.
 */

import type { LookbackWorkDay } from '@/app/admin/services/inheritSickLeaveProjects';
import { mergeProjectParts } from '@/app/admin/services/inheritSickLeaveProjects';
import { buildProjectNameLookup, resolveProjectDisplayName } from '@/lib/projectDisplayName';
import { isUndefinedColumnError } from '@/lib/supabasePostgrestErrors';
import type { SupabaseClient } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;
const EMPLOYEE_BATCH = 80;
const PROJECT_BATCH = 80;
/** Cover a long weekend + a stretch of SL at the start of a payroll period. */
const LOOKBACK_DAYS = 45;

function addDaysIso(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

async function fetchProjectRowsForIds(
  supabase: SupabaseClient,
  attendanceIds: string[]
): Promise<{ attendance_id: string; project_id: string; working_hours: number }[]> {
  const out: { attendance_id: string; project_id: string; working_hours: number }[] = [];
  if (attendanceIds.length === 0) return out;

  const cols = 'attendance_id, project_id, working_hours';
  for (const tableName of ['Attendance_projects', 'attendance_projects'] as const) {
    let failed = false;
    const rows: typeof out = [];
    for (let i = 0; i < attendanceIds.length; i += PROJECT_BATCH) {
      const batch = attendanceIds.slice(i, i + PROJECT_BATCH);
      const { data, error } = await supabase
        .from(tableName)
        .select(cols)
        .in('attendance_id', batch);
      if (error) {
        const msg = String(error.message ?? '').toLowerCase();
        const code = String(error.code ?? '').toUpperCase();
        const missingTable =
          code === '42P01' || msg.includes('does not exist') || msg.includes('not exist');
        if (missingTable) {
          failed = true;
          break;
        }
        console.warn(
          '[fetchPriorWorkProjectsForSickLeave] project query failed (non-fatal):',
          error.message
        );
        return out;
      }
      rows.push(
        ...((data ?? []) as { attendance_id: string; project_id: string; working_hours: number }[])
      );
    }
    if (!failed) return rows;
  }
  return out;
}

/**
 * Returns Map<employee_id, work days with projects> for dates in
 * [from − 45 days, from) for the given employees.
 */
export async function fetchPriorWorkProjectsForSickLeave(
  supabase: SupabaseClient,
  params: { from: string; employeeIds: string[] }
): Promise<Map<string, LookbackWorkDay[]>> {
  const out = new Map<string, LookbackWorkDay[]>();
  const { from, employeeIds } = params;
  if (!from || employeeIds.length === 0) return out;

  const lookbackFrom = addDaysIso(from, -LOOKBACK_DAYS);
  const lookbackTo = addDaysIso(from, -1);
  if (lookbackTo < lookbackFrom) return out;

  try {
    const attRows: { id: string; employee_id: string; date: string }[] = [];
    for (let i = 0; i < employeeIds.length; i += EMPLOYEE_BATCH) {
      const batch = employeeIds.slice(i, i + EMPLOYEE_BATCH);
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from('Attendance')
          .select('id, employee_id, date')
          .gte('date', lookbackFrom)
          .lte('date', lookbackTo)
          .in('employee_id', batch)
          .order('date', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
          if (isUndefinedColumnError(error)) return out;
          console.warn(
            '[fetchPriorWorkProjectsForSickLeave] attendance query failed (non-fatal):',
            error.message
          );
          return out;
        }

        const rows = (data ?? []) as { id: string; employee_id: string; date: string }[];
        attRows.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
    }

    if (attRows.length === 0) return out;

    const attendanceIds = Array.from(
      new Set(attRows.map((r) => (r.id != null && r.id !== '' ? String(r.id) : '')).filter(Boolean))
    );
    const projRows = await fetchProjectRowsForIds(supabase, attendanceIds);
    if (projRows.length === 0) return out;

    const projectIds = Array.from(new Set(projRows.map((r) => r.project_id).filter(Boolean)));
    let lookup = new Map<string, string>();
    if (projectIds.length > 0) {
      const { data: projMeta } = await supabase
        .from('projects')
        .select('project_id, project_name')
        .in('project_id', projectIds);
      lookup = buildProjectNameLookup(
        (projMeta ?? []) as { project_id: string; project_name: string }[]
      );
    }

    const attById = new Map(attRows.map((r) => [String(r.id), r]));
    const partsByEmpDate = new Map<string, { empId: string; date: string; parts: LookbackWorkDay['projectParts'] }>();

    for (const p of projRows) {
      const att = attById.get(String(p.attendance_id));
      if (!att) continue;
      const name = resolveProjectDisplayName(p.project_id, lookup);
      const key = `${att.employee_id}|${att.date}`;
      const existing = partsByEmpDate.get(key);
      const part = { name, hours: Number(p.working_hours ?? 0) };
      if (existing) {
        existing.parts.push(part);
      } else {
        partsByEmpDate.set(key, {
          empId: att.employee_id,
          date: att.date,
          parts: [part],
        });
      }
    }

    for (const { empId, date, parts } of Array.from(partsByEmpDate.values())) {
      const merged = mergeProjectParts(parts);
      if (merged.length === 0) continue;
      const list = out.get(empId) ?? [];
      list.push({ date, projectParts: merged });
      out.set(empId, list);
    }

    for (const [empId, days] of Array.from(out.entries())) {
      days.sort((a, b) => a.date.localeCompare(b.date));
      out.set(empId, days);
    }
  } catch (err) {
    console.warn('[fetchPriorWorkProjectsForSickLeave] unexpected error (non-fatal):', err);
  }

  return out;
}
