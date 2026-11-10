/**
 * Salary & Project Cost Report — uses the same payroll rules as the Attendance Report.
 * Days/hours/OT are built via buildAttendanceReport; salary totals via computePayrollFromDays.
 * Project costs allocate logged project hours at the same hourly rate and OT multipliers.
 * Paid Sick Leave with no logged project is charged to the previous working day's project
 * so employee Work Hrs and project totals match.
 */

import type { SalaryReportEmployee, ProjectCostEntry, SickLeaveProjectCharge } from '../types/salaryReport';
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
import {
  allocateSickLeaveFromAttendanceRows,
  attachUnchargedSickLeaveToLargestProject,
  type LookbackWorkDay,
  type ProjectHoursPart,
} from './inheritSickLeaveProjects';
import { dateOnly } from '../types/attendanceReport';

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
  /** Optional prior-period work projects so SL at period start can inherit a project. */
  lookbackWorkDaysByEmployee?: Map<string, LookbackWorkDay[]>;
}): SalaryReportEmployee[] {
  const {
    attRows,
    attProjRows,
    projectNameById,
    employees,
    fromDate,
    toDate,
    priorSickLeaveDaysByEmployee,
    lookbackWorkDaysByEmployee,
  } = input;

  const periodDays = countInclusiveDays(fromDate, toDate);

  const attendanceReports = buildAttendanceReport({
    attRows,
    attProjRows,
    projectNameById,
    employees,
    priorSickLeaveDaysByEmployee,
    lookbackWorkDaysByEmployee,
  });

  const projByAttId = new Map<string, RawSalaryProjectRow[]>();
  attProjRows.forEach((p) => {
    const attId = String(p.attendance_id ?? '');
    const list = projByAttId.get(attId) ?? [];
    list.push(p);
    projByAttId.set(attId, list);
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
      sickLeaveHours: number;
      sickLeaveCharges: SickLeaveProjectCharge[];
    };
    const projectMap = new Map<string, ProjAccum>();

    const ensureProject = (projectName: string): ProjAccum => {
      const existing = projectMap.get(projectName);
      if (existing) return existing;
      const created: ProjAccum = {
        workingHours: 0,
        otNormal: 0,
        otHoliday: 0,
        otPublicHoliday: 0,
        sickLeaveHours: 0,
        sickLeaveCharges: [],
      };
      projectMap.set(projectName, created);
      return created;
    };

    for (const att of attRows) {
      if (att.employee_id !== empId) continue;
      const sa = effectiveStatusAttendance(att);
      const projRows = projByAttId.get(String(att.id ?? '')) ?? [];

      for (const proj of projRows) {
        const rawName = resolveProjectDisplayName(proj.project_id, projectNameById);
        const projectName =
          !rawName || rawName === 'Unknown' ? 'Office/Other' : rawName;
        const wh = Number(proj.working_hours ?? 0);
        const buckets = bucketOvertimeHours([proj], sa);

        const existing = ensureProject(projectName);
        existing.workingHours += wh;
        existing.otNormal += buckets.normal;
        existing.otHoliday += buckets.holiday;
        existing.otPublicHoliday += buckets.public_holiday;
      }
    }

    const projectPartsByAttendanceId = new Map<string, ProjectHoursPart[]>();
    for (const att of attRows) {
      if (att.employee_id !== empId) continue;
      const attId = String(att.id ?? '');
      const parts: ProjectHoursPart[] = (projByAttId.get(attId) ?? []).map((proj) => {
        const rawName = resolveProjectDisplayName(proj.project_id, projectNameById);
        const name = !rawName || rawName === 'Unknown' ? 'Office/Other' : rawName;
        return { name, hours: Number(proj.working_hours ?? 0) };
      });
      projectPartsByAttendanceId.set(attId, parts);
    }

    const paidHoursByDate = new Map<string, number>();
    for (const day of empReport.days) {
      if (day.status_code !== 'SL') continue;
      paidHoursByDate.set(dateOnly(day.date), day.working_hours ?? 0);
    }

    const inheritedByDate = allocateSickLeaveFromAttendanceRows({
      attRows: attRows.filter((a) => a.employee_id === empId),
      projectPartsByAttendanceId,
      paidHoursByDate,
      lookbackDays: lookbackWorkDaysByEmployee?.get(empId),
    });

    // Prefer day.sick_leave_projects when present; otherwise use the row walk.
    for (const day of empReport.days) {
      if (day.status_code !== 'SL') continue;
      const d = dateOnly(day.date);
      const parts =
        day.sick_leave_projects && day.sick_leave_projects.length > 0
          ? day.sick_leave_projects
          : inheritedByDate.get(d) ?? [];
      for (const part of parts) {
        if (part.hours <= 0) continue;
        const rawName = (part.name ?? '').trim();
        const projectName = !rawName || rawName === 'Unknown' ? 'Office/Other' : rawName;
        const existing = ensureProject(projectName);
        const amount = part.hours * hourlyRate;
        existing.sickLeaveHours += part.hours;
        existing.sickLeaveCharges.push({
          date: d,
          hours: part.hours,
          amount,
        });
      }
    }

    let projects: ProjectCostEntry[] = [];

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
        sickLeaveHours: data.sickLeaveHours,
        sickLeaveValue: data.sickLeaveHours * hourlyRate,
        sickLeaveCharges: data.sickLeaveCharges,
      });
    }

    projects.sort((a, b) => a.projectName.localeCompare(b.projectName));

    let sickLeaveHours = 0;
    let sickLeaveDays = 0;
    const sickLeaveDates: string[] = [];
    for (const day of empReport.days) {
      if (day.status_code !== 'SL') continue;
      sickLeaveDays += 1;
      sickLeaveHours += day.working_hours ?? 0;
      sickLeaveDates.push(dateOnly(day.date));
    }
    let sickLeaveChargedHours = projects.reduce((s, p) => s + (p.sickLeaveHours ?? 0), 0);
    const remainingSl = Math.max(0, sickLeaveHours - sickLeaveChargedHours);
    if (remainingSl > 0.01) {
      projects = attachUnchargedSickLeaveToLargestProject(
        projects,
        remainingSl,
        hourlyRate,
        sickLeaveDates
      );
      sickLeaveChargedHours = projects.reduce((s, p) => s + (p.sickLeaveHours ?? 0), 0);
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
      sickLeaveChargedHours,
      sickLeaveDates,
      projects,
    });
  }

  return result;
}

// Re-export for tests / callers that need OT rate labels
export { OVERTIME_RATE_BY_TYPE };
