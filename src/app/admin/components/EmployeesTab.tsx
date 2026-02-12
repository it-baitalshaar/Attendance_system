import { useEmployeeFilters } from '../hooks/useEmployeeFilters';
import { EmployeeFilters } from './employees';
import { Employee } from '../types/admin';

interface NewEmployeeState {
  name: string;
  position: string;
  department: string;
  employee_id: string;
}

interface EmployeesTabProps {
  employees: Employee[];
  newEmployee: NewEmployeeState;
  loading: boolean;
  message: string;
  onInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function EmployeesTab({
  employees,
  newEmployee,
  loading,
  message,
  onInputChange,
  onSubmit,
}: EmployeesTabProps) {
  const {
    filteredEmployees,
    hasActiveFilters,
    filterOptions,
    filters,
    setSearchQuery,
    setFilterDepartment,
    setFilterStatus,
    setFilterPosition,
    resetFilters,
  } = useEmployeeFilters(employees);

  return (
    <>
      <div className="mb-8 p-4 bg-white rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Add New Employee</h2>

        <form onSubmit={onSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                name="name"
                value={newEmployee.name}
                onChange={onInputChange}
                className="w-full p-2 border rounded"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Employee ID
              </label>
              <input
                type="text"
                name="employee_id"
                value={newEmployee.employee_id}
                onChange={onInputChange}
                className="w-full p-2 border rounded"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Position</label>
              <input
                type="text"
                name="position"
                value={newEmployee.position}
                onChange={onInputChange}
                className="w-full p-2 border rounded"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Department
              </label>
              <select
                name="department"
                value={newEmployee.department}
                onChange={onInputChange}
                className="w-full p-2 border rounded"
                required
              >
                <option value="">Select Department</option>
                <option value="Maintenance">Maintenance</option>
                <option value="constructions">Construction</option>
                <option value="Others">Others</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            disabled={loading}
          >
            {loading ? 'Adding...' : 'Add Employee'}
          </button>

          {message && (
            <p
              className={`mt-2 ${
                message.includes('Failed')
                  ? 'text-red-500'
                  : 'text-green-500'
              }`}
            >
              {message}
            </p>
          )}
        </form>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">Employee List</h2>
          <EmployeeFilters
            searchQuery={filters.searchQuery}
            filterDepartment={filters.filterDepartment}
            filterStatus={filters.filterStatus}
            filterPosition={filters.filterPosition}
            departments={filterOptions.departments}
            statuses={filterOptions.statuses}
            positions={filterOptions.positions}
            onSearchChange={setSearchQuery}
            onDepartmentChange={setFilterDepartment}
            onStatusChange={setFilterStatus}
            onPositionChange={setFilterPosition}
            onReset={resetFilters}
          />
        </div>

        {loading ? (
          <p className="p-4 text-center">Loading employees...</p>
        ) : employees.length > 0 && filteredEmployees.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {employee.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {employee.employee_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {employee.position}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {employee.department}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          employee.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {employee.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-4 text-center">
            {hasActiveFilters
              ? 'No employees match your filters'
              : 'No employees found'}
          </p>
        )}
      </div>
    </>
  );
}

