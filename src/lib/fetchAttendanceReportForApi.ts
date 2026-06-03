import { buildAttendanceReport } from '@/app/admin/services/attendanceReportService';
import type {
  RawAttendanceRow,
  RawAttendanceProjectRow,
  RawEmployeeRow,
} from '@/app/admin/services/attendanceReportService';
import { buildProjectNameLookup } from '@/lib/projectDisplayName';
import { isUndefinedColumnError } from '@/lib/supabasePostgrestErrors';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function fetchAttendanceReportForApi(
  supabase: SupabaseClient,
  params: { from: string; to: string; department?: string | null; employeeId?: string | null }
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
    if (filterEmployeeIds.length === 0) return { report: [], from, to, error: null as string | null };
  }

  let attQuery = supabase
    .from('Attendance')
    .select('id, employee_id, date, status, status_attendance, notes')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true });
  if (filterEmployeeIds?.length) attQuery = attQuery.in('employee_id', filterEmployeeIds);

  const { data: attData, error: attError } = await attQuery;
  if (attError) return { report: [], from, to, error: attError.message };

  const attRows = (attData ?? []) as RawAttendanceRow[];
  if (attRows.length === 0) return { report: [], from, to, error: null };

  const attendanceIds = Array.from(
    new Set(
      attRows
        .map((r) => (r.id != null && r.id !== '' ? String(r.id) : null))
        .filter((id): id is string => id != null)
    )
  );

  let attProj: RawAttendanceProjectRow[] = [];
  const BATCH = 80;
  for (const tableName of ['Attendance_projects', 'attendance_projects'] as const) {
    let useOtType = true;
    for (let i = 0; i < attendanceIds.length; i += BATCH) {
      const batch = attendanceIds.slice(i, i + BATCH);
      let sel = useOtType
        ? 'attendance_id, project_id, working_hours, overtime_hours, overtime_type'
        : 'attendance_id, project_id, working_hours, overtime_hours';
      let { data, error } = await supabase.from(tableName).select(sel).in('attendance_id', batch);
      if (error && useOtType && isUndefinedColumnError(error)) {
        useOtType = false;
        sel = 'attendance_id, project_id, working_hours, overtime_hours';
        ({ data, error } = await supabase.from(tableName).select(sel).in('attendance_id', batch));
      }
      if (error) break;
      attProj.push(...((data ?? []) as unknown as RawAttendanceProjectRow[]));
    }
    if (attProj.length > 0 || attendanceIds.length === 0) break;
  }

  const projectIds = Array.from(new Set(attProj.map((r) => r.project_id).filter(Boolean)));
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
  const { data: empRows, error: empErr } = await supabase
    .from('Employee')
    .select('employee_id, name, department, salary')
    .in('employee_id', employeeIds);
  if (empErr) return { report: [], from, to, error: empErr.message };

  const employees = (empRows ?? []).map((e: Record<string, unknown>) => ({
    employee_id: e.employee_id as string,
    name: (e.name as string) ?? 'Unknown',
    department: (e.department as string) ?? null,
    salary: e.salary as number | null | undefined,
  })) as RawEmployeeRow[];

  const report = buildAttendanceReport({
    attRows,
    attProjRows: attProj,
    projectNameById,
    employees,
  });
  return { report, from, to, error: null };
}
