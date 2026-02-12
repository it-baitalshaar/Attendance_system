import { useEffect, useState } from 'react';
import {
  LeaveReportFilters,
  LeaveReportRow,
  fetchLeaveReportService,
} from '../services/reportService';

type AdminTab = 'employees' | 'departments' | 'users' | 'attendance' | 'profile' | 'reports' | 'reminders';

export function useLeaveReportDashboard(activeTab: AdminTab) {
  const [leaveReport, setLeaveReport] = useState<LeaveReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDateRange, setReportDateRange] = useState({
    startDate: '',
    endDate: '',
  });

  const initializeDatesOnce = () => {
    if (!reportDateRange.startDate || !reportDateRange.endDate) {
      const today = new Date();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      setReportDateRange({
        startDate: thirtyDaysAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      });
    }
  };

  useEffect(() => {
    initializeDatesOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLeaveReport = async () => {
    if (!reportDateRange.startDate || !reportDateRange.endDate) {
      return;
    }

    setReportLoading(true);
    try {
      const filters: LeaveReportFilters = {
        startDate: reportDateRange.startDate,
        endDate: reportDateRange.endDate,
      };

      const report = await fetchLeaveReportService(filters);
      setLeaveReport(report);
    } catch (error) {
      console.error('Error fetching leave report:', error);
    } finally {
      setReportLoading(false);
    }
  };

  const handleReportDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setReportDateRange((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    if (
      activeTab !== 'reports' ||
      !reportDateRange.startDate ||
      !reportDateRange.endDate
    ) {
      return;
    }

    fetchLeaveReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    reportDateRange.startDate,
    reportDateRange.endDate,
  ]);

  return {
    leaveReport,
    reportLoading,
    reportDateRange,
    handleReportDateChange,
    fetchLeaveReport,
  };
}

