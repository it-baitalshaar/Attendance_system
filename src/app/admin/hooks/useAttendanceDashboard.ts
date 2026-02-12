import { useEffect, useState } from 'react';
import {
  AttendanceRecordWithDetails,
  DepartmentAttendance,
  StatusSummary,
} from '../types/admin';
import {
  AttendanceFilters,
  fetchAttendanceService,
} from '../services/attendanceService';

type AdminTab = 'employees' | 'departments' | 'users' | 'attendance' | 'profile' | 'reports' | 'reminders';

export function useAttendanceDashboard(
  departments: string[],
  activeTab: AdminTab
) {
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecordWithDetails[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [statusSummary, setStatusSummary] = useState<StatusSummary[]>([]);
  const [departmentWarnings, setDepartmentWarnings] = useState<DepartmentAttendance[]>([]);
  const recordsPerPage = 50;

  const totalPages = Math.ceil(totalRecords / recordsPerPage);

  const initializeDatesOnce = () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      const today = new Date();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      setDateRange({
        startDate: thirtyDaysAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      });
    }
  };

  const checkDepartmentAttendance = (records: AttendanceRecordWithDetails[]) => {
    const deptAttendance = departments.map((dept) => {
      const deptLower = dept?.toLowerCase();
      return {
        department: dept,
        hasAttendance: records.some((record) => record.department?.toLowerCase() === deptLower),
      };
    });

    setDepartmentWarnings(deptAttendance);
  };

  const fetchAttendanceRecords = async () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return;
    }

    setAttendanceLoading(true);
    try {
      const filters: AttendanceFilters = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        selectedEmployeeId,
        selectedDepartment,
        selectedStatus,
        currentPage,
        recordsPerPage,
      };

      const { records, totalRecords, statusSummary } =
        await fetchAttendanceService(filters);

      const filteredRecords =
        selectedDepartment === 'all'
          ? records
          : records.filter(
              (record) =>
                record.department?.toLowerCase() === selectedDepartment?.toLowerCase()
            );

      setAttendanceRecords(filteredRecords);
      setTotalRecords(totalRecords);
      setStatusSummary(statusSummary);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    initializeDatesOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab !== 'attendance') {
      return;
    }

    fetchAttendanceRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeTab,
    dateRange.startDate,
    dateRange.endDate,
    selectedEmployeeId,
    selectedDepartment,
    selectedStatus,
    currentPage,
  ]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange((prev) => ({ ...prev, [name]: value }));
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  return {
    attendanceRecords,
    attendanceLoading,
    dateRange,
    selectedEmployeeId,
    selectedDepartment,
    selectedStatus,
    statusSummary,
    departmentWarnings,
    currentPage,
    totalPages,
    recordsPerPage,
    setSelectedEmployeeId,
    setSelectedDepartment,
    setSelectedStatus,
    handleDateChange,
    handlePageChange,
    fetchAttendanceRecords,
  };
}

