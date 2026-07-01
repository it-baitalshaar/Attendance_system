/**
 * GET /api/salary-report?from=YYYY-MM-DD&to=YYYY-MM-DD[&department=X][&employee_id=Y]
 *
 * Returns monthly salary + project cost breakdown per employee.
 * Department filter uses historical department (Attendance.department + Employee_history).
 */

import { NextResponse } from 'next/server';
import { createSupabaseServerComponentClient } from '@/lib/supabaseAppRouterClient';
import { fetchSalaryReportForApi } from '@/lib/fetchSalaryReportForApi';

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
    const { report, from: outFrom, to: outTo, error } = await fetchSalaryReportForApi(supabase, {
      from,
      to,
      department,
      employeeId,
    });

    if (error) {
      console.error('[salary-report] Error:', error);
      return NextResponse.json(
        { error: 'Failed to generate salary report', details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ report, from: outFrom, to: outTo });
  } catch (err) {
    console.error('[salary-report] Server error:', err);
    return NextResponse.json(
      { error: 'Server error generating salary report', details: String(err) },
      { status: 500 }
    );
  }
}
