import { StatusSummary } from '../../types/admin';
import { getStatusColor } from '../../utils/adminAttendanceUtils';

interface AttendanceStatusSummaryProps {
  statusSummary: StatusSummary[];
}

export function AttendanceStatusSummary({ statusSummary }: AttendanceStatusSummaryProps) {
  if (statusSummary.length === 0) return null;
  return (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-medium mb-3">Status Summary</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {statusSummary.map((item) => (
          <div
            key={item.status}
            className={`p-3 rounded-lg text-center ${getStatusColor(item.status, item.status)}`}
          >
            <div className="text-sm font-medium">{item.status}</div>
            <div className="text-2xl font-bold">{item.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
