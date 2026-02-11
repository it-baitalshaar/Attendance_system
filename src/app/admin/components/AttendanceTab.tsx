import { AttendanceRecordWithDetails, DepartmentAttendance, StatusSummary } from '../types/admin';
import { AttendanceFiltersSection } from './attendance/AttendanceFiltersSection';
import { AttendanceDepartmentWarnings } from './attendance/AttendanceDepartmentWarnings';
import { AttendanceRecordsTable } from './attendance/AttendanceRecordsTable';

interface AttendanceTabProps {
  attendanceRecords: AttendanceRecordWithDetails[];
  attendanceLoading: boolean;
  statusSummary: StatusSummary[];
  departmentWarnings: DepartmentAttendance[];
  dateRange: { startDate: string; endDate: string };
  selectedEmployeeId: string;
  selectedDepartment: string;
  selectedStatus: string;
  employees: { id: string; name: string; employee_id: string }[];
  departments: string[];
  currentPage: number;
  totalPages: number;
  onDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEmployeeChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onApplyFilters: () => void;
}

export function AttendanceTab({
  attendanceRecords,
  attendanceLoading,
  statusSummary,
  departmentWarnings,
  dateRange,
  selectedEmployeeId,
  selectedDepartment,
  selectedStatus,
  employees,
  departments,
  currentPage,
  totalPages,
  onDateChange,
  onEmployeeChange,
  onDepartmentChange,
  onStatusChange,
  onPageChange,
  onApplyFilters,
}: AttendanceTabProps) {
  return (
    <div className="bg-white rounded-lg shadow">
      <AttendanceFiltersSection
        statusSummary={statusSummary}
        dateRange={dateRange}
        selectedEmployeeId={selectedEmployeeId}
        selectedDepartment={selectedDepartment}
        selectedStatus={selectedStatus}
        employees={employees}
        departments={departments}
        onDateChange={onDateChange}
        onEmployeeChange={onEmployeeChange}
        onDepartmentChange={onDepartmentChange}
        onStatusChange={onStatusChange}
        onApplyFilters={onApplyFilters}
      />
      <AttendanceDepartmentWarnings departmentWarnings={departmentWarnings} />
      <AttendanceRecordsTable
        records={attendanceRecords}
        loading={attendanceLoading}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />
    </div>
  );
}
