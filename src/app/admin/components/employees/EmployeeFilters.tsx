import { FILTER_ALL } from '../../hooks/useEmployeeFilters';

export interface EmployeeFiltersProps {
  searchQuery: string;
  filterDepartment: string;
  filterStatus: string;
  filterPosition: string;
  departments: string[];
  statuses: string[];
  positions: string[];
  onSearchChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPositionChange: (value: string) => void;
  onReset?: () => void;
  searchPlaceholder?: string;
  /** Optional custom class for the container */
  className?: string;
}

/**
 * Reusable filter UI for employee lists: search input + department, status, position dropdowns.
 * Use with useEmployeeFilters hook for full functionality.
 */
export function EmployeeFilters({
  searchQuery,
  filterDepartment,
  filterStatus,
  filterPosition,
  departments,
  statuses,
  positions,
  onSearchChange,
  onDepartmentChange,
  onStatusChange,
  onPositionChange,
  onReset,
  searchPlaceholder = 'Search by name, ID, or department...',
  className = '',
}: EmployeeFiltersProps) {
  return (
    <div className={`flex flex-col sm:flex-row gap-3 ${className}`}>
      <input
        type="text"
        placeholder={searchPlaceholder}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="px-3 py-2 border rounded text-sm min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Search employees"
      />
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={filterDepartment}
          onChange={(e) => onDepartmentChange(e.target.value)}
          className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          aria-label="Filter by department"
        >
          <option value={FILTER_ALL}>All Departments</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          aria-label="Filter by status"
        >
          <option value={FILTER_ALL}>All Status</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          value={filterPosition}
          onChange={(e) => onPositionChange(e.target.value)}
          className="px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          aria-label="Filter by position"
        >
          <option value={FILTER_ALL}>All Positions</option>
          {positions.map((pos) => (
            <option key={pos} value={pos}>
              {pos}
            </option>
          ))}
        </select>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
