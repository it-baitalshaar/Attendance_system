import type { SalaryReportEmployee } from '../types/salaryReport';
import type {
  ProjectCostReport,
  ProjectEmployeeEntry,
  SalaryReconciliationSummary,
} from '../types/projectCostReport';

const MATCH_TOLERANCE = 0.5;

function sumProjectCosts(projects: SalaryReportEmployee['projects']) {
  let base = 0;
  let ot = 0;
  let hours = 0;
  for (const p of projects) {
    base += p.baseValue;
    ot += p.overtimeValue;
    hours += p.workingHours;
  }
  return { base, ot, total: base + ot, hours };
}

export function buildSalaryReconciliationSummary(
  report: SalaryReportEmployee[]
): SalaryReconciliationSummary {
  const employees = report.map((emp) => {
    const { base, ot, total, hours } = sumProjectCosts(emp.projects);
    return {
      employeeId: emp.employee.id,
      employeeName: emp.employee.name,
      department: emp.employee.department,
      baseSalary: emp.baseSalary,
      overtimeAmount: emp.overtimeAmount,
      totalSalary: emp.totalSalary,
      projectBaseCost: base,
      projectOvertimeCost: ot,
      projectTotalCost: total,
      variance: emp.totalSalary - total,
      projectHours: hours,
      totalHours: emp.totalHours,
      hoursVariance: emp.totalHours - hours,
    };
  });

  employees.sort((a, b) =>
    a.employeeName.toLowerCase().localeCompare(b.employeeName.toLowerCase())
  );

  const projectReport = pivotSalaryReportByProject(report);
  const projects = projectReport.map((p) => ({
    projectName: p.projectName,
    totalWorkingHours: p.totalWorkingHours,
    totalBaseValue: p.totalBaseValue,
    totalOvertimeValue: p.totalOvertimeValue,
    totalCost: p.totalCost,
  }));

  const grandBaseSalary = employees.reduce((s, e) => s + e.baseSalary, 0);
  const grandOvertime = employees.reduce((s, e) => s + e.overtimeAmount, 0);
  const grandTotalSalary = employees.reduce((s, e) => s + e.totalSalary, 0);
  const grandProjectBase = employees.reduce((s, e) => s + e.projectBaseCost, 0);
  const grandProjectOvertime = employees.reduce((s, e) => s + e.projectOvertimeCost, 0);
  const grandProjectCost = employees.reduce((s, e) => s + e.projectTotalCost, 0);
  const grandVariance = grandTotalSalary - grandProjectCost;

  return {
    periodDays: report[0]?.periodDays ?? 0,
    employeeCount: employees.length,
    projectCount: projects.length,
    grandBaseSalary,
    grandOvertime,
    grandTotalSalary,
    grandProjectBase,
    grandProjectOvertime,
    grandProjectCost,
    grandVariance,
    isMatched: Math.abs(grandVariance) <= MATCH_TOLERANCE,
    employees,
    projects,
  };
}

export function pivotSalaryReportByProject(
  report: SalaryReportEmployee[],
  projectFilter?: string | null
): ProjectCostReport[] {
  const map = new Map<string, ProjectEmployeeEntry[]>();

  for (const emp of report) {
    for (const p of emp.projects) {
      if (projectFilter && p.projectName !== projectFilter) continue;

      const list = map.get(p.projectName) ?? [];
      list.push({
        employeeId: emp.employee.id,
        employeeName: emp.employee.name,
        department: emp.employee.department,
        hourlyRate: emp.hourlyRate,
        workingHours: p.workingHours,
        baseValue: p.baseValue,
        overtimeHours: p.overtimeHours,
        overtimeRate: p.overtimeRate,
        overtimeValue: p.overtimeValue,
        totalValue: p.baseValue + p.overtimeValue,
      });
      map.set(p.projectName, list);
    }
  }

  return Array.from(map.entries())
    .map(([projectName, employees]) => {
      employees.sort((a, b) =>
        a.employeeName.toLowerCase().localeCompare(b.employeeName.toLowerCase())
      );
      return {
        projectName,
        employees,
        totalWorkingHours: employees.reduce((s, e) => s + e.workingHours, 0),
        totalBaseValue: employees.reduce((s, e) => s + e.baseValue, 0),
        totalOvertimeHours: employees.reduce((s, e) => s + e.overtimeHours, 0),
        totalOvertimeValue: employees.reduce((s, e) => s + e.overtimeValue, 0),
        totalCost: employees.reduce((s, e) => s + e.totalValue, 0),
      };
    })
    .sort((a, b) => a.projectName.localeCompare(b.projectName));
}
