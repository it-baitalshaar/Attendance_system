import { AttendanceRecordWithDetails } from '../../types/admin';
import { getStatusColor, getStatusLabel, formatDisplayDate } from '../../utils/adminAttendanceUtils';

interface AttendanceRecordsTableProps {
  records: AttendanceRecordWithDetails[];
  loading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function AttendanceRecordsTable({
  records,
  loading,
  currentPage,
  totalPages,
  onPageChange,
}: AttendanceRecordsTableProps) {
  if (loading) {
    return <p className="p-4 text-center">Loading attendance records...</p>;
  }
  if (records.length === 0) {
    return (
      <p className="p-4 text-center">
        No attendance records found for the selected filters
      </p>
    );
  }
  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {records.map((record) => (
              <tr key={record.id}>
                <td className="px-6 py-4 whitespace-nowrap">{formatDisplayDate(record.date)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{record.employee_name}</td>
                <td className="px-6 py-4 whitespace-nowrap">{record.department}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                      record.status,
                      record.status_attendance
                    )}`}
                  >
                    {getStatusLabel(record.status, record.status_attendance)}
                  </span>
                </td>
                <td className="px-6 py-4">{record.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-center items-center space-x-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Previous
        </button>
        <span>Page {currentPage} of {totalPages}</span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </>
  );
}
