import { createSupabbaseFrontendClient } from '@/lib/supabase';
import {
  AttendanceRecordWithDetails,
  StatusSummary,
  SummaryRecord,
} from '../types/admin';

export interface AttendanceFilters {
  startDate: string;
  endDate: string;
  selectedEmployeeId: string;
  selectedDepartment: string;
  selectedStatus: string;
  currentPage: number;
  recordsPerPage: number;
}

export interface AttendanceServiceResult {
  records: AttendanceRecordWithDetails[];
  totalRecords: number;
  statusSummary: StatusSummary[];
}

export async function fetchAttendanceService(
  filters: AttendanceFilters
): Promise<AttendanceServiceResult> {
  const supabase = createSupabbaseFrontendClient();

  // Status summary query
  let summaryQuery = supabase
    .from('Attendance')
    .select(
      `
        status_attendance,
        Employee:Employee (
          department
        )
      `
    )
    .gte('date', filters.startDate)
    .lte('date', filters.endDate);

  if (filters.selectedEmployeeId !== 'all') {
    summaryQuery = summaryQuery.eq('employee_id', filters.selectedEmployeeId);
  }

  if (filters.selectedStatus !== 'all') {
    summaryQuery = summaryQuery.eq('status_attendance', filters.selectedStatus);
  }

  const { data: summaryData } = await summaryQuery;

  let statusSummary: StatusSummary[] = [];

  if (summaryData) {
    const summaryRecords =
      summaryData as unknown as SummaryRecord[];

    const summary = summaryRecords.reduce(
      (acc: { [key: string]: number }, curr: SummaryRecord) => {
        if (curr.status_attendance) {
          acc[curr.status_attendance] =
            (acc[curr.status_attendance] || 0) + 1;
        }
        return acc;
      },
      {}
    );

    statusSummary = Object.entries(summary).map(([status, count]) => ({
      status,
      count,
    }));
  }

  // Count query for pagination
  let countQuery = supabase
    .from('Attendance')
    .select('id', { count: 'exact' })
    .gte('date', filters.startDate)
    .lte('date', filters.endDate);

  if (filters.selectedEmployeeId !== 'all') {
    countQuery = countQuery.eq('employee_id', filters.selectedEmployeeId);
  }

  if (filters.selectedStatus !== 'all') {
    countQuery = countQuery.eq('status_attendance', filters.selectedStatus);
  }

  const { count } = await countQuery;

  // Main records query
  let query = supabase
    .from('Attendance')
    .select(
      `
        id,
        employee_id,
        date,
        status,
        status_attendance,
        notes,
        Employee:Employee (
          name,
          department
        )
      `
    )
    .gte('date', filters.startDate)
    .lte('date', filters.endDate)
    .order('date', { ascending: false })
    .range(
      (filters.currentPage - 1) * filters.recordsPerPage,
      filters.currentPage * filters.recordsPerPage - 1
    );

  if (filters.selectedEmployeeId !== 'all') {
    query = query.eq('employee_id', filters.selectedEmployeeId);
  }

  if (filters.selectedStatus !== 'all') {
    query = query.eq('status_attendance', filters.selectedStatus);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  let records: AttendanceRecordWithDetails[] = [];

  if (data) {
    records = (data as any[]).map((record) => {
      const employee = Array.isArray(record.Employee)
        ? record.Employee[0]
        : record.Employee;

      return {
        id: record.id,
        employee_id: record.employee_id,
        date: record.date,
        status: record.status,
        status_attendance: record.status_attendance,
        notes: record.notes,
        employee_name: employee?.name || 'Unknown',
        department: employee?.department || 'Unknown',
      };
    });
  }

  return {
    records,
    totalRecords: count || 0,
    statusSummary,
  };
}

