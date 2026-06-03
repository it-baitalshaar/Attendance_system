import { NextResponse } from 'next/server';
import { createSupabaseServerComponentClient } from '@/lib/supabaseAppRouterClient';
import { fetchAttendanceReportForApi } from '@/lib/fetchAttendanceReportForApi';
import { buildReportPdf } from '@/lib/reportPdf/buildReportPdf';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const reportType = body?.reportType === 'attendance' ? 'attendance' : 'salary';
    const from = String(body?.from ?? '').slice(0, 10);
    const to = String(body?.to ?? '').slice(0, 10);
    if (!from || !to) {
      return NextResponse.json({ error: 'from and to dates are required' }, { status: 400 });
    }

    const department = body?.department?.trim() || null;
    const employeeId = body?.employeeId?.trim() || null;
    const viewMode = body?.viewMode === 'project' ? 'project' : 'employee';
    const filterLabel = String(body?.filterLabel ?? 'All Departments').trim();

    const supabase = createSupabaseServerComponentClient();

    let attendanceReport: Awaited<ReturnType<typeof fetchAttendanceReportForApi>>['report'] = [];
    if (reportType === 'attendance') {
      const fetched = await fetchAttendanceReportForApi(supabase, {
        from,
        to,
        department,
        employeeId,
      });
      if (fetched.error) {
        return NextResponse.json({ error: fetched.error }, { status: 500 });
      }
      if (fetched.report.length === 0) {
        return NextResponse.json({ error: 'No report data for this period.' }, { status: 400 });
      }
      attendanceReport = fetched.report;
    }

    const { buffer, filename, error } = await buildReportPdf(supabase, {
      reportType,
      from,
      to,
      department,
      employeeId,
      filterLabel,
      viewMode,
      attendanceReport,
    });

    if (error || !buffer.length) {
      return NextResponse.json({ error: error ?? 'Failed to generate PDF' }, { status: 500 });
    }

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[payroll-report/pdf]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
