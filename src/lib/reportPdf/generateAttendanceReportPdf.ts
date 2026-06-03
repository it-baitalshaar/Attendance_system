import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AttendanceReportEmployeeReport } from '@/app/admin/types/attendanceReport';
import { computePayrollFromDays } from '@/app/admin/services/payrollCalculation';
import { formatPeriodLabel } from '@/lib/payrollPeriod';

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

export function generateAttendanceReportPdfBuffer(input: {
  from: string;
  to: string;
  filterLabel: string;
  report: AttendanceReportEmployeeReport[];
}): Buffer {
  const { from, to, filterLabel, report } = input;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const margin = 10;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Attendance Report — Overall Summary', margin, 12);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${formatPeriodLabel(from, to)}  |  Scope: ${filterLabel}`, margin, 18);

  let grandSalary = 0;
  const rows = report.map((emp) => {
    const payroll = computePayrollFromDays(emp.days, emp.employee.salary, from);
    if (payroll.totalSalary) grandSalary += payroll.totalSalary;
    const worked = emp.days.filter((d) => d.status_code === 'P' || d.status_code === 'H').length;
    const hours = emp.days.reduce((s, d) => s + (d.working_hours ?? 0), 0);
    const p = emp.days.filter((d) => d.status_code === 'P').length;
    const w = emp.days.filter((d) => d.status_code === 'W').length;
    const v = emp.days.filter((d) => d.status_code === 'V').length;
    const awo = emp.days.filter((d) => d.status_code === 'AWO').length;
    return [
      `${emp.employee.name}\n${emp.employee.id}`,
      emp.employee.department,
      String(worked),
      String(p),
      String(w),
      String(v),
      awo > 0 ? String(awo) : '—',
      `${hours}h`,
      payroll.totalSalary > 0 ? fmt(payroll.totalSalary) : '—',
    ];
  });

  autoTable(doc, {
    startY: 24,
    margin: { left: margin, right: margin },
    head: [
      [
        'Employee',
        'Dept',
        'Worked',
        'P',
        'W',
        'V',
        'AWO',
        'Work Hrs',
        'Total Salary',
      ],
    ],
    body: rows,
    foot: [['TOTAL', '', '', '', '', '', '', '', grandSalary > 0 ? fmt(grandSalary) : '—']],
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [30, 58, 95], fontSize: 7 },
    footStyles: { fillColor: [241, 245, 249], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 42 },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
  });

  return Buffer.from(doc.output('arraybuffer'));
}

export function attendanceReportPdfFilename(from: string, to: string): string {
  return `attendance-report_${from}_${to}.pdf`;
}
