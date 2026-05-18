import { useState, useCallback } from 'react';
import type { SalaryReportEmployee } from '../types/salaryReport';

export function useSalaryReport() {
  const [report, setReport] = useState<SalaryReportEmployee[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(
    async (
      fromDate: string,
      toDate: string,
      department?: string | null,
      employeeId?: string | null
    ) => {
      if (!fromDate || !toDate) {
        setError('Please select a month.');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ from: fromDate, to: toDate });
        if (department) params.set('department', department);
        if (employeeId) params.set('employee_id', employeeId);
        const res = await fetch(`/api/salary-report?${params}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? data.details ?? 'Failed to load salary report');
          setReport([]);
          return;
        }
        setReport(data.report ?? []);
        setFrom(data.from ?? fromDate);
        setTo(data.to ?? toDate);
      } catch {
        setError('Failed to load salary report');
        setReport([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { report, from, to, loading, error, fetchReport };
}
