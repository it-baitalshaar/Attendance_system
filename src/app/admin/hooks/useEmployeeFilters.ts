import { useState, useMemo } from 'react';
import { Employee } from '../types/admin';

export const FILTER_ALL = '';

/** Sortable columns for the employee list. */
export type EmployeeSortKey =
  | 'name'
  | 'employee_id'
  | 'department'
  | 'position'
  | 'status';

export type EmployeeSortDirection = 'asc' | 'desc';

/** Combined value used by the sort <select>, e.g. "name-asc". */
export type EmployeeSortValue = `${EmployeeSortKey}-${EmployeeSortDirection}`;

export const DEFAULT_SORT: EmployeeSortValue = 'name-asc';

export const SORT_OPTIONS: { value: EmployeeSortValue; label: string }[] = [
  { value: 'name-asc', label: 'Name (A–Z)' },
  { value: 'name-desc', label: 'Name (Z–A)' },
  { value: 'employee_id-asc', label: 'ID (ascending)' },
  { value: 'employee_id-desc', label: 'ID (descending)' },
  { value: 'department-asc', label: 'Department (A–Z)' },
  { value: 'department-desc', label: 'Department (Z–A)' },
  { value: 'position-asc', label: 'Position (A–Z)' },
  { value: 'position-desc', label: 'Position (Z–A)' },
  { value: 'status-asc', label: 'Status (A–Z)' },
  { value: 'status-desc', label: 'Status (Z–A)' },
];

export function parseSortValue(value: string): {
  key: EmployeeSortKey;
  direction: EmployeeSortDirection;
} {
  const [rawKey, rawDir] = value.split('-');
  const key = (['name', 'employee_id', 'department', 'position', 'status'] as const).includes(
    rawKey as EmployeeSortKey
  )
    ? (rawKey as EmployeeSortKey)
    : 'name';
  const direction: EmployeeSortDirection = rawDir === 'desc' ? 'desc' : 'asc';
  return { key, direction };
}

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
  /** Sort state (combined "field-direction" value) and setter */
  sortValue: EmployeeSortValue;
  setSortValue: (value: EmployeeSortValue) => void;
  /** Toggle a column between ascending and descending (for clickable headers) */
  toggleSort: (key: EmployeeSortKey) => void;
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
  const [sortValue, setSortValue] = useState<EmployeeSortValue>(DEFAULT_SORT);

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
      const deptLower = filterDepartment.toLowerCase();
      result = result.filter((emp) => emp.department?.toLowerCase() === deptLower);
    }
    if (filterStatus) {
      result = result.filter((emp) => emp.status === filterStatus);
    }
    if (filterPosition) {
      const posLower = filterPosition.toLowerCase();
      result = result.filter((emp) => emp.position?.toLowerCase() === posLower);
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

    const { key, direction } = parseSortValue(sortValue);
    const factor = direction === 'desc' ? -1 : 1;
    const collator = new Intl.Collator(undefined, {
      numeric: true,
      sensitivity: 'base',
    });

    result.sort((a, b) => {
      const left = (a[key] ?? '').toString().trim();
      const right = (b[key] ?? '').toString().trim();
      // Employees missing the sort field always sink to the bottom.
      if (!left && right) return 1;
      if (left && !right) return -1;
      const cmp = collator.compare(left, right);
      if (cmp !== 0) return cmp * factor;
      // Stable tie-break by name, then ID.
      const byName = collator.compare(a.name ?? '', b.name ?? '');
      if (byName !== 0) return byName;
      return collator.compare(a.employee_id ?? '', b.employee_id ?? '');
    });

    return result;
  }, [employees, searchQuery, filterDepartment, filterStatus, filterPosition, sortValue]);

  const hasActiveFilters =
    !!filterDepartment ||
    !!filterStatus ||
    !!filterPosition ||
    !!searchQuery.trim();

  const toggleSort = (key: EmployeeSortKey) => {
    setSortValue((prev) => {
      const current = parseSortValue(prev);
      const direction =
        current.key === key && current.direction === 'asc' ? 'desc' : 'asc';
      return `${key}-${direction}` as EmployeeSortValue;
    });
  };

  const resetFilters = () => {
    setSearchQuery('');
    setFilterDepartment(FILTER_ALL);
    setFilterStatus(FILTER_ALL);
    setFilterPosition(FILTER_ALL);
    setSortValue(DEFAULT_SORT);
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
    sortValue,
    setSortValue,
    toggleSort,
    resetFilters,
  };
}
