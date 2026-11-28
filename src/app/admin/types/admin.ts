export interface Employee {
  id: string;
  name: string;
  employee_id: string;
  position: string;
  department: string;
  status: string;
  salary?: number | null;
  /** When false, overtime is disabled for this employee (Construction / Maintenance). */
  overtime_enabled?: boolean | null;
  /** YYYY-MM-DD. Attendance Report hides expected days before this date. */
  joining_date?: string | null;
}

export interface EmployeeUpdatePayload {
  name?: string;
  position?: string;
  department?: string;
  status?: string;
  salary?: number | null;
  overtime_enabled?: boolean | null;
  joining_date?: string | null;
}

export interface EmployeeHistoryRecord {
  id: string;
  employee_id: string;
  action: string;
  details: string | null;
  created_at: string;
}

/**
 * Approved vacation period for one employee (`employee_vacations`).
 * The Attendance Report treats days inside the range as Vacation, not missing.
 */
export interface EmployeeVacation {
  id: string;
  employee_id: string;
  /** YYYY-MM-DD */
  from_date: string;
  /** YYYY-MM-DD, inclusive */
  to_date: string;
  note?: string | null;
  created_at?: string;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  status: string;
  status_attendance: string;
  notes: string;
  Employee: Employee;
  employee_name?: string;
  department?: string;
}

export interface AttendanceRecordWithDetails
  extends Omit<AttendanceRecord, 'Employee'> {
  employee_name: string;
  department: string;
}

export interface DepartmentAttendance {
  department: string;
  hasAttendance: boolean;
}

export interface StatusSummary {
  status: string;
  count: number;
}

export interface SummaryRecord {
  status_attendance: string;
  Employee: {
    department: string;
  }[];
}

export type UserRole = 'admin' | 'manager' | 'supervisor' | 'regular_user';

export interface SystemUser {
  id: string;
  email: string;
  role: UserRole | string;
  department: string | null;
}

