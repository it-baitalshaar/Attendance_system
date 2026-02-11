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
}

export async function fetchLeaveReportService(
  filters: LeaveReportFilters
): Promise<LeaveReportRow[]> {
  const supabase = createSupabbaseFrontendClient();

  const { data, error } = await supabase
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

  if (error) {
    throw error;
  }

  if (!data) {
    return [];
  }

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

  data.forEach((record: any) => {
    const employee = Array.isArray(record.Employee)
      ? record.Employee[0]
      : record.Employee;

    const employeeId = record.employee_id;

    if (employee?.status !== 'active') {
      return;
    }

    if (!employeeLeaveCounts[employeeId]) {
      employeeLeaveCounts[employeeId] = {
        employee_id: employeeId,
        employee_name: employee?.name || 'Unknown',
        department: employee?.department || 'Unknown',
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

  return Object.values(employeeLeaveCounts).map((employee) => ({
    ...employee,
    total:
      employee.sick_leave +
      employee.personal_leave +
      employee.absence_without_excuse,
  }));
}

