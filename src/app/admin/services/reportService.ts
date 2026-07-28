import { createSupabbaseFrontendClient } from '@/lib/supabase';

export interface LeaveReportRow {
  employee_id: string;
  employee_name: string;
  department: string;
  sick_leave: number;
  personal_leave: number;
  absence_without_excuse: number;
  total: number;
}

export interface LeaveReportFilters {
  startDate: string;
  endDate: string;
  /** When set, only rows for this department (case-insensitive). */
  department?: string | null;
  /** When set, only this employee. */
  employeeId?: string | null;
}

export async function fetchLeaveReportService(
  filters: LeaveReportFilters
): Promise<LeaveReportRow[]> {
  const supabase = createSupabbaseFrontendClient();

  let query = supabase
    .from('Attendance')
    .select(
      `
        employee_id,
        status_attendance,
        Employee:Employee (
          name,
          department,
          status
        )
      `
    )
    .gte('date', filters.startDate)
    .lte('date', filters.endDate)
    .in('status_attendance', [
      'Sick Leave',
      'Absence with excuse',
      'Absence without excuse',
    ]);

  if (filters.employeeId?.trim()) {
    query = query.eq('employee_id', filters.employeeId.trim());
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  if (!data) {
    return [];
  }

  const deptFilter = filters.department?.trim().toLowerCase() || null;

  const employeeLeaveCounts: {
    [key: string]: {
      employee_id: string;
      employee_name: string;
      department: string;
      sick_leave: number;
      personal_leave: number;
      absence_without_excuse: number;
    };
  } = {};

  data.forEach((record: {
    employee_id: string;
    status_attendance: string | null;
    Employee:
      | { name?: string; department?: string; status?: string }
      | { name?: string; department?: string; status?: string }[]
      | null;
  }) => {
    const employee = Array.isArray(record.Employee)
      ? record.Employee[0]
      : record.Employee;

    const employeeId = record.employee_id;

    if (employee?.status !== 'active') {
      return;
    }

    const department = employee?.department || 'Unknown';
    if (deptFilter && department.toLowerCase() !== deptFilter) {
      return;
    }

    if (!employeeLeaveCounts[employeeId]) {
      employeeLeaveCounts[employeeId] = {
        employee_id: employeeId,
        employee_name: employee?.name || 'Unknown',
        department,
        sick_leave: 0,
        personal_leave: 0,
        absence_without_excuse: 0,
      };
    }

    switch (record.status_attendance) {
      case 'Sick Leave':
        employeeLeaveCounts[employeeId].sick_leave++;
        break;
      case 'Absence with excuse':
        employeeLeaveCounts[employeeId].personal_leave++;
        break;
      case 'Absence without excuse':
        employeeLeaveCounts[employeeId].absence_without_excuse++;
        break;
    }
  });

  return Object.values(employeeLeaveCounts)
    .map((employee) => ({
      ...employee,
      total:
        employee.sick_leave +
        employee.personal_leave +
        employee.absence_without_excuse,
    }))
    .sort((a, b) => {
      const deptCmp = a.department.localeCompare(b.department);
      if (deptCmp !== 0) return deptCmp;
      return a.employee_name.localeCompare(b.employee_name);
    });
}
