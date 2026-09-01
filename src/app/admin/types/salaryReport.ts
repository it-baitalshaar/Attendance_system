/**
 * Types for the monthly Salary & Project Cost Report.
 * Calculated from Attendance + Attendance_projects raw data.
 */

export interface SickLeaveProjectCharge {
  date: string;
  hours: number;
  amount: number;
}

export interface ProjectCostEntry {
  projectName: string;
  workingHours: number;
  baseValue: number;       // workingHours * hourlyRate  (قيمة الأيام)
  overtimeHours: number;
  /** Normal OT hours (×1.25) — prefer over blended overtimeRate for display */
  otNormal: number;
  /** Weekend OT hours (×1.5) */
  otHoliday: number;
  /** Public holiday OT hours (×2.5) */
  otPublicHoliday: number;
  /** @deprecated Blended average of OT multipliers; prefer otNormal/otHoliday/otPublicHoliday */
  overtimeRate: number;
  overtimeValue: number;   // OT buckets × multipliers × hourlyRate  (قيمة الإضافي)
  /** Paid SL hours charged to this project (inherited from the previous working day). */
  sickLeaveHours: number;
  sickLeaveValue: number;
  sickLeaveCharges: SickLeaveProjectCharge[];
}

export interface SalaryReportEmployee {
  employee: {
    id: string;
    name: string;
    department: string;
    salary: number | null;
  };
  // Period metadata
  periodDays: number;         // inclusive days in selected from–to range
  monthDays: number;          // calendar month days (hourly rate divisor — same as attendance report)
  totalMonthHours: number;    // monthDays × 8
  hourlyRate: number;
  // Base salary (attendance report rules)
  workedDays: number;         // Present + Holiday-Work days
  totalHours: number;         // sum of daily working_hours
  awoDeductions: number;      // AWO day count (informational; same as attendance report)
  baseSalary: number;         // totalHours × hourlyRate
  // Overtime
  overtimeAmount: number;    // sum of all daily OT earned
  // Final
  totalSalary: number;       // round(baseSalary + overtimeAmount)
  // Sick leave (paid in salary; charged to the previous working day's project when known)
  sickLeaveHours: number;    // Σ working_hours on SL days
  sickLeaveDays: number;     // count of SL days in period
  /** SL hours successfully charged to a prior-day project. */
  sickLeaveChargedHours: number;
  /** SL dates in the period (YYYY-MM-DD), used to label the project SL row. */
  sickLeaveDates: string[];
  // Project breakdown (logged hours + inherited SL)
  projects: ProjectCostEntry[];
}
