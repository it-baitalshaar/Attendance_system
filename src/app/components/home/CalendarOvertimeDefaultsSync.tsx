'use client';

import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import { overtime_hours } from '@/redux/slice';
import { useOvertimeCalendarContext } from '@/app/context/OvertimeCalendarContext';
import { DEFAULT_OVERTIME_TYPE, normalizeOvertimeType } from '@/app/constants/overtime';

/**
 * When the calendar finishes loading (or date changes), apply weekend / public-holiday
 * overtime defaults to all project rows that are still on normal OT.
 */
export function CalendarOvertimeDefaultsSync() {
  const calendar = useOvertimeCalendarContext();
  const dispatch = useDispatch<AppDispatch>();
  const employees = useSelector((s: RootState) => s.project.employees);

  useEffect(() => {
    if (calendar.loading) return;

    employees.forEach((emp) => {
      if (!emp.employee_id || !emp.projects?.projectId?.length) return;
      const status = emp.employee_status?.[0]?.status_employee ?? null;
      const target = calendar.resolveDefault(status);
      if (target === DEFAULT_OVERTIME_TYPE) return;

      emp.projects.projectId.forEach((proj, project_index) => {
        const current = normalizeOvertimeType(proj.overtime_type);
        if (current === target) return;
        if (current !== 'normal' && status !== 'Weekend' && status !== 'Holiday-Work') return;

        dispatch(
          overtime_hours({
            overtime_Hours: typeof proj.overtime === 'number' ? proj.overtime : 0,
            employee_id: emp.employee_id!,
            project_index,
            overtime_type: target,
          })
        );
      });
    });
  }, [
    calendar.loading,
    calendar.selectedDate,
    calendar.suggestedAttendanceStatus,
    calendar.holidayNameForDate,
    employees,
    dispatch,
    calendar,
  ]);

  return null;
}
