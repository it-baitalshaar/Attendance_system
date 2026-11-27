import type { AttendanceReportEmployeeReport } from '@/app/admin/types/attendanceReport';
import { computePayrollFromDays } from '@/app/admin/services/payrollCalculation';
import { formatPeriodLabel } from '@/lib/payrollPeriod';
import type { AttendanceReportTemplate } from '@/app/lib/attendanceReportTemplate';

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Status counters for the attendance-only template (no hours / salary). */
function countStatuses(days: AttendanceReportEmployeeReport['days']) {
  const c = {
    p: 0, h: 0, hdam: 0, hdpm: 0, w: 0, v: 0, awo: 0, sl: 0, a: 0,
  };
  for (const d of days) {
    switch (d.status_code) {
      case 'P': c.p++; break;
      case 'H': c.h++; break;
      case 'HDAM': c.hdam++; break;
      case 'HDPM': c.hdpm++; break;
      case 'W': c.w++; break;
      case 'V': c.v++; break;
      case 'AWO': c.awo++; break;
      case 'SL': c.sl++; break;
      case 'A': c.a++; break;
      default: break;
    }
  }
  return { ...c, attended: c.p + c.h + c.hdam + c.hdpm };
}

export function buildAttendanceReportEmailHtml(input: {
  from: string;
  to: string;
  filterLabel: string;
  report: AttendanceReportEmployeeReport[];
  /** `standard` (default) = hours + salary; `attendance-only` = status counts. */
  template?: AttendanceReportTemplate;
}): string {
  const { from, to, filterLabel, report } = input;
  const attendanceOnly = input.template === 'attendance-only';
  const periodLabel = formatPeriodLabel(from, to);

  if (attendanceOnly) {
    const rows = report
      .map((emp) => {
        const c = countStatuses(emp.days);
        return `<tr>
        <td>${esc(emp.employee.name)}<br/><span style="color:#6b7280;font-size:11px">${esc(emp.employee.id)} · ${esc(emp.employee.department)}</span></td>
        <td style="text-align:center;font-weight:600">${c.attended}</td>
        <td style="text-align:center">${c.p || '—'}</td>
        <td style="text-align:center">${c.hdam || '—'} / ${c.hdpm || '—'}</td>
        <td style="text-align:center">${c.w || '—'}</td>
        <td style="text-align:center">${c.v || '—'}</td>
        <td style="text-align:center">${c.awo || '—'}</td>
        <td style="text-align:center">${c.sl || '—'}</td>
        <td style="text-align:center">${c.a || '—'}</td>
      </tr>`;
      })
      .join('');

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Attendance Report</title></head>
<body style="font-family:Segoe UI,Arial,sans-serif;max-width:900px;margin:0 auto;padding:16px">
  <h2 style="color:#1e3a5f">Attendance Report</h2>
  <p><strong>Period:</strong> ${esc(periodLabel)}<br/><strong>Scope:</strong> ${esc(filterLabel)}<br/><strong>Employees:</strong> ${report.length}<br/><strong>Template:</strong> Attendance only (no hours / salary)</p>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">
    <thead><tr style="background:#f3f4f6">
      <th align="left">Employee</th><th>Attended</th><th>P</th><th>HD AM / PM</th><th>W</th><th>V</th><th>AWO</th><th>SL</th><th>A</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p style="font-size:12px;color:#9ca3af;margin-top:20px">The full report PDF is attached to this email.</p>
</body>
</html>`;
  }

  let grandSalary = 0;
  const rows = report
    .map((emp) => {
      const payroll = computePayrollFromDays(emp.days, emp.employee.salary, from);
      if (payroll.totalSalary) grandSalary += payroll.totalSalary;
      const worked = emp.days.filter((d) => d.status_code === 'P' || d.status_code === 'H').length;
      const hours = emp.days.reduce((s, d) => s + (d.working_hours ?? 0), 0);
      return `<tr>
        <td>${esc(emp.employee.name)}<br/><span style="color:#6b7280;font-size:11px">${esc(emp.employee.id)} · ${esc(emp.employee.department)}</span></td>
        <td style="text-align:center">${worked}</td>
        <td style="text-align:right">${hours}h</td>
        <td style="text-align:right">${payroll.totalSalary > 0 ? fmt(payroll.totalSalary) : '—'}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Attendance Report</title></head>
<body style="font-family:Segoe UI,Arial,sans-serif;max-width:900px;margin:0 auto;padding:16px">
  <h2 style="color:#1e3a5f">Attendance Report</h2>
  <p><strong>Period:</strong> ${esc(periodLabel)}<br/><strong>Scope:</strong> ${esc(filterLabel)}<br/><strong>Employees:</strong> ${report.length}</p>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">
    <thead><tr style="background:#f3f4f6">
      <th align="left">Employee</th><th>Worked</th><th align="right">Work Hrs</th><th align="right">Total Salary</th>
    </tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr style="background:#f1f5f9;font-weight:600">
      <td>TOTAL — ${report.length} employees</td><td></td><td></td>
      <td align="right">${grandSalary > 0 ? fmt(grandSalary) : '—'}</td>
    </tr></tfoot>
  </table>
  <p style="font-size:12px;color:#9ca3af;margin-top:20px">The full report PDF is attached to this email.</p>
</body>
</html>`;
}

export function buildAttendanceReportWhatsAppMessage(input: {
  from: string;
  to: string;
  filterLabel: string;
  employeeCount: number;
  grandTotalSalary: number;
  /** Days still missing hours / non-standard hours (submit-guard rules). */
  issueCount?: number;
  employeesWithIssues?: number;
  /** `standard` (default) includes the salary line; attendance-only omits it. */
  template?: AttendanceReportTemplate;
}): string {
  const period = formatPeriodLabel(input.from, input.to);
  const issueCount = input.issueCount ?? 0;
  const employeesWithIssues = input.employeesWithIssues ?? 0;
  const attendanceOnly = input.template === 'attendance-only';
  return [
    'Attendance Report',
    `Period: ${period}`,
    `Scope: ${input.filterLabel}`,
    attendanceOnly ? 'Template: Attendance only (no hours / salary)' : '',
    `Employees: ${input.employeeCount}`,
    !attendanceOnly && input.grandTotalSalary > 0 ? `Total Salary: ${fmt(input.grandTotalSalary)}` : '',
    issueCount > 0
      ? `WARNING: ${issueCount} incomplete day${issueCount !== 1 ? 's' : ''} across ${employeesWithIssues} employee${employeesWithIssues !== 1 ? 's' : ''} — fix before payroll`
      : '',
    '',
    'Please attach the report PDF (saved from Print / Save as PDF in the admin app).',
  ]
    .filter(Boolean)
    .join('\n');
}
