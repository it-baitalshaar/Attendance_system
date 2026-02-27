/**
 * GET /api/attendance-report?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Read-only: fetches from existing Attendance, Attendance_projects, projects, Employee.
 * No DB changes.
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerComponentClient } from '@/lib/supabaseAppRouterClient';
import { buildAttendanceReport } from '@/app/admin/services/attendanceReportService';
import type { RawAttendanceRow, RawAttendanceProjectRow, RawEmployeeRow } from '@/app/admin/services/attendanceReportService';

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
        return NextResponse.json({ report: [], from, to });
      }
    }

    let attQuery = supabase
      .from('Attendance')
      .select('id, employee_id, date, status, status_attendance, notes')
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true });

    if (filterEmployeeIds && filterEmployeeIds.length > 0) {
      attQuery = attQuery.in('employee_id', filterEmployeeIds);
    }

    const { data: attRows, error: attError } = await attQuery;

    if (attError) {
      console.error('Attendance fetch error:', attError);
      return NextResponse.json(
        { error: 'Failed to fetch attendance', details: attError.message },
        { status: 500 }
      );
    }

    const rows = (attRows ?? []) as RawAttendanceRow[];
    if (rows.length === 0) {
      return NextResponse.json({
        report: [],
        from: from,
        to: to,
      });
    }

    const attendanceIds = Array.from(
      new Set(
        rows
          .map((r) => (r.id != null && r.id !== '' ? String(r.id) : null))
          .filter((id): id is string => id != null)
      )
    );

    // Fetch attendance projects in batches to avoid "Bad Request" from long .in() lists
    const tableNames = ['Attendance_projects', 'attendance_projects'] as const;
    let attProj: RawAttendanceProjectRow[] = [];
    let projectsError: string | null = null;
    const BATCH_SIZE = 80;

    if (attendanceIds.length > 0) {
      for (const tableName of tableNames) {
        attProj = [];
        projectsError = null;
        let batchSucceeded = true;

        for (let i = 0; i < attendanceIds.length; i += BATCH_SIZE) {
          const batch = attendanceIds.slice(i, i + BATCH_SIZE);
          const { data: attProjRows, error: err } = await supabase
            .from(tableName)
            .select('attendance_id, project_id, working_hours, overtime_hours')
            .in('attendance_id', batch);

          if (err) {
            projectsError = err.message ?? String(err);
            batchSucceeded = false;
            const msg = String(err.message || '').toLowerCase();
            const code = (err as { code?: string }).code;
            if (msg.includes('does not exist') || msg.includes('not exist') || code === '42P01') {
              break;
            }
            break;
          }
          attProj.push(...((attProjRows ?? []) as RawAttendanceProjectRow[]));
        }

        if (batchSucceeded && attProj.length >= 0) {
          projectsError = null;
          break;
        }
        if (projectsError) {
          const msg = String(projectsError).toLowerCase();
          if (!msg.includes('does not exist') && !msg.includes('not exist')) {
            break;
          }
        }
      }

      if (projectsError && attProj.length === 0) {
        console.warn('[attendance-report] Could not load attendance projects:', projectsError);
      }
    }
    const projectIds = Array.from(
      new Set(attProj.map((r) => r.project_id).filter(Boolean))
    );

    const projectNameById = new Map<string, string>();
    if (projectIds.length > 0) {
      const { data: projRows } = await supabase
        .from('projects')
        .select('project_id, project_name')
        .in('project_id', projectIds);
      (projRows ?? []).forEach(
        (p: { project_id: string; project_name: string }) =>
          projectNameById.set(p.project_id, p.project_name ?? 'Unknown')
      );
    }

    const employeeIds = Array.from(new Set(rows.map((r) => r.employee_id)));
    const { data: empRows, error: empErr } = await supabase
      .from('Employee')
      .select('employee_id, name, department, salary')
      .in('employee_id', employeeIds);

    if (empErr) {
      console.error('Employee fetch error:', empErr);
      return NextResponse.json(
        { error: 'Failed to fetch employees', details: empErr.message },
        { status: 500 }
      );
    }

    const employees = (empRows ?? []).map((e: Record<string, unknown>) => ({
      employee_id: e.employee_id as string,
      name: (e.name as string) ?? 'Unknown',
      department: (e.department as string) ?? null,
      salary: e.salary as number | null | undefined,
    })) as RawEmployeeRow[];

    const report = buildAttendanceReport({
      attRows: rows,
      attProjRows: attProj,
      projectNameById,
      employees,
    });

    return NextResponse.json({
      report,
      from,
      to,
      ...(projectsError && attProj.length === 0 && { projectsUnavailable: true, projectsError }),
    });
  } catch (err) {
    console.error('Attendance report error:', err);
    return NextResponse.json(
      { error: 'Server error generating report', details: String(err) },
      { status: 500 }
    );
  }
}
