import { LeaveReportRow } from '../services/reportService';

interface ReportsTabProps {
  leaveReport: LeaveReportRow[];
  reportLoading: boolean;
  reportDateRange: { startDate: string; endDate: string };
  onReportDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGenerateReport: () => void;
}

export function ReportsTab({
  leaveReport,
  reportLoading,
  reportDateRange,
  onReportDateChange,
  onGenerateReport,
}: ReportsTabProps) {
  const totalSickLeave = leaveReport.reduce(
    (sum, emp) => sum + emp.sick_leave,
    0
  );
  const totalPersonalLeave = leaveReport.reduce(
    (sum, emp) => sum + emp.personal_leave,
    0
  );
  const totalAbsenceWithoutExcuse = leaveReport.reduce(
    (sum, emp) => sum + emp.absence_without_excuse,
    0
  );
  const totalOverall = leaveReport.reduce((sum, emp) => sum + emp.total, 0);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold mb-4">Leave Report</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              name="startDate"
              value={reportDateRange.startDate}
              onChange={onReportDateChange}
              className="w-full p-2 border rounded"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              name="endDate"
              value={reportDateRange.endDate}
              onChange={onReportDateChange}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>

        <button
          onClick={onGenerateReport}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Generate Report
        </button>
      </div>

      {reportLoading ? (
        <p className="p-4 text-center">Generating report...</p>
      ) : leaveReport.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sick Leave
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Absence with excuse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Absence without excuse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaveReport.map((employee) => (
                <tr key={employee.employee_id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    {employee.employee_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {employee.department}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        employee.sick_leave > 0
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {employee.sick_leave}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        employee.personal_leave > 0
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {employee.personal_leave}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        employee.absence_without_excuse > 0
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {employee.absence_without_excuse}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center font-bold">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        employee.total > 0
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {employee.total}
                    </span>
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-bold">
                <td className="px-6 py-4 whitespace-nowrap">TOTAL</td>
                <td className="px-6 py-4 whitespace-nowrap">-</td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                    {totalSickLeave}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                    {totalPersonalLeave}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                    {totalAbsenceWithoutExcuse}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                    {totalOverall}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="p-4 text-center">
          No leave data found for the selected date range
        </p>
      )}
    </div>
  );
}

