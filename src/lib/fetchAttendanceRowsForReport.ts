import {
  buildEmployeeDepartmentResolver,
  filterAttendanceRowsByDepartment,
  type EmployeeDepartmentHistoryRow,
} from '@/lib/employeeDepartmentAtDate';
import { isUndefinedColumnError } from '@/lib/supabasePostgrestErrors';
import type { RawAttendanceRow } from '@/app/admin/services/attendanceReportService';
import type { SupabaseClient } from '@supabase/supabase-js';

const ATTENDANCE_COLS_WITH_DEPT =
  'id, employee_id, date, status, status_attendance, notes, department';
const ATTENDANCE_COLS_BASE =
  'id, employee_id, date, status, status_attendance, notes';

/** PostgREST/Supabase default max rows per request; must page past this. */
const PAGE_SIZE = 1000;

function normalizeEmployeeIds(params: {
  employeeId?: string | null;
  employeeIds?: string[] | null;
}): string[] | null {
  if (params.employeeIds && params.employeeIds.length > 0) {
    const ids = params.employeeIds.map((id) => id.trim()).filter(Boolean);
    return ids.length > 0 ? ids : null;
  }
  const raw = params.employeeId?.trim();
  if (!raw) return null;
  const ids = raw.split(',').map((id) => id.trim()).filter(Boolean);
  return ids.length > 0 ? ids : null;
}

async function queryAttendanceInRange(
  supabase: SupabaseClient,
  from: string,
  to: string,
  employeeIds?: string[] | null
): Promise<{ rows: RawAttendanceRow[]; error: string | null }> {
  let cols = ATTENDANCE_COLS_WITH_DEPT;
  let triedWithoutDeptCol = false;
  const all: RawAttendanceRow[] = [];
  let offset = 0;

  while (true) {
    let q = supabase
      .from('Attendance')
      .select(cols)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (employeeIds && employeeIds.length === 1) {
      q = q.eq('employee_id', employeeIds[0]);
    } else if (employeeIds && employeeIds.length > 1) {
      q = q.in('employee_id', employeeIds);
    }

    const { data, error } = await q;

    if (error && !triedWithoutDeptCol && isUndefinedColumnError(error)) {
      triedWithoutDeptCol = true;
      cols = ATTENDANCE_COLS_BASE;
      all.length = 0;
      offset = 0;
      continue;
    }
    if (error) {
      return { rows: [], error: error.message };
    }

    const batch = (data ?? []) as unknown as RawAttendanceRow[];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return { rows: all, error: null };
}

export async function fetchAttendanceRowsForReport(
  supabase: SupabaseClient,
  params: {
    from: string;
    to: string;
    department?: string | null;
    /** Single employee filter (legacy). Prefer `employeeIds`. */
    employeeId?: string | null;
    /** One or more employee IDs. Empty/null = all employees. */
    employeeIds?: string[] | null;
  }
): Promise<{ rows: RawAttendanceRow[]; error: string | null }> {
  const { from, to, department } = params;
  const filterEmployeeIds = normalizeEmployeeIds(params);

  const { rows: initialRows, error } = await queryAttendanceInRange(
    supabase,
    from,
    to,
    filterEmployeeIds
  );
  if (error) return { rows: [], error };

  let rows = initialRows;
  if (rows.length === 0 || !department?.trim()) {
    return { rows, error: null };
  }

  const employeeIds = Array.from(new Set(rows.map((r) => r.employee_id)));

  const { data: empData, error: empErr } = await supabase
    .from('Employee')
    .select('employee_id, department')
    .in('employee_id', employeeIds);

  if (empErr) {
    return { rows: [], error: empErr.message };
  }

  let history: EmployeeDepartmentHistoryRow[] = [];
  const { data: historyData, error: historyErr } = await supabase
    .from('Employee_history')
    .select('employee_id, created_at, details')
    .in('employee_id', employeeIds)
    .order('created_at', { ascending: true });

  if (!historyErr) {
    history = (historyData ?? []) as EmployeeDepartmentHistoryRow[];
  }

  const resolveDept = buildEmployeeDepartmentResolver(
    (empData ?? []) as { employee_id: string; department?: string | null }[],
    history
  );

  rows = filterAttendanceRowsByDepartment(rows, department, resolveDept);
  return { rows, error: null };
}
