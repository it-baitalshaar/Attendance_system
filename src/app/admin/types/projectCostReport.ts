export interface ProjectEmployeeEntry {
  employeeId: string;
  employeeName: string;
  department: string;
  hourlyRate: number;
  workingHours: number;
  baseValue: number;
  overtimeHours: number;
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
  employees: EmployeeReconciliationRow[];
  projects: ProjectSummaryRow[];
}
