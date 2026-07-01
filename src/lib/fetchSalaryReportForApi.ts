import { buildSalaryReport } from '@/app/admin/services/salaryReportService';
import type { RawSalaryProjectRow } from '@/app/admin/services/salaryReportService';
import type { RawAttendanceRow, RawEmployeeRow } from '@/app/admin/services/attendanceReportService';
import { buildProjectNameLookup } from '@/lib/projectDisplayName';
import { isUndefinedColumnError } from '@/lib/supabasePostgrestErrors';
import { fetchAttendanceRowsForReport } from '@/lib/fetchAttendanceRowsForReport';
import {
  buildEmployeeDepartmentResolver,
  type EmployeeDepartmentHistoryRow,
} from '@/lib/employeeDepartmentAtDate';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';

const BATCH_SIZE = 80;

async function fetchProjectRows(
  supabase: SupabaseClient,
  tableName: string,
  attendanceIds: string[]
): Promise<{ rows: RawSalaryProjectRow[]; error: PostgrestError | null }> {
  const out: RawSalaryProjectRow[] = [];
  let colSet =
    'attendance_id, project_id, working_hours, overtime_hours, overtime_type, overtime_rate';
  let dropOvertimeRate = false;
  let dropOvertimeType = false;

  for (let i = 0; i < attendanceIds.length; i += BATCH_SIZE) {
    const batch = attendanceIds.slice(i, i + BATCH_SIZE);
    let cols = colSet;
    let { data, error } = await supabase.from(tableName).select(cols).in('attendance_id', batch);

    if (error && !dropOvertimeRate && isUndefinedColumnError(error)) {
      dropOvertimeRate = true;
      colSet = 'attendance_id, project_id, working_hours, overtime_hours, overtime_type';
      cols = colSet;
      ({ data, error } = await supabase.from(tableName).select(cols).in('attendance_id', batch));
    }

    if (error && !dropOvertimeType && isUndefinedColumnError(error)) {
      dropOvertimeType = true;
      colSet = 'attendance_id, project_id, working_hours, overtime_hours';
      cols = colSet;
      ({ data, error } = await supabase.from(tableName).select(cols).in('attendance_id', batch));
    }

    if (error) return { rows: out, error };
    out.push(...((data ?? []) as unknown as RawSalaryProjectRow[]));
  }

  return { rows: out, error: null };
}

export async function fetchSalaryReportForApi(
  supabase: SupabaseClient,
  params: {
    from: string;
    to: string;
    department?: string | null;
    employeeId?: string | null;
  }
) {
  const { from, to, department, employeeId } = params;

  const { rows: attRows, error: attError } = await fetchAttendanceRowsForReport(supabase, {
    from,
    to,
    department,
    employeeId,
  });
  if (attError) {
    return { report: [], from, to, error: attError };
  }
  if (attRows.length === 0) {
    return { report: [], from, to, error: null };
  }

  const attendanceIds = Array.from(
    new Set(
      attRows
        .map((r) => (r.id != null && r.id !== '' ? String(r.id) : null))
        .filter((id): id is string => id != null)
    )
  );

  let attProjRows: RawSalaryProjectRow[] = [];
  if (attendanceIds.length > 0) {
    for (const tableName of ['Attendance_projects', 'attendance_projects'] as const) {
      const { rows, error: fetchErr } = await fetchProjectRows(
        supabase,
        tableName,
        attendanceIds
      );
      if (!fetchErr) {
        attProjRows = rows;
        break;
      }
      const msg = String(fetchErr.message ?? '').toLowerCase();
      const code = String(fetchErr.code ?? '').toUpperCase();
      const missingTable =
        code === '42P01' || msg.includes('does not exist') || msg.includes('not exist');
      if (!missingTable) break;
    }
  }

  const projectIds = Array.from(new Set(attProjRows.map((r) => r.project_id).filter(Boolean)));
  let projectNameById = new Map<string, string>();
  if (projectIds.length > 0) {
    const { data: projRows } = await supabase
      .from('projects')
      .select('project_id, project_name')
      .in('project_id', projectIds);
    projectNameById = buildProjectNameLookup(
      (projRows ?? []) as { project_id: string; project_name: string }[]
    );
  }

  const employeeIds = Array.from(new Set(attRows.map((r) => r.employee_id)));
  const { data: empData, error: empErr } = await supabase
    .from('Employee')
    .select('employee_id, name, department, salary')
    .in('employee_id', employeeIds);

  if (empErr) {
    return { report: [], from, to, error: empErr.message };
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

  const employees = (empData ?? []).map((e: Record<string, unknown>) => ({
    employee_id: e.employee_id as string,
    name: (e.name as string) ?? 'Unknown',
    department: resolveDept(e.employee_id as string, from) || ((e.department as string) ?? null),
    salary: e.salary as number | null | undefined,
  })) as RawEmployeeRow[];

  const report = buildSalaryReport({
    attRows,
    attProjRows,
    projectNameById,
    employees,
    fromDate: from,
    toDate: to,
  });

  return { report, from, to, error: null };
}
