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

async function queryAttendanceInRange(
  supabase: SupabaseClient,
  from: string,
  to: string,
  employeeId?: string | null
): Promise<{ rows: RawAttendanceRow[]; error: string | null }> {
  const run = (cols: string) => {
    let q = supabase
      .from('Attendance')
      .select(cols)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });
    if (employeeId) q = q.eq('employee_id', employeeId);
    return q;
  };

  const withDept = await run(ATTENDANCE_COLS_WITH_DEPT);
  if (!withDept.error) {
    return { rows: (withDept.data ?? []) as unknown as RawAttendanceRow[], error: null };
  }
  if (!isUndefinedColumnError(withDept.error)) {
    return { rows: [], error: withDept.error.message };
  }

  const base = await run(ATTENDANCE_COLS_BASE);
  if (base.error) {
    return { rows: [], error: base.error.message };
  }
  return { rows: (base.data ?? []) as unknown as RawAttendanceRow[], error: null };
}

export async function fetchAttendanceRowsForReport(
  supabase: SupabaseClient,
  params: {
    from: string;
    to: string;
    department?: string | null;
    employeeId?: string | null;
  }
): Promise<{ rows: RawAttendanceRow[]; error: string | null }> {
  const { from, to, department, employeeId } = params;

  const { rows: initialRows, error } = await queryAttendanceInRange(
    supabase,
    from,
    to,
    employeeId
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
