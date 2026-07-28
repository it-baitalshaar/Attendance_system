export interface ProjectEmployeeEntry {
  employeeId: string;
  employeeName: string;
  department: string;
  hourlyRate: number;
  workingHours: number;
  baseValue: number;
  overtimeHours: number;
  otNormal: number;
  otHoliday: number;
  otPublicHoliday: number;
  /** @deprecated Blended average; prefer otNormal/otHoliday/otPublicHoliday */
  overtimeRate: number;
  overtimeValue: number;
  totalValue: number;
}

export interface ProjectCostReport {
  projectName: string;
  employees: ProjectEmployeeEntry[];
  totalWorkingHours: number;
  totalBaseValue: number;
  totalOvertimeHours: number;
  totalOvertimeValue: number;
  totalCost: number;
}

export interface EmployeeReconciliationRow {
  employeeId: string;
  employeeName: string;
  department: string;
  baseSalary: number;
  overtimeAmount: number;
  totalSalary: number;
  projectBaseCost: number;
  projectOvertimeCost: number;
  projectTotalCost: number;
  variance: number;
  projectHours: number;
  totalHours: number;
  hoursVariance: number;
  /** Payable SL hours in period (not charged to projects). */
  sickLeaveHours: number;
  sickLeaveDays: number;
  /** Portion of positive Hrs Δ explained by sick leave. */
  sickLeaveExplainedHours: number;
  /** Hrs Δ remaining after subtracting SL (needs project fix if > 0). */
  unexplainedHours: number;
  /**
   * Why Cost/Hrs Δ exists for this employee.
   * - sick_leave: fully explained by SL pay
   * - missing_project_hours: work hours not logged to projects
   * - mixed: SL + missing project hours
   * - rounding: hours match; small Cost Δ from salary rounding
   * - none: matched
   */
  varianceReason:
    | 'sick_leave'
    | 'missing_project_hours'
    | 'mixed'
    | 'rounding'
    | 'none';
}

export interface ProjectSummaryRow {
  projectName: string;
  totalWorkingHours: number;
  totalBaseValue: number;
  totalOvertimeValue: number;
  totalCost: number;
}

export interface SalaryReconciliationSummary {
  periodDays: number;
  employeeCount: number;
  projectCount: number;
  grandBaseSalary: number;
  grandOvertime: number;
  grandTotalSalary: number;
  grandProjectBase: number;
  grandProjectOvertime: number;
  grandProjectCost: number;
  grandVariance: number;
  isMatched: boolean;
  /** True when any remaining Hrs Δ after SL is within tolerance (no attendance fix needed). */
  isExplained: boolean;
  grandSickLeaveHours: number;
  grandSickLeaveExplainedHours: number;
  grandUnexplainedHours: number;
  employees: EmployeeReconciliationRow[];
  projects: ProjectSummaryRow[];
}
