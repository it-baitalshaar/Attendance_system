import type { SalaryReportEmployee } from '../types/salaryReport';
import type {
  ProjectCostReport,
  ProjectEmployeeEntry,
  EmployeeReconciliationRow,
  SalaryReconciliationSummary,
} from '../types/projectCostReport';

const MATCH_TOLERANCE = 0.5;
const HOURS_TOLERANCE = 0.01;

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

function classifyVariance(input: {
  hoursVariance: number;
  variance: number;
  sickLeaveHours: number;
}): Pick<
  EmployeeReconciliationRow,
  | 'sickLeaveExplainedHours'
  | 'unexplainedHours'
  | 'varianceReason'
> {
  const { hoursVariance, variance, sickLeaveHours } = input;
  const positiveGap = Math.max(0, hoursVariance);
  const sickLeaveExplainedHours = Math.min(positiveGap, Math.max(0, sickLeaveHours));
  const unexplainedHours =
    hoursVariance > 0
      ? hoursVariance - sickLeaveExplainedHours
      : hoursVariance;

  if (
    Math.abs(hoursVariance) <= HOURS_TOLERANCE &&
    Math.abs(variance) <= MATCH_TOLERANCE
  ) {
    return {
      sickLeaveExplainedHours: 0,
      unexplainedHours: 0,
      varianceReason: 'none',
    };
  }

  if (Math.abs(unexplainedHours) <= HOURS_TOLERANCE) {
    if (sickLeaveExplainedHours > HOURS_TOLERANCE) {
      return {
        sickLeaveExplainedHours,
        unexplainedHours: 0,
        varianceReason: 'sick_leave',
      };
    }
    return {
      sickLeaveExplainedHours: 0,
      unexplainedHours: 0,
      varianceReason: 'rounding',
    };
  }

  if (sickLeaveExplainedHours > HOURS_TOLERANCE) {
    return {
      sickLeaveExplainedHours,
      unexplainedHours,
      varianceReason: 'mixed',
    };
  }

  return {
    sickLeaveExplainedHours: 0,
    unexplainedHours,
    varianceReason: 'missing_project_hours',
  };
}

export function buildSalaryReconciliationSummary(
  report: SalaryReportEmployee[]
): SalaryReconciliationSummary {
  const employees: EmployeeReconciliationRow[] = report.map((emp) => {
    const { base, ot, total, hours } = sumProjectCosts(emp.projects);
    const hoursVariance = emp.totalHours - hours;
    const variance = emp.totalSalary - total;
    const classified = classifyVariance({
      hoursVariance,
      variance,
      sickLeaveHours: emp.sickLeaveHours,
    });

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
      variance,
      projectHours: hours,
      totalHours: emp.totalHours,
      hoursVariance,
      sickLeaveHours: emp.sickLeaveHours,
      sickLeaveDays: emp.sickLeaveDays,
      ...classified,
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
  const grandSickLeaveHours = employees.reduce((s, e) => s + e.sickLeaveHours, 0);
  const grandSickLeaveExplainedHours = employees.reduce(
    (s, e) => s + e.sickLeaveExplainedHours,
    0
  );
  const grandUnexplainedHours = employees.reduce(
    (s, e) => s + Math.max(0, e.unexplainedHours),
    0
  );

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
    isExplained: grandUnexplainedHours <= HOURS_TOLERANCE,
    grandSickLeaveHours,
    grandSickLeaveExplainedHours,
    grandUnexplainedHours,
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
        otNormal: p.otNormal,
        otHoliday: p.otHoliday,
        otPublicHoliday: p.otPublicHoliday,
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
