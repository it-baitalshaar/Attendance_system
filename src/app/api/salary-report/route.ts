/**
 * GET /api/salary-report?from=YYYY-MM-DD&to=YYYY-MM-DD[&department=X][&employee_id=Y]
 *
 * Returns monthly salary + project cost breakdown per employee.
 * Read-only: same tables as attendance-report (Attendance, Attendance_projects,
 * projects, Employee). Tries to fetch overtime_rate from Attendance_projects;
 * falls back gracefully if the column doesn't exist.
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerComponentClient } from '@/lib/supabaseAppRouterClient';
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
  // Try with overtime_rate first, fall back without it, then without overtime_type
  let colSet = 'attendance_id, project_id, working_hours, overtime_hours, overtime_type, overtime_rate';
  let dropOvertimeRate = false;
  let dropOvertimeType = false;

  for (let i = 0; i < attendanceIds.length; i += BATCH_SIZE) {
    const batch = attendanceIds.slice(i, i + BATCH_SIZE);
    let cols = colSet;
    let { data, error } = await supabase.from(tableName).select(cols).in('attendance_id', batch);

    // overtime_rate column might not exist
    if (error && !dropOvertimeRate && isUndefinedColumnError(error)) {
      dropOvertimeRate = true;
      colSet = 'attendance_id, project_id, working_hours, overtime_hours, overtime_type';
      cols = colSet;
      ({ data, error } = await supabase.from(tableName).select(cols).in('attendance_id', batch));
    }

    // overtime_type column might not exist either
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get('from');
  const toDate = searchParams.get('to');

  if (!fromDate || !toDate) {
    return NextResponse.json(
      { error: 'Query params "from" and "to" (YYYY-MM-DD) are required' },
      { status: 400 }
    );
  }

  const from = fromDate.includes('T') ? fromDate.split('T')[0] : fromDate;
  const to = toDate.includes('T') ? toDate.split('T')[0] : toDate;
  const department = searchParams.get('department')?.trim() || null;
  const employeeId = searchParams.get('employee_id')?.trim() || null;

  try {
    const supabase = createSupabaseServerComponentClient();

    // Resolve employee filter
    let filterEmployeeIds: string[] | null = null;
    if (employeeId) {
      filterEmployeeIds = [employeeId];
    } else if (department) {
      const { data: empList } = await supabase
        .from('Employee')
        .select('employee_id')
        .eq('department', department);
      filterEmployeeIds = (empList ?? []).map(
        (e: { employee_id: string }) => e.employee_id
      );
      if (filterEmployeeIds.length === 0) {
        return NextResponse.json({ report: [], from, to });
      }
    }

    // Fetch attendance rows
    let attQuery = supabase
      .from('Attendance')
      .select('id, employee_id, date, status, status_attendance, notes')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });

    if (filterEmployeeIds && filterEmployeeIds.length > 0) {
      attQuery = attQuery.in('employee_id', filterEmployeeIds);
    }

    const { data: attData, error: attError } = await attQuery;
    if (attError) {
      console.error('[salary-report] Attendance fetch error:', attError);
      return NextResponse.json(
        { error: 'Failed to fetch attendance', details: attError.message },
        { status: 500 }
      );
    }

    const attRows = (attData ?? []) as RawAttendanceRow[];
    if (attRows.length === 0) {
      return NextResponse.json({ report: [], from, to });
    }

    const attendanceIds = Array.from(
      new Set(
        attRows
          .map((r) => (r.id != null && r.id !== '' ? String(r.id) : null))
          .filter((id): id is string => id != null)
      )
    );

    // Fetch project rows from whichever table exists
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
          code === '42P01' ||
          msg.includes('does not exist') ||
          msg.includes('not exist');
        if (!missingTable) break; // real error, stop
      }
    }

    // Project name lookup
    const projectIds = Array.from(
      new Set(attProjRows.map((r) => r.project_id).filter(Boolean))
    );
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

    // Employee data
    const employeeIds = Array.from(new Set(attRows.map((r) => r.employee_id)));
    const { data: empData, error: empErr } = await supabase
      .from('Employee')
      .select('employee_id, name, department, salary')
      .in('employee_id', employeeIds);
    if (empErr) {
      console.error('[salary-report] Employee fetch error:', empErr);
      return NextResponse.json(
        { error: 'Failed to fetch employees', details: empErr.message },
        { status: 500 }
      );
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
    });

    return NextResponse.json({ report, from, to });
  } catch (err) {
    console.error('[salary-report] Server error:', err);
    return NextResponse.json(
      { error: 'Server error generating salary report', details: String(err) },
      { status: 500 }
    );
  }
}
