import { useEffect, useState } from 'react';
import {
  LeaveReportFilters,
  LeaveReportRow,
  fetchLeaveReportService,
} from '../services/reportService';
import { fetchDepartmentsService } from '../services/departmentService';
import { fetchEmployeesService } from '../services/employeeService';

type AdminTab =
  | 'employees'
  | 'officeEmployees'
  | 'departments'
  | 'projects'
  | 'users'
  | 'attendance'
  | 'profile'
  | 'reports'
  | 'reminders'
  | 'officeReport';

const ALL = '';

export function useLeaveReportDashboard(activeTab: AdminTab) {
  const [leaveReport, setLeaveReport] = useState<LeaveReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDateRange, setReportDateRange] = useState({
    startDate: '',
    endDate: '',
  });
  const [department, setDepartment] = useState(ALL);
  const [employeeId, setEmployeeId] = useState(ALL);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>(
    []
  );
  const [employees, setEmployees] = useState<
    { employee_id: string; name: string; department: string }[]
  >([]);
  const [filtersLoading, setFiltersLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFiltersLoading(true);
      try {
        const [depts, empResult] = await Promise.all([
          fetchDepartmentsService(),
          fetchEmployeesService(),
        ]);
        if (cancelled) return;
        setDepartments(depts.map((d) => ({ id: d.id, name: d.name })));
        setEmployees(
          (empResult.employees || [])
            .filter((e) => (e.status ?? 'active') === 'active')
            .map((e) => ({
              employee_id: e.employee_id,
              name: e.name,
              department: e.department ?? '',
            }))
        );
      } catch {
        if (!cancelled) {
          setDepartments([]);
          setEmployees([]);
        }
      } finally {
        if (!cancelled) setFiltersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!reportDateRange.startDate || !reportDateRange.endDate) {
      const today = new Date();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      setReportDateRange({
        startDate: thirtyDaysAgo.toISOString().split('T')[0],
        endDate: today.toISOString().split('T')[0],
      });
    }
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
        department: department || null,
        employeeId: employeeId || null,
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

  const handleDepartmentChange = (value: string) => {
    setDepartment(value);
    setEmployeeId(ALL);
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
  }, [activeTab, reportDateRange.startDate, reportDateRange.endDate]);

  const employeesInDepartment =
    department === ALL
      ? employees
      : employees.filter(
          (e) => e.department.toLowerCase() === department.toLowerCase()
        );

  return {
    leaveReport,
    reportLoading,
    reportDateRange,
    handleReportDateChange,
    fetchLeaveReport,
    department,
    employeeId,
    departments,
    employeesInDepartment,
    filtersLoading,
    handleDepartmentChange,
    setEmployeeId,
  };
}
