/**
 * Types for the monthly Salary & Project Cost Report.
 * Calculated from Attendance + Attendance_projects raw data.
 */

export interface ProjectCostEntry {
  projectName: string;
  workingHours: number;
  baseValue: number;       // workingHours * hourlyRate  (قيمة الأيام)
  overtimeHours: number;
  overtimeRate: number;    // effective multiplier for display (1.25 / 1.5 / etc.)
  overtimeValue: number;   // overtimeHours * overtimeRate * hourlyRate  (قيمة الإضافي)
}

export interface SalaryReportEmployee {
  employee: {
    id: string;
    name: string;
    department: string;
    salary: number | null;
  };
  // Period metadata
  monthDays: number;
  totalMonthHours: number;
  hourlyRate: number;
  // Base salary calculation
  workedDays: number;        // count of unique dates in attendance records
  awoDeductions: number;     // count of unique AWO dates (each subtracts 8 extra hours)
  effectiveBaseHours: number; // max(0, workedDays*8 - awoDeductions*8)
  baseSalary: number;        // effectiveBaseHours * hourlyRate
  // Overtime
  overtimeAmount: number;    // sum of all daily OT earned
  // Final
  totalSalary: number;       // round(baseSalary + overtimeAmount)
  // Project breakdown (actual logged hours)
  projects: ProjectCostEntry[];
}
