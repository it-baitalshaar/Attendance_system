import { useState, useMemo } from 'react';
import { Employee } from '../types/admin';

export const FILTER_ALL = '';

export interface EmployeeFiltersState {
  searchQuery: string;
  filterDepartment: string;
  filterStatus: string;
  filterPosition: string;
}

export interface UseEmployeeFiltersReturn {
  /** Filtered list of employees based on search and dropdown filters */
  filteredEmployees: Employee[];
  /** Whether any filter (search or dropdown) is currently active */
  hasActiveFilters: boolean;
  /** Unique values extracted from employees for dropdown options */
  filterOptions: {
    departments: string[];
    statuses: string[];
    positions: string[];
  };
  /** Filter state and setters */
  filters: EmployeeFiltersState;
  setSearchQuery: (value: string) => void;
  setFilterDepartment: (value: string) => void;
  setFilterStatus: (value: string) => void;
  setFilterPosition: (value: string) => void;
  /** Reset all filters to default */
  resetFilters: () => void;
}

/**
 * Hook for filtering employees by search (name, ID, department) and
 * dropdown filters (department, status, position).
 * Reusable across admin panels that display employee lists.
 */
export function useEmployeeFilters(employees: Employee[]): UseEmployeeFiltersReturn {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState(FILTER_ALL);
  const [filterStatus, setFilterStatus] = useState(FILTER_ALL);
  const [filterPosition, setFilterPosition] = useState(FILTER_ALL);

  const filterOptions = useMemo(
    () => ({
      departments: Array.from(
        new Set(employees.map((e) => e.department).filter(Boolean))
      ).sort() as string[],
      statuses: Array.from(
        new Set(employees.map((e) => e.status).filter(Boolean))
      ).sort() as string[],
      positions: Array.from(
        new Set(employees.map((e) => e.position).filter(Boolean))
      ).sort() as string[],
    }),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    let result = [...employees];

    if (filterDepartment) {
      result = result.filter((emp) => emp.department === filterDepartment);
    }
    if (filterStatus) {
      result = result.filter((emp) => emp.status === filterStatus);
    }
    if (filterPosition) {
      result = result.filter((emp) => emp.position === filterPosition);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (emp) =>
          emp.name.toLowerCase().includes(query) ||
          emp.employee_id.toLowerCase().includes(query) ||
          emp.department.toLowerCase().includes(query)
      );
    }

    return result;
  }, [employees, searchQuery, filterDepartment, filterStatus, filterPosition]);

  const hasActiveFilters =
    !!filterDepartment ||
    !!filterStatus ||
    !!filterPosition ||
    !!searchQuery.trim();

  const resetFilters = () => {
    setSearchQuery('');
    setFilterDepartment(FILTER_ALL);
    setFilterStatus(FILTER_ALL);
    setFilterPosition(FILTER_ALL);
  };

  return {
    filteredEmployees,
    hasActiveFilters,
    filterOptions,
    filters: {
      searchQuery,
      filterDepartment,
      filterStatus,
      filterPosition,
    },
    setSearchQuery,
    setFilterDepartment,
    setFilterStatus,
    setFilterPosition,
    resetFilters,
  };
}
