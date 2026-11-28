import {
  EmployeeSortKey,
  parseSortValue,
  useEmployeeFilters,
} from '../hooks/useEmployeeFilters';
import { EmployeeFilters, ManageEmployeePanel } from './employees';
import { Employee, EmployeeHistoryRecord, EmployeeVacation } from '../types/admin';

interface NewEmployeeState {
  name: string;
  position: string;
  department: string;
  employee_id: string;
  salary: string;
  /** YYYY-MM-DD, empty when unknown. */
  joining_date: string;
}

interface EmployeesTabProps {
  employees: Employee[];
  newEmployee: NewEmployeeState;
  departments: string[];
  loading: boolean;
  message: string;
  autoEmployeeId?: string;
  employeeIdEdited?: boolean;
  onUseAutoEmployeeId?: () => void;
  onInputChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  onSubmit: (e: React.FormEvent) => void;
  manageEmployeeId: string | null;
  setManageEmployeeId: (id: string | null) => void;
  selectedEmployee: Employee | undefined;
  employeeHistory: EmployeeHistoryRecord[];
  historyLoading: boolean;
  updateMessage: string;
  setUpdateMessage: (msg: string) => void;
  updateLoading: boolean;
  onUpdateEmployee: (id: string, payload: import('../types/admin').EmployeeUpdatePayload) => Promise<void>;
  employeeVacations: EmployeeVacation[];
  vacationLoading: boolean;
  vacationMessage: string;
  vacationSaving: boolean;
  onAddVacation: (payload: { from_date: string; to_date: string; note?: string }) => Promise<void>;
  onDeleteVacation: (id: string) => Promise<void>;
}

export function EmployeesTab({
  employees,
  newEmployee,
  departments,
  loading,
  message,
  autoEmployeeId,
  employeeIdEdited,
  onUseAutoEmployeeId,
  onInputChange,
  onSubmit,
  manageEmployeeId,
  setManageEmployeeId,
  selectedEmployee,
  employeeHistory,
  historyLoading,
  updateMessage,
  setUpdateMessage,
  updateLoading,
  onUpdateEmployee,
  employeeVacations,
  vacationLoading,
  vacationMessage,
  vacationSaving,
  onAddVacation,
  onDeleteVacation,
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
    sortValue,
    setSortValue,
    toggleSort,
    resetFilters,
  } = useEmployeeFilters(employees);

  const { key: sortKey, direction: sortDirection } = parseSortValue(sortValue);

  const sortAria = (
    key: EmployeeSortKey
  ): 'ascending' | 'descending' | 'none' =>
    sortKey === key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';

  const sortableHeader = (key: EmployeeSortKey, label: string) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      className="inline-flex items-center gap-1 font-medium uppercase tracking-wider text-gray-500 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
      title={`Sort by ${label.toLowerCase()} (${sortKey === key && sortDirection === 'asc' ? 'descending next' : 'ascending next'})`}
    >
      {label}
      <span className={sortKey === key ? 'text-blue-600' : 'text-gray-300'}>
        {sortKey === key ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
      </span>
    </button>
  );

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
              <div className="flex gap-2">
                <input
                  type="text"
                  name="employee_id"
                  value={newEmployee.employee_id}
                  onChange={onInputChange}
                  placeholder={autoEmployeeId || 'e.g. BS0055'}
                  className="w-full p-2 border rounded font-mono"
                  required
                />
                {autoEmployeeId &&
                  newEmployee.employee_id !== autoEmployeeId && (
                    <button
                      type="button"
                      onClick={onUseAutoEmployeeId}
                      className="shrink-0 px-3 text-sm border border-blue-600 text-blue-700 rounded hover:bg-blue-50"
                      title="Use the next free ID"
                    >
                      Use {autoEmployeeId}
                    </button>
                  )}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {newEmployee.department ? (
                  <>
                    Next free ID for {newEmployee.department}:{' '}
                    <span className="font-mono font-medium text-gray-700">
                      {autoEmployeeId}
                    </span>{' '}
                    — from Employee + BioTime. Editable; verify against BioTime.
                    {employeeIdEdited && (
                      <span className="text-amber-600"> Manual override.</span>
                    )}
                  </>
                ) : (
                  'Select a department to auto-fill the next ID (SA for Saqiya, BS for Construction/Maintenance).'
                )}
              </p>
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
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Salary (optional)
              </label>
              <input
                type="number"
                name="salary"
                min={0}
                step={0.01}
                value={newEmployee.salary}
                onChange={onInputChange}
                className="w-full p-2 border rounded"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Joining date (optional)
              </label>
              <input
                type="date"
                name="joining_date"
                value={newEmployee.joining_date}
                onChange={onInputChange}
                className="w-full p-2 border rounded"
              />
              <p className="mt-1 text-xs text-gray-500">
                Days before this date are hidden from the Attendance Report, so a
                mid-month hire does not show as “no attendance record”.
              </p>
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
            departments={(() => {
              const all = [...departments, ...filterOptions.departments].filter(Boolean);
              const byLower = new Map<string, string>();
              for (const d of all) {
                const lower = d.toLowerCase();
                if (!byLower.has(lower)) byLower.set(lower, d);
              }
              return Array.from(byLower.values()).sort();
            })()}
            statuses={filterOptions.statuses}
            positions={filterOptions.positions}
            onSearchChange={setSearchQuery}
            onDepartmentChange={setFilterDepartment}
            onStatusChange={setFilterStatus}
            onPositionChange={setFilterPosition}
            sortValue={sortValue}
            onSortChange={setSortValue}
            onReset={resetFilters}
          />
        </div>

        {loading ? (
          <div className="p-8 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-600">Loading employees...</p>
          </div>
        ) : employees.length > 0 && filteredEmployees.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th aria-sort={sortAria('name')} className="px-6 py-3 text-left text-xs">
                    {sortableHeader('name', 'Name')}
                  </th>
                  <th aria-sort={sortAria('employee_id')} className="px-6 py-3 text-left text-xs">
                    {sortableHeader('employee_id', 'ID')}
                  </th>
                  <th aria-sort={sortAria('position')} className="px-6 py-3 text-left text-xs">
                    {sortableHeader('position', 'Position')}
                  </th>
                  <th aria-sort={sortAria('department')} className="px-6 py-3 text-left text-xs">
                    {sortableHeader('department', 'Department')}
                  </th>
                  <th aria-sort={sortAria('status')} className="px-6 py-3 text-left text-xs">
                    {sortableHeader('status', 'Status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id ?? employee.employee_id}>
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
                      {employee.joining_date && (
                        <div className="text-xs text-gray-400 mt-1">
                          Joined {employee.joining_date.slice(0, 10)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          setManageEmployeeId(employee.id ?? employee.employee_id)
                        }
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        Manage
                      </button>
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

      {selectedEmployee && (
        <ManageEmployeePanel
          employee={selectedEmployee}
          departments={departments}
          onClose={() => {
            setManageEmployeeId(null);
            setUpdateMessage('');
          }}
          onUpdate={onUpdateEmployee}
          updateLoading={updateLoading}
          updateMessage={updateMessage}
          history={employeeHistory}
          historyLoading={historyLoading}
          vacations={employeeVacations}
          vacationLoading={vacationLoading}
          vacationMessage={vacationMessage}
          vacationSaving={vacationSaving}
          onAddVacation={onAddVacation}
          onDeleteVacation={onDeleteVacation}
        />
      )}
    </>
  );
}

