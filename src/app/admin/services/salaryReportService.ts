/**
 * Salary & Project Cost Report — uses the same payroll rules as the Attendance Report.
 * Days/hours/OT are built via buildAttendanceReport; salary totals via computePayrollFromDays.
 * Project costs allocate logged project hours at the same hourly rate and OT multipliers.
 * Hrs Δ from Sick Leave (paid, not charged to projects) is expected; other gaps need attendance fixes.
 */

import type { SalaryReportEmployee, ProjectCostEntry } from '../types/salaryReport';
import {
  buildAttendanceReport,
  type RawAttendanceRow,
  type RawEmployeeRow,
} from './attendanceReportService';
import {
  bucketOvertimeHours,
  computePayrollFromDays,
  overtimeAmountFromBuckets,
} from './payrollCalculation';
import { resolveProjectDisplayName } from '@/lib/projectDisplayName';
import { countInclusiveDays } from '@/lib/payrollPeriod';
import { OVERTIME_RATE_BY_TYPE } from '@/app/constants/overtime';

export interface RawSalaryProjectRow {
  attendance_id: string;
  project_id: string;
  working_hours: number;
  overtime_hours: number;
  overtime_type?: string | null;
  overtime_rate?: number | null;
}

function effectiveStatusAttendance(att: RawAttendanceRow): string {
  const saRaw = att.status_attendance?.trim() ?? '';
  const notesType =
    (att.notes ?? '').match(/Attendance\s+type:\s*(.+?)(?:\n|$)/i)?.[1]?.trim() ?? '';
  return notesType || saRaw;
}

export function buildSalaryReport(input: {
  attRows: RawAttendanceRow[];
  attProjRows: RawSalaryProjectRow[];
  projectNameById: Map<string, string>;
  employees: RawEmployeeRow[];
  fromDate: string;
  toDate: string;
  /** Optional prior-year SL days so payable hours match the attendance report. */
  priorSickLeaveDaysByEmployee?: Map<string, string[]>;
}): SalaryReportEmployee[] {
  const {
    attRows,
    attProjRows,
    projectNameById,
    employees,
    fromDate,
    toDate,
    priorSickLeaveDaysByEmployee,
  } = input;

  const periodDays = countInclusiveDays(fromDate, toDate);

  const attendanceReports = buildAttendanceReport({
    attRows,
    attProjRows,
    projectNameById,
    employees,
    priorSickLeaveDaysByEmployee,
  });

  const projByAttId = new Map<string, RawSalaryProjectRow[]>();
  attProjRows.forEach((p) => {
    const list = projByAttId.get(p.attendance_id) ?? [];
    list.push(p);
    projByAttId.set(p.attendance_id, list);
  });

  const result: SalaryReportEmployee[] = [];

  for (const empReport of attendanceReports) {
    const empId = empReport.employee.id;
    const payroll = computePayrollFromDays(
      empReport.days,
      empReport.employee.salary,
      fromDate
    );
    const { hourlyRate } = payroll;

    type ProjAccum = {
      workingHours: number;
      otNormal: number;
      otHoliday: number;
      otPublicHoliday: number;
    };
    const projectMap = new Map<string, ProjAccum>();

    for (const att of attRows) {
      if (att.employee_id !== empId) continue;
      const sa = effectiveStatusAttendance(att);
      const projRows = projByAttId.get(att.id) ?? [];

      for (const proj of projRows) {
        const rawName = resolveProjectDisplayName(proj.project_id, projectNameById);
        const projectName =
          !rawName || rawName === 'Unknown' ? 'Office/Other' : rawName;
        const wh = Number(proj.working_hours ?? 0);
        const buckets = bucketOvertimeHours([proj], sa);

        const existing = projectMap.get(projectName);
        if (existing) {
          existing.workingHours += wh;
          existing.otNormal += buckets.normal;
          existing.otHoliday += buckets.holiday;
          existing.otPublicHoliday += buckets.public_holiday;
        } else {
          projectMap.set(projectName, {
            workingHours: wh,
            otNormal: buckets.normal,
            otHoliday: buckets.holiday,
            otPublicHoliday: buckets.public_holiday,
          });
        }
      }
    }

    const projects: ProjectCostEntry[] = [];

    for (const [projectName, data] of Array.from(projectMap.entries())) {
      const baseValue = data.workingHours * hourlyRate;
      const overtimeHours = data.otNormal + data.otHoliday + data.otPublicHoliday;
      const overtimeValue = overtimeAmountFromBuckets(
        {
          normal: data.otNormal,
          holiday: data.otHoliday,
          public_holiday: data.otPublicHoliday,
        },
        hourlyRate
      );
      const overtimeRate =
        overtimeHours > 0 && hourlyRate > 0
          ? overtimeValue / (overtimeHours * hourlyRate)
          : 0;

      projects.push({
        projectName,
        workingHours: data.workingHours,
        baseValue,
        overtimeHours,
        otNormal: data.otNormal,
        otHoliday: data.otHoliday,
        otPublicHoliday: data.otPublicHoliday,
        overtimeRate,
        overtimeValue,
      });
    }

    projects.sort((a, b) => a.projectName.localeCompare(b.projectName));

    let sickLeaveHours = 0;
    let sickLeaveDays = 0;
    for (const day of empReport.days) {
      if (day.status_code !== 'SL') continue;
      sickLeaveDays += 1;
      sickLeaveHours += day.working_hours ?? 0;
    }

    result.push({
      employee: {
        ...empReport.employee,
        salary: empReport.employee.salary ?? null,
      },
      periodDays,
      monthDays: payroll.monthDays,
      totalMonthHours: payroll.monthDays * 8,
      hourlyRate: payroll.hourlyRate,
      workedDays: payroll.workedDays,
      totalHours: payroll.totalHours,
      awoDeductions: payroll.awoDeductions,
      baseSalary: payroll.baseSalary,
      overtimeAmount: payroll.overtimeAmount,
      totalSalary: payroll.totalSalary,
      sickLeaveHours,
      sickLeaveDays,
      projects,
    });
  }

  return result;
}

// Re-export for tests / callers that need OT rate labels
export { OVERTIME_RATE_BY_TYPE };
