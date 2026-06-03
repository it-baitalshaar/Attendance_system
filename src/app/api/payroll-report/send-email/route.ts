import { NextResponse } from 'next/server';
import { createSupabaseServerComponentClient } from '@/lib/supabaseAppRouterClient';
import { sendMail } from '@/lib/email';
import { fetchSalaryReportForApi } from '@/lib/fetchSalaryReportForApi';
import { fetchAttendanceReportForApi } from '@/lib/fetchAttendanceReportForApi';
import { buildSalaryReconciliationSummary } from '@/app/admin/services/projectCostReportService';
import { buildSalaryReportEmailHtml } from '@/lib/salaryReportEmailHtml';
import { buildAttendanceReportEmailHtml } from '@/lib/attendanceReportEmailHtml';
import { buildReportPdf } from '@/lib/reportPdf/buildReportPdf';
import { formatPeriodLabel } from '@/lib/payrollPeriod';
import type { AttendanceReportEmployeeReport } from '@/app/admin/types/attendanceReport';

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

    const { data: emailRows, error: emailErr } = await supabase
      .from('payroll_report_emails')
      .select('email');

    if (emailErr) {
      return NextResponse.json({ error: emailErr.message }, { status: 500 });
    }

    const recipients = (emailRows ?? [])
      .map((r: { email: string }) => r.email)
      .filter(Boolean);

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'No recipient emails saved. Add at least one email below.' },
        { status: 400 }
      );
    }

    const periodLabel = formatPeriodLabel(from, to);
    let html: string;
    let subject: string;
    let attendanceReport: AttendanceReportEmployeeReport[] = [];

    if (reportType === 'attendance') {
      const { report, error: reportErr } = await fetchAttendanceReportForApi(supabase, {
        from,
        to,
        department,
        employeeId,
      });
      if (reportErr) {
        return NextResponse.json({ error: reportErr }, { status: 500 });
      }
      if (report.length === 0) {
        return NextResponse.json(
          { error: 'No report data for this period and filters.' },
          { status: 400 }
        );
      }
      attendanceReport = report;
      html = buildAttendanceReportEmailHtml({ from, to, filterLabel, report });
      subject = `Attendance Report — ${periodLabel}${department ? ` — ${department}` : ''}`;
    } else {
      const { report, error: reportErr } = await fetchSalaryReportForApi(supabase, {
        from,
        to,
        department,
        employeeId,
      });
      if (reportErr) {
        return NextResponse.json({ error: reportErr }, { status: 500 });
      }
      if (report.length === 0) {
        return NextResponse.json(
          { error: 'No report data for this period and filters.' },
          { status: 400 }
        );
      }
      const summary = buildSalaryReconciliationSummary(report);
      html = buildSalaryReportEmailHtml({
        from,
        to,
        filterLabel,
        viewMode,
        report,
        summary,
      });
      subject = `Salary & Project Cost Report — ${periodLabel}${department ? ` — ${department}` : ''}`;
    }

    const clientPdfBase64 =
      typeof body?.pdfBase64 === 'string' && body.pdfBase64.length > 0
        ? body.pdfBase64
        : null;
    const clientPdfFilename =
      typeof body?.pdfFilename === 'string' && body.pdfFilename.trim()
        ? body.pdfFilename.trim()
        : null;

    let buffer: Buffer;
    let filename: string;

    if (clientPdfBase64) {
      try {
        buffer = Buffer.from(clientPdfBase64, 'base64');
      } catch {
        return NextResponse.json({ error: 'Invalid PDF data' }, { status: 400 });
      }
      if (!buffer.length) {
        return NextResponse.json({ error: 'Empty PDF' }, { status: 400 });
      }
      filename =
        clientPdfFilename ??
        (reportType === 'attendance'
          ? `attendance_report_${from}_${to}.pdf`
          : `salary_report_${from}_${to}.pdf`);
    } else {
      const built = await buildReportPdf(supabase, {
        reportType,
        from,
        to,
        department,
        employeeId,
        filterLabel,
        viewMode,
        attendanceReport,
      });
      if (built.error || !built.buffer.length) {
        return NextResponse.json({ error: built.error ?? 'Failed to generate PDF' }, { status: 500 });
      }
      buffer = built.buffer;
      filename = built.filename;
    }

    const result = await sendMail({
      to: recipients,
      subject,
      html,
      attachments: [{ filename, content: buffer, contentType: 'application/pdf' }],
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sent: recipients.length, pdfAttached: true });
  } catch (err) {
    console.error('[payroll-report/send-email]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
