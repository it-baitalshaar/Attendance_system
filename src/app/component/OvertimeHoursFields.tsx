'use client';

import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import { overtime_hours } from '@/redux/slice';
import { fetchDepartmentsService } from '@/app/admin/services/departmentService';
import { useOptionalOvertimeCalendarContext } from '@/app/context/OvertimeCalendarContext';
import {
  OVERTIME_TYPE_LABELS,
  type OvertimeType,
  DEFAULT_OVERTIME_TYPE,
  normalizeOvertimeType,
} from '@/app/constants/overtime';

const OVERTIME_TYPES = Object.keys(OVERTIME_TYPE_LABELS) as OvertimeType[];

export interface OvertimeHoursFieldsProps {
  employee_id: string;
  project_index: number;
  /** When false, nothing is rendered. */
  show: boolean;
  /** Options for the hours `<select>` (e.g. from renderOvertime()). */
  hoursSelectChildren: React.ReactNode;
  hoursPlaceholder: string;
}

export function OvertimeHoursFields({
  employee_id,
  project_index,
  show,
  hoursSelectChildren,
  hoursPlaceholder,
}: OvertimeHoursFieldsProps) {
  const dispatch = useDispatch<AppDispatch>();
  const calendar = useOptionalOvertimeCalendarContext();
  const department = useSelector((s: RootState) => s.project.department);
  const [allowedTypesByDepartment, setAllowedTypesByDepartment] = React.useState<
    Record<string, { holiday: boolean; publicHoliday: boolean }>
  >({});
  const employee1 = useSelector((s: RootState) =>
    s.project.employees.find((e) => e.employee_id === employee_id)
  );
  const proj = employee1?.projects?.projectId?.[project_index];
  const statusEmployee = employee1?.employee_status?.[0]?.status_employee ?? null;
  const deptKey = (department ?? '').trim().toLowerCase();
  const deptOptions = allowedTypesByDepartment[deptKey];
  const allowHoliday = deptOptions ? deptOptions.holiday : true;
  const allowPublicHoliday = deptOptions ? deptOptions.publicHoliday : true;

  const resolvedDefault = React.useMemo(() => {
    if (calendar && !calendar.loading) {
      return calendar.resolveDefault(statusEmployee);
    }
    return DEFAULT_OVERTIME_TYPE;
  }, [calendar, calendar?.loading, statusEmployee]);

  const allowedTypes = OVERTIME_TYPES.filter((type) => {
    if (type === resolvedDefault) return true;
    if (type === 'holiday') return allowHoliday;
    if (type === 'public_holiday') return allowPublicHoliday;
    return true;
  });
  const showTypeSelector =
    allowedTypes.length > 1 || !allowedTypes.includes(DEFAULT_OVERTIME_TYPE);

  const persistedType = normalizeOvertimeType(proj?.overtime_type);
  const typeVal = allowedTypes.includes(persistedType)
    ? persistedType
    : allowedTypes.includes(resolvedDefault)
      ? resolvedDefault
      : DEFAULT_OVERTIME_TYPE;
  const hoursNum = proj?.overtime;
  const hoursSelectValue =
    hoursNum === undefined || hoursNum === null ? '' : String(hoursNum);

  React.useEffect(() => {
    let cancelled = false;
    fetchDepartmentsService()
      .then((rows) => {
        if (cancelled) return;
        const next: Record<string, { holiday: boolean; publicHoliday: boolean }> = {};
        rows.forEach((d) => {
          if (!d.name) return;
          next[d.name.trim().toLowerCase()] = {
            holiday: d.allow_holiday_overtime !== false,
            publicHoliday: d.allow_public_holiday_overtime !== false,
          };
        });
        setAllowedTypesByDepartment(next);
      })
      .catch(() => {
        if (!cancelled) setAllowedTypesByDepartment({});
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Apply calendar default (weekend / public holiday OT) when date or status requires it. */
  React.useEffect(() => {
    if (!proj || !show || !calendar || calendar.loading) return;
    const target = resolvedDefault;
    if (target === 'normal') return;
    if (!allowedTypes.includes(target)) return;
    if (persistedType === target) return;

    const h = typeof proj.overtime === 'number' ? proj.overtime : 0;
    dispatch(
      overtime_hours({
        overtime_Hours: h,
        employee_id,
        project_index,
        overtime_type: target,
      })
    );
  }, [
    proj,
    show,
    calendar,
    calendar?.loading,
    resolvedDefault,
    allowedTypes,
    persistedType,
    dispatch,
    employee_id,
    project_index,
  ]);

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const t = normalizeOvertimeType(e.target.value);
    const h = typeof proj?.overtime === 'number' ? proj.overtime : 0;
    dispatch(
      overtime_hours({
        overtime_Hours: h,
        employee_id,
        project_index,
        overtime_type: t,
      })
    );
  };

  const handleHoursChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const hours = parseInt(e.target.value, 10);
    dispatch(
      overtime_hours({
        overtime_Hours: hours,
        employee_id,
        project_index,
        overtime_type: typeVal,
      })
    );
  };

  if (!show) return null;

  const calendarHint =
    calendar && !calendar.loading && resolvedDefault !== 'normal' && typeVal === resolvedDefault
      ? resolvedDefault === 'public_holiday'
        ? 'Default: public holiday overtime for this date'
        : 'Default: weekend overtime for this date'
      : null;

  return (
    <div className="w-full mt-5 space-y-2">
      {showTypeSelector && (
        <>
          <label className="block text-sm font-medium text-gray-800 w-full text-left">
            Overtime type
          </label>
          <select
            value={typeVal}
            onChange={handleTypeChange}
            className="text-black p-2 border rounded-lg focus:ring focus:ring-blue-200 w-full"
          >
            {allowedTypes.map((k) => (
              <option key={k} value={k}>
                {OVERTIME_TYPE_LABELS[k]}
              </option>
            ))}
          </select>
          {calendarHint && (
            <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2 py-1">
              {calendarHint}
            </p>
          )}
        </>
      )}
      <select
        value={hoursSelectValue}
        onChange={handleHoursChange}
        className="text-black p-2 border rounded-lg focus:ring focus:ring-blue-200 w-full"
      >
        <option value="" disabled>
          {hoursPlaceholder}
        </option>
        {hoursSelectChildren}
      </select>
    </div>
  );
}
