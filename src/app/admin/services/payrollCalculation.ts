/**
 * Shared payroll rules — must match Attendance Report summary exactly.
 * Hourly rate: monthly salary ÷ (calendar month days × 8) from report start date.
 * Base pay: sum of daily working_hours × hourly rate.
 * Overtime: OT hours × type multiplier × hourly rate (1.25 / 1.5 / 2.5).
 */

import type { AttendanceReportDay } from '../types/attendanceReport';
import {
  OVERTIME_RATE_BY_TYPE,
  normalizeOvertimeType,
} from '@/app/constants/overtime';
import type { RawAttendanceProjectRow } from './attendanceReportService';

const ABSENT_CODES = new Set(['AWO', 'SL', 'A']);

export function getCalendarMonthDays(fromDate: string): number {
  const [sy, sm] = fromDate.split('-').map(Number);
  return new Date(sy, sm, 0).getDate();
}

export function getHourlyRate(monthlySalary: number, fromDate: string): number {
  const monthDays = getCalendarMonthDays(fromDate);
  return monthDays > 0 ? monthlySalary / (monthDays * 8) : 0;
}

/** Same OT bucketing as buildAttendanceReport (Attendance_projects rows). */
export function bucketOvertimeHours(
  projRows: Pick<RawAttendanceProjectRow, 'overtime_hours' | 'overtime_type'>[],
  statusAttendance: string
): { normal: number; holiday: number; public_holiday: number } {
  let normal = 0;
  let holiday = 0;
  let public_holiday = 0;

  for (const p of projRows) {
    const ot = Number(p.overtime_hours ?? 0);
    if (ot === 0) continue;
    const typeRaw = p.overtime_type;
    const t =
      typeRaw != null && String(typeRaw).trim() !== ''
        ? normalizeOvertimeType(typeRaw)
        : null;

    if (t === 'holiday') {
      holiday += ot;
    } else if (t === 'public_holiday') {
      public_holiday += ot;
    } else if (statusAttendance === 'Present') {
      normal += ot;
    } else if (statusAttendance === 'Weekend') {
      holiday += ot;
    } else if (statusAttendance === 'Holiday-Work') {
      public_holiday += ot;
    } else {
      normal += ot;
    }
  }

  return { normal, holiday, public_holiday };
}

export function overtimeAmountFromBuckets(
  buckets: { normal: number; holiday: number; public_holiday: number },
  hourlyRate: number
): number {
  return (
    buckets.normal * OVERTIME_RATE_BY_TYPE.normal * hourlyRate +
    buckets.holiday * OVERTIME_RATE_BY_TYPE.holiday * hourlyRate +
    buckets.public_holiday * OVERTIME_RATE_BY_TYPE.public_holiday * hourlyRate
  );
}

export function summarizeAttendanceDays(
  days: Pick<AttendanceReportDay, 'status_code' | 'working_hours' | 'overtime'>[]
) {
  let present = 0;
  let absent = 0;
  let vacation = 0;
  let weekend = 0;
  let holidayWork = 0;
  let totalHours = 0;
  let otNormal = 0;
  let otHoliday = 0;
  let otPublicHoliday = 0;
  let awo = 0;
  let sl = 0;
  let a = 0;

  for (const d of days) {
    const c = d.status_code;
    if (c === 'P') present++;
    else if (c === 'H') holidayWork++;
    else if (ABSENT_CODES.has(c)) {
      absent++;
      if (c === 'AWO') awo++;
      else if (c === 'SL') sl++;
      else if (c === 'A') a++;
    } else if (c === 'V') vacation++;
    else if (c === 'W') weekend++;

    totalHours += d.working_hours ?? 0;
    otNormal += d.overtime.normal ?? 0;
    otHoliday += d.overtime.holiday ?? 0;
    otPublicHoliday += d.overtime.public_holiday ?? 0;
  }

  const workedDays = present + holidayWork;
  const totalOT = otNormal + otHoliday + otPublicHoliday;

  return {
    present,
    absent,
    vacation,
    weekend,
    holidayWork,
    workedDays,
    totalHours,
    totalOT,
    otNormal,
    otHoliday,
    otPublicHoliday,
    awo,
    sl,
    a,
  };
}

export interface EmployeePayroll {
  monthDays: number;
  hourlyRate: number;
  workedDays: number;
  totalHours: number;
  awoDeductions: number;
  awoDeductionAmount: number;
  baseSalary: number;
  otNormalAmount: number;
  otHolidayAmount: number;
  otPublicHolidayAmount: number;
  overtimeAmount: number;
  totalSalary: number;
}

/** Identical formula to Attendance Report overall summary Total Salary column. */
export function computePayrollFromDays(
  days: AttendanceReportDay[],
  monthlySalary: number | null | undefined,
  fromDate: string
): EmployeePayroll {
  const s = summarizeAttendanceDays(days);
  const monthDays = getCalendarMonthDays(fromDate);

  if (!monthlySalary || monthlySalary <= 0) {
    return {
      monthDays,
      hourlyRate: 0,
      workedDays: s.workedDays,
      totalHours: s.totalHours,
      awoDeductions: s.awo,
      awoDeductionAmount: 0,
      baseSalary: 0,
      otNormalAmount: 0,
      otHolidayAmount: 0,
      otPublicHolidayAmount: 0,
      overtimeAmount: 0,
      totalSalary: 0,
    };
  }

  const hourlyRate = getHourlyRate(monthlySalary, fromDate);
  let otNormalAmount = 0;
  let otHolidayAmount = 0;
  let otPublicHolidayAmount = 0;

  days.forEach((day) => {
    otNormalAmount += day.overtime.normal * OVERTIME_RATE_BY_TYPE.normal * hourlyRate;
    otHolidayAmount += day.overtime.holiday * OVERTIME_RATE_BY_TYPE.holiday * hourlyRate;
    otPublicHolidayAmount +=
      day.overtime.public_holiday * OVERTIME_RATE_BY_TYPE.public_holiday * hourlyRate;
  });

  const awoDeductionAmount = s.awo * 8 * hourlyRate;
  const baseSalary = s.totalHours * hourlyRate;
  const overtimeAmount = otNormalAmount + otHolidayAmount + otPublicHolidayAmount;
  const totalSalary = Math.round(baseSalary + overtimeAmount);

  return {
    monthDays,
    hourlyRate,
    workedDays: s.workedDays,
    totalHours: s.totalHours,
    awoDeductions: s.awo,
    awoDeductionAmount,
    baseSalary,
    otNormalAmount,
    otHolidayAmount,
    otPublicHolidayAmount,
    overtimeAmount,
    totalSalary,
  };
}
