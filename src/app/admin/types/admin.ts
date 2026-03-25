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
}

export interface EmployeeUpdatePayload {
  name?: string;
  position?: string;
  department?: string;
  status?: string;
  salary?: number | null;
  overtime_enabled?: boolean | null;
}

export interface EmployeeHistoryRecord {
  id: string;
  employee_id: string;
  action: string;
  details: string | null;
  created_at: string;
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

