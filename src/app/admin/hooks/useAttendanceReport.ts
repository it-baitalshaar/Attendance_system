import { useState, useCallback } from 'react';
import type { AttendanceReportEmployeeReport } from '../types/attendanceReport';

export interface AttendanceReportState {
  report: AttendanceReportEmployeeReport[];
  from: string;
  to: string;
}

export function useAttendanceReport() {
  const [report, setReport] = useState<AttendanceReportEmployeeReport[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectsWarning, setProjectsWarning] = useState<string | null>(null);

  const fetchReport = useCallback(
    async (
      fromDate: string,
      toDate: string,
      department?: string | null,
      employeeId?: string | null
    ) => {
      if (!fromDate || !toDate) {
        setError('Please select both from and to dates.');
        return;
      }
      setLoading(true);
      setError(null);
      setProjectsWarning(null);
      try {
        const params = new URLSearchParams({ from: fromDate, to: toDate });
        if (department) params.set('department', department);
        if (employeeId) params.set('employee_id', employeeId);
        const res = await fetch(`/api/attendance-report?${params}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? data.details ?? 'Failed to load report');
          setReport([]);
          return;
        }
        setReport(data.report ?? []);
        setFrom(data.from ?? fromDate);
        setTo(data.to ?? toDate);
        if (data.projectsUnavailable) {
          setError(null);
          const detail =
            typeof data.projectsError === 'string' && data.projectsError
              ? ` (${data.projectsError})`
              : '';
          setProjectsWarning(
            `Report loaded. Project hours could not be loaded${detail}.`
          );
        } else {
          setProjectsWarning(null);
        }
      } catch (e) {
        setError('Failed to load report');
        setReport([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { report, from, to, loading, error, projectsWarning, fetchReport };
}
