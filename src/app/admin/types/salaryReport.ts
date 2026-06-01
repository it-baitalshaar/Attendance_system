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
  // Project breakdown (actual logged hours)
  projects: ProjectCostEntry[];
}
