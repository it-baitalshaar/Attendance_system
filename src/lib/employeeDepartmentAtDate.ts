/**
 * Resolve which department an employee belonged to on a given date.
 * Uses Attendance.department when stored, else Employee_history undo chain, else current Employee.department.
 */

export interface EmployeeDepartmentHistoryRow {
  employee_id: string;
  created_at: string;
  details: string | null;
}

export function parseDepartmentChange(
  details: string | null | undefined
): { from: string; to: string } | null {
  if (!details) return null;
  const match = details.match(/Department:\s*(.+?)\s*->\s*(.+?)(?:\s*;|\s*$)/i);
  if (!match) return null;
  return { from: match[1].trim(), to: match[2].trim() };
}

export function normalizeReportDate(dateStr: string): string {
  return dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
}

export function departmentsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
}

export function buildEmployeeDepartmentResolver(
  employees: { employee_id: string; department?: string | null }[],
  history: EmployeeDepartmentHistoryRow[]
): (employeeId: string, date: string) => string {
  const currentById = new Map(
    employees.map((e) => [e.employee_id, (e.department ?? '').trim()])
  );

  const changesByEmployee = new Map<string, { date: string; from: string; to: string }[]>();
  for (const row of history) {
    const parsed = parseDepartmentChange(row.details);
    if (!parsed) continue;
    const date = normalizeReportDate(row.created_at);
    const list = changesByEmployee.get(row.employee_id) ?? [];
    list.push({ date, from: parsed.from, to: parsed.to });
    changesByEmployee.set(row.employee_id, list);
  }
  for (const list of Array.from(changesByEmployee.values())) {
    list.sort((a, b) => a.date.localeCompare(b.date));
  }

  return (employeeId: string, date: string) => {
    const dateKey = normalizeReportDate(date);
    let dept = currentById.get(employeeId) ?? '';
    const changes = changesByEmployee.get(employeeId) ?? [];
    for (let i = changes.length - 1; i >= 0; i--) {
      if (changes[i].date > dateKey) {
        dept = changes[i].from;
      }
    }
    return dept;
  };
}

export function resolveAttendanceDepartment(
  row: { employee_id: string; date: string; department?: string | null },
  resolveDept: (employeeId: string, date: string) => string
): string {
  const stored = row.department?.trim();
  if (stored) return stored;
  return resolveDept(row.employee_id, row.date);
}

export function filterAttendanceRowsByDepartment<
  T extends { employee_id: string; date: string; department?: string | null },
>(rows: T[], departmentFilter: string, resolveDept: (employeeId: string, date: string) => string): T[] {
  const target = departmentFilter.trim();
  if (!target) return rows;
  return rows.filter((row) =>
    departmentsMatch(resolveAttendanceDepartment(row, resolveDept), target)
  );
}
