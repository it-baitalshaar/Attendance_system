'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/redux/store';
import { setEmployeeData } from '@/redux/slice';
import { fetchEmployeesByDepartment } from '../services/homeService';
import { loadAttendanceForDateAndDepartment } from '../lib/loadAttendanceForDateAndDepartment';
import { HomeEmployee } from '../types/home';
import { DEPARTMENTS } from '../constants/departments';

export function useHomePageState() {
  const dispatch = useDispatch();
  const reduxDepartment = useSelector((state: RootState) => state.project.department);
  const attendanceEntries = useSelector((state: RootState) => state.project.attendanceEntries);
  const employees = useSelector((state: RootState) => state.project.employees);

  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [employeeList, setEmployeeList] = useState<HomeEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [existingSubmission, setExistingSubmission] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [cardsLocked, setCardsLocked] = useState(false);
  const [userHasUnlocked, setUserHasUnlocked] = useState(false);
  const [entryMode, setEntryMode] = useState<'standard' | 'customize'>('standard');
  const [showOnlyExceptions, setShowOnlyExceptions] = useState(false);

  const selectedDepartment = reduxDepartment ?? '';
  const departmentForFetch =
    selectedDepartment === 'Construction' || selectedDepartment === 'construction'
      ? 'Construction'
      : selectedDepartment;
  const isConstruction = departmentForFetch === 'Construction';
  const isMaintenance = departmentForFetch === 'Maintenance';
  const showEntryMode = isConstruction || isMaintenance;

  const loadAttendance = useCallback(
    async (date: string, department: string, empList?: HomeEmployee[]) => {
      const list = empList ?? employeeList;
      await loadAttendanceForDateAndDepartment(dispatch, {
        date,
        department,
        empList: list,
        userHasUnlocked,
        setExistingSubmission,
        setCardsLocked,
        setEditMode,
        setUserHasUnlocked,
        setEntryMode,
      });
    },
    [dispatch, employeeList, userHasUnlocked]
  );

  useEffect(() => {
    if (!selectedDepartment) {
      setEmployeeList([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchEmployeesByDepartment(departmentForFetch).then((list) => {
      setEmployeeList(list);
      const augmented = list.map((e) => ({
        ...e,
        employee_status: [{ status_attendance: null, status_employee: null, note: null }],
        projects: { projectId: [], tthour: 0 },
      }));
      dispatch(setEmployeeData(augmented));
      setLoading(false);
      loadAttendance(selectedDate, departmentForFetch, list);
    });
  }, [selectedDepartment, departmentForFetch, dispatch, selectedDate]);

  useEffect(() => {
    if (selectedDate && departmentForFetch && employeeList.length > 0) {
      loadAttendance(selectedDate, departmentForFetch, employeeList);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const getStatus = useCallback(
    (emp: HomeEmployee) =>
      showEntryMode && entryMode === 'customize'
        ? ((employees.find((r) => r.employee_id === emp.employee_id) as any)?.employee_status?.[0]?.status_attendance ?? 'present')
        : (attendanceEntries[emp.employee_id]?.status ?? 'present'),
    [showEntryMode, entryMode, employees, attendanceEntries]
  );

  const displayList = showOnlyExceptions
    ? employeeList.filter((e) => getStatus(e) !== 'present')
    : employeeList;

  const presentCount = employeeList.filter((e) => getStatus(e) === 'present').length;
  const absentCount = employeeList.filter((e) => getStatus(e) === 'absent').length;
  const vacationCount = employeeList.filter((e) => getStatus(e) === 'vacation').length;

  return {
    selectedDepartment,
    departmentForFetch,
    isConstruction,
    isMaintenance,
    showEntryMode,
    employeeList,
    loading,
    selectedDate,
    setSelectedDate,
    setUserHasUnlocked,
    existingSubmission,
    setExistingSubmission,
    cardsLocked,
    setCardsLocked,
    editMode,
    setEditMode,
    userHasUnlocked,
    entryMode,
    setEntryMode,
    showOnlyExceptions,
    setShowOnlyExceptions,
    attendanceEntries,
    employees,
    getStatus,
    displayList,
    presentCount,
    absentCount,
    vacationCount,
    DEPARTMENTS,
  };
}
