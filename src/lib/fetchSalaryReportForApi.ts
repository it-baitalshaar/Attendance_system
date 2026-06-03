import { buildSalaryReport } from '@/app/admin/services/salaryReportService';
import type { RawSalaryProjectRow } from '@/app/admin/services/salaryReportService';
import type { RawAttendanceRow, RawEmployeeRow } from '@/app/admin/services/attendanceReportService';
import { buildProjectNameLookup } from '@/lib/projectDisplayName';
import { isUndefinedColumnError } from '@/lib/supabasePostgrestErrors';
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

  let filterEmployeeIds: string[] | null = null;
  if (employeeId) {
    filterEmployeeIds = [employeeId];
  } else if (department) {
    const { data: empList } = await supabase
      .from('Employee')
      .select('employee_id')
      .eq('department', department);
    filterEmployeeIds = (empList ?? []).map((e: { employee_id: string }) => e.employee_id);
    if (filterEmployeeIds.length === 0) {
      return { report: [], from, to, error: null as string | null };
    }
  }

  let attQuery = supabase
    .from('Attendance')
    .select('id, employee_id, date, status, status_attendance, notes')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true });

  if (filterEmployeeIds?.length) {
    attQuery = attQuery.in('employee_id', filterEmployeeIds);
  }

  const { data: attData, error: attError } = await attQuery;
  if (attError) {
    return { report: [], from, to, error: attError.message };
  }

  const attRows = (attData ?? []) as RawAttendanceRow[];
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

  const employees = (empData ?? []).map((e: Record<string, unknown>) => ({
    employee_id: e.employee_id as string,
    name: (e.name as string) ?? 'Unknown',
    department: (e.department as string) ?? null,
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
