import { fetchSalaryReportForApi } from '@/lib/fetchSalaryReportForApi';
import { buildSalaryReconciliationSummary } from '@/app/admin/services/projectCostReportService';
import {
  generateSalaryReportPdfBuffer,
  salaryReportPdfFilename,
} from '@/lib/reportPdf/generateSalaryReportPdf';
import {
  generateAttendanceReportPdfBuffer,
  attendanceReportPdfFilename,
} from '@/lib/reportPdf/generateAttendanceReportPdf';
import type { AttendanceReportEmployeeReport } from '@/app/admin/types/attendanceReport';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ReportPdfKind = 'salary' | 'attendance';

export async function buildReportPdf(
  supabase: SupabaseClient,
  params: {
    reportType: ReportPdfKind;
    from: string;
    to: string;
    department?: string | null;
    employeeId?: string | null;
    filterLabel: string;
    viewMode?: 'employee' | 'project';
    attendanceReport: AttendanceReportEmployeeReport[];
    attendanceError?: string | null;
  }
): Promise<{ buffer: Buffer; filename: string; error?: string }> {
  const { reportType, from, to, filterLabel, viewMode, attendanceReport, attendanceError } =
    params;

  if (reportType === 'salary') {
    const { report, error } = await fetchSalaryReportForApi(supabase, {
      from,
      to,
      department: params.department,
      employeeId: params.employeeId,
    });
    if (error) return { buffer: Buffer.alloc(0), filename: '', error };
    if (report.length === 0) {
      return { buffer: Buffer.alloc(0), filename: '', error: 'No report data for this period.' };
    }
    const summary = buildSalaryReconciliationSummary(report);
    const buffer = generateSalaryReportPdfBuffer({
      from,
      to,
      filterLabel,
      viewMode: viewMode ?? 'employee',
      summary,
    });
    return { buffer, filename: salaryReportPdfFilename(from, to) };
  }

  if (attendanceError) return { buffer: Buffer.alloc(0), filename: '', error: attendanceError };
  if (attendanceReport.length === 0) {
    return { buffer: Buffer.alloc(0), filename: '', error: 'No report data for this period.' };
  }
  const buffer = generateAttendanceReportPdfBuffer({
    from,
    to,
    filterLabel,
    report: attendanceReport,
  });
  return { buffer, filename: attendanceReportPdfFilename(from, to) };
}
