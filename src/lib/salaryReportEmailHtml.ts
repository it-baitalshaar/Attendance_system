import type { SalaryReportEmployee } from '@/app/admin/types/salaryReport';
import type { SalaryReconciliationSummary } from '@/app/admin/types/projectCostReport';
import { formatPeriodLabel } from '@/lib/payrollPeriod';

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSalaryReportEmailHtml(input: {
  from: string;
  to: string;
  filterLabel: string;
  viewMode: 'employee' | 'project';
  report: SalaryReportEmployee[];
  summary: SalaryReconciliationSummary;
}): string {
  const { from, to, filterLabel, viewMode, report, summary } = input;
  const periodLabel = formatPeriodLabel(from, to);
  const matched = summary.isMatched;

  const employeeRows = summary.employees
    .map(
      (e) => `<tr>
        <td>${esc(e.employeeName)}<br/><span style="color:#6b7280;font-size:11px">${esc(e.employeeId)}</span></td>
        <td style="text-align:right">${fmt(e.totalSalary)}</td>
        <td style="text-align:right">${e.projectTotalCost > 0 ? fmt(e.projectTotalCost, 2) : '—'}</td>
        <td style="text-align:right">${e.totalHours}h</td>
        <td style="text-align:right">${e.projectHours > 0 ? `${e.projectHours}h` : '—'}</td>
        <td style="text-align:center">${Math.abs(e.variance) <= 0.5 ? '✓' : fmt(e.variance, 2)}</td>
      </tr>`
    )
    .join('');

  const projectRows = summary.projects
    .map(
      (p) => `<tr>
        <td>${esc(p.projectName)}</td>
        <td style="text-align:right">${p.totalWorkingHours}</td>
        <td style="text-align:right">${fmt(p.totalBaseValue, 2)}</td>
        <td style="text-align:right">${p.totalOvertimeValue > 0 ? fmt(p.totalOvertimeValue, 2) : '—'}</td>
        <td style="text-align:right;font-weight:600">${fmt(p.totalCost, 2)}</td>
      </tr>`
    )
    .join('');

  const detailNote =
    viewMode === 'project'
      ? `<p>Detailed project breakdown is available in the admin app (${report.length} employee record(s) in period).</p>`
      : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Salary &amp; Project Cost Report</title></head>
<body style="font-family:Segoe UI,Arial,sans-serif;max-width:900px;margin:0 auto;padding:16px;color:#111">
  <h2 style="color:#312e81;margin:0 0 8px">Salary &amp; Project Cost Report</h2>
  <p style="margin:0 0 16px;color:#4b5563">
    <strong>Period:</strong> ${esc(periodLabel)}<br/>
    <strong>Scope:</strong> ${esc(filterLabel)}<br/>
    <strong>View:</strong> ${viewMode === 'project' ? 'By Project' : 'By Employee'}
  </p>
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;margin-bottom:20px">
    <tr style="background:#eef2ff">
      <td><strong>Total Salary</strong></td><td style="text-align:right">${fmt(summary.grandTotalSalary)}</td>
      <td><strong>Project Cost</strong></td><td style="text-align:right">${fmt(summary.grandProjectCost, 2)}</td>
    </tr>
    <tr>
      <td><strong>Variance</strong></td>
      <td colspan="3" style="text-align:right;color:${matched ? '#059669' : '#b45309'}">
        ${matched ? 'Matched ✓' : fmt(summary.grandVariance, 2) + ' — fix project hours in attendance'}
      </td>
    </tr>
  </table>
  <h3 style="font-size:14px;color:#374151">By Employee</h3>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;margin-bottom:24px">
    <thead><tr style="background:#f9fafb">
      <th align="left">Employee</th>
      <th align="right">Total Salary</th>
      <th align="right">Project Total</th>
      <th align="right">Work Hrs</th>
      <th align="right">Logged Hrs</th>
      <th align="center">Cost Δ</th>
    </tr></thead>
    <tbody>${employeeRows}</tbody>
    <tfoot><tr style="background:#f1f5f9;font-weight:600">
      <td>TOTAL</td>
      <td align="right">${fmt(summary.grandTotalSalary)}</td>
      <td align="right">${fmt(summary.grandProjectCost, 2)}</td>
      <td colspan="3"></td>
    </tr></tfoot>
  </table>
  <h3 style="font-size:14px;color:#374151">Project Cost Totals</h3>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;margin-bottom:16px">
    <thead><tr style="background:#f9fafb">
      <th align="left">Project</th>
      <th align="right">Work Hrs</th>
      <th align="right">Base</th>
      <th align="right">OT</th>
      <th align="right">Total</th>
    </tr></thead>
    <tbody>${projectRows}</tbody>
  </table>
  ${detailNote}
  <p style="margin-top:24px;font-size:12px;color:#9ca3af">Sent from Bait Al Shaar Attendance System. The full report PDF is attached to this email.</p>
</body>
</html>`;
}

export function buildSalaryReportWhatsAppMessage(input: {
  from: string;
  to: string;
  filterLabel: string;
  summary: SalaryReconciliationSummary;
}): string {
  const period = formatPeriodLabel(input.from, input.to);
  const lines = [
    `Salary & Project Cost Report`,
    `Period: ${period}`,
    `Scope: ${input.filterLabel}`,
    ``,
    `Total Salary: ${fmt(input.summary.grandTotalSalary)}`,
    `Project Cost: ${fmt(input.summary.grandProjectCost, 2)}`,
    input.summary.isMatched
      ? `Status: Matched ✓`
      : `Variance: ${fmt(input.summary.grandVariance, 2)} (check attendance project hours)`,
    `Employees: ${input.summary.employeeCount}`,
    ``,
    `PDF report is attached when you use Send email now, or Share via WhatsApp in the admin screen.`,
  ];
  return lines.join('\n');
}
