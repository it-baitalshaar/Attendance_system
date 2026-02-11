import { StatusSummary } from '../../types/admin';
import { AttendanceStatusSummary } from './AttendanceStatusSummary';

interface AttendanceFiltersSectionProps {
  statusSummary: StatusSummary[];
  dateRange: { startDate: string; endDate: string };
  selectedEmployeeId: string;
  selectedDepartment: string;
  selectedStatus: string;
  employees: { id: string; name: string; employee_id: string }[];
  departments: string[];
  onDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEmployeeChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onApplyFilters: () => void;
}

export function AttendanceFiltersSection({
  statusSummary,
  dateRange,
  selectedEmployeeId,
  selectedDepartment,
  selectedStatus,
  employees,
  departments,
  onDateChange,
  onEmployeeChange,
  onDepartmentChange,
  onStatusChange,
  onApplyFilters,
}: AttendanceFiltersSectionProps) {
  return (
    <div className="p-4 border-b">
      <h2 className="text-xl font-semibold mb-4">Attendance Records</h2>
      <AttendanceStatusSummary statusSummary={statusSummary} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Start Date</label>
          <input
            type="date"
            name="startDate"
            value={dateRange.startDate}
            onChange={onDateChange}
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">End Date</label>
          <input
            type="date"
            name="endDate"
            value={dateRange.endDate}
            onChange={onDateChange}
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Employee</label>
          <select
            value={selectedEmployeeId}
            onChange={(e) => onEmployeeChange(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="all">All Employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.employee_id}>{emp.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Department</label>
          <select
            value={selectedDepartment}
            onChange={(e) => onDepartmentChange(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="all">All Departments</option>
            {departments.map((dept, i) => (
              <option key={i} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full p-2 border rounded"
          >
            <option value="all">All Status</option>
            <option value="Present">Present</option>
            <option value="Sick Leave">Sick Leave</option>
            <option value="Absence with excuse">Absence with excuse</option>
            <option value="Absence without excuse">Absence without excuse</option>
            <option value="Holiday-Work">Holiday Work</option>
            <option value="Weekend">Weekend</option>
          </select>
        </div>
      </div>
      <button
        onClick={onApplyFilters}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Apply Filters
      </button>
    </div>
  );
}
