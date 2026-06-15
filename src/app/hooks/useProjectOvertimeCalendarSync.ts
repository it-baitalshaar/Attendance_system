'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import { overtime_hours } from '@/redux/slice';
import { useOptionalOvertimeCalendarContext } from '@/app/context/OvertimeCalendarContext';
import { DEFAULT_OVERTIME_TYPE, normalizeOvertimeType } from '@/app/constants/overtime';

/**
 * Keeps one project row's overtime_type in sync with the department calendar
 * (after load, date change, or calendar finish loading).
 */
export function useProjectOvertimeCalendarSync(employee_id: string, project_index: number) {
  const dispatch = useDispatch<AppDispatch>();
  const calendar = useOptionalOvertimeCalendarContext();
  const proj = useSelector((s: RootState) => {
    const emp = s.project.employees.find((e) => e.employee_id === employee_id);
    return emp?.projects?.projectId?.[project_index];
  });
  const statusEmployee = useSelector((s: RootState) => {
    const emp = s.project.employees.find((e) => e.employee_id === employee_id);
    return emp?.employee_status?.[0]?.status_employee ?? null;
  });

  useEffect(() => {
    if (!proj || !calendar || calendar.loading) return;

    const target = calendar.resolveDefault(statusEmployee);
    if (target === DEFAULT_OVERTIME_TYPE) return;

    const current = normalizeOvertimeType(proj.overtime_type);
    if (current === target) return;

    dispatch(
      overtime_hours({
        overtime_Hours: typeof proj.overtime === 'number' ? proj.overtime : 0,
        employee_id,
        project_index,
        overtime_type: target,
      })
    );
  }, [
    proj,
    proj?.overtime_type,
    calendar,
    calendar?.loading,
    calendar?.selectedDate,
    calendar?.holidayNameForDate,
    calendar?.suggestedAttendanceStatus,
    statusEmployee,
    dispatch,
    employee_id,
    project_index,
  ]);
}
