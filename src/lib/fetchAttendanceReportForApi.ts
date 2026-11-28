import { buildAttendanceReport } from '@/app/admin/services/attendanceReportService';
import type {
  RawAttendanceRow,
  RawAttendanceProjectRow,
  RawEmployeeRow,
} from '@/app/admin/services/attendanceReportService';
import { buildProjectNameLookup } from '@/lib/projectDisplayName';
import { isUndefinedColumnError } from '@/lib/supabasePostgrestErrors';
import { fetchAttendanceRowsForReport } from '@/lib/fetchAttendanceRowsForReport';
import { fetchPriorSickLeaveDays } from '@/lib/fetchPriorSickLeaveDays';
import { fetchPriorWorkProjectsForSickLeave } from '@/lib/fetchPriorWorkProjectsForSickLeave';
import { fetchEmployeeVacationsForReport } from '@/lib/fetchEmployeeVacations';
import { collectSickLeaveEmployeeIds } from '@/app/admin/services/inheritSickLeaveProjects';
import {
  buildEmployeeDepartmentResolver,
  type EmployeeDepartmentHistoryRow,
} from '@/lib/employeeDepartmentAtDate';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function fetchAttendanceReportForApi(
  supabase: SupabaseClient,
  params: {
    from: string;
    to: string;
    department?: string | null;
    employeeId?: string | null;
    employeeIds?: string[] | null;
  }
) {
  const { from, to, department, employeeId, employeeIds: filterEmployeeIds } = params;

  const { rows: attRows, error: attError } = await fetchAttendanceRowsForReport(supabase, {
    from,
    to,
    department,
    employeeId,
    employeeIds: filterEmployeeIds,
  });
  if (attError) return { report: [], from, to, error: attError };
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
  const vacationsByEmployee = await fetchEmployeeVacationsForReport(supabase, {
    from,
    to,
    employeeIds,
  });
  const priorSickLeaveDaysByEmployee = await fetchPriorSickLeaveDays(supabase, {
    from,
    employeeIds,
  });
  const lookbackWorkDaysByEmployee = await fetchPriorWorkProjectsForSickLeave(supabase, {
    from,
    employeeIds: collectSickLeaveEmployeeIds(attRows),
  });
  const empSelect = (cols: string) =>
    supabase
      .from('Employee')
      .select(cols)
      .in('employee_id', employeeIds) as unknown as Promise<{
      data: Record<string, unknown>[] | null;
      error: { message: string; code?: string } | null;
    }>;

  let { data: empRows, error: empErr } = await empSelect(
    'employee_id, name, department, salary, overtime_enabled, joining_date'
  );
  // Joining-date migration not applied yet — fall back to the always-present columns.
  if (empErr && isUndefinedColumnError(empErr)) {
    ({ data: empRows, error: empErr } = await empSelect(
      'employee_id, name, department, salary, overtime_enabled'
    ));
  }
  if (empErr) return { report: [], from, to, error: empErr.message };

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
    (empRows ?? []) as { employee_id: string; department?: string | null }[],
    history
  );

  const employees = (empRows ?? []).map((e: Record<string, unknown>) => ({
    employee_id: e.employee_id as string,
    name: (e.name as string) ?? 'Unknown',
    department: resolveDept(e.employee_id as string, from) || ((e.department as string) ?? null),
    salary: e.salary as number | null | undefined,
    overtime_enabled: e.overtime_enabled as boolean | null | undefined,
    joining_date: (e.joining_date as string | null | undefined) ?? null,
  })) as RawEmployeeRow[];

  const report = buildAttendanceReport({
    attRows,
    attProjRows: attProj,
    projectNameById,
    employees,
    priorSickLeaveDaysByEmployee,
    lookbackWorkDaysByEmployee,
    vacationsByEmployee,
    periodFrom: from,
    periodTo: to,
  });
  return { report, from, to, error: null };
}
