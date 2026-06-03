import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SalaryReconciliationSummary } from '@/app/admin/types/projectCostReport';
import { formatPeriodLabel } from '@/lib/payrollPeriod';

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function generateSalaryReportPdfBuffer(input: {
  from: string;
  to: string;
  filterLabel: string;
  viewMode: 'employee' | 'project';
  summary: SalaryReconciliationSummary;
}): Buffer {
  const { from, to, filterLabel, viewMode, summary } = input;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 12;
  let y = 14;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Salary & Project Cost Report', margin, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${formatPeriodLabel(from, to)}`, margin, y);
  y += 5;
  doc.text(`Scope: ${filterLabel}`, margin, y);
  y += 5;
  doc.text(`View: ${viewMode === 'project' ? 'By Project' : 'By Employee'}`, margin, y);
  y += 8;
  doc.text(
    `Total Salary: ${fmt(summary.grandTotalSalary)}  |  Project Cost: ${fmt(summary.grandProjectCost, 2)}  |  Variance: ${summary.isMatched ? 'Matched' : fmt(summary.grandVariance, 2)}`,
    margin,
    y
  );
  y += 10;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Employee', 'Total Salary', 'Project Total', 'Work Hrs', 'Logged Hrs', 'Cost Δ']],
    body: summary.employees.map((e) => [
      `${e.employeeName}\n${e.employeeId}`,
      fmt(e.totalSalary),
      e.projectTotalCost > 0 ? fmt(e.projectTotalCost, 2) : '—',
      `${e.totalHours}h`,
      e.projectHours > 0 ? `${e.projectHours}h` : '—',
      Math.abs(e.variance) <= 0.5 ? '✓' : fmt(e.variance, 2),
    ]),
    foot: [
      [
        'TOTAL',
        fmt(summary.grandTotalSalary),
        fmt(summary.grandProjectCost, 2),
        '',
        '',
        summary.isMatched ? '✓' : fmt(summary.grandVariance, 2),
      ],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [49, 46, 129], fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold' },
  });

  doc.addPage();
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Project Cost Totals', margin, 14);

  autoTable(doc, {
    startY: 20,
    margin: { left: margin, right: margin },
    head: [['Project', 'Work Hrs', 'Base', 'OT', 'Total', 'Share']],
    body: summary.projects.map((p) => [
      p.projectName,
      String(p.totalWorkingHours),
      fmt(p.totalBaseValue, 2),
      p.totalOvertimeValue > 0 ? fmt(p.totalOvertimeValue, 2) : '—',
      fmt(p.totalCost, 2),
      summary.grandProjectCost > 0
        ? `${((p.totalCost / summary.grandProjectCost) * 100).toFixed(1)}%`
        : '—',
    ]),
    foot: [
      [
        'TOTAL',
        String(summary.projects.reduce((s, p) => s + p.totalWorkingHours, 0)),
        fmt(summary.grandProjectBase, 2),
        fmt(summary.grandProjectOvertime, 2),
        fmt(summary.grandProjectCost, 2),
        '100%',
      ],
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [6, 78, 59], fontSize: 8 },
    footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold' },
  });

  return Buffer.from(doc.output('arraybuffer'));
}

export function salaryReportPdfFilename(from: string, to: string): string {
  return `salary-project-report_${from}_${to}.pdf`;
}
