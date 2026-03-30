'use client';

import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import { overtime_hours } from '@/redux/slice';
import { fetchDepartmentsService } from '@/app/admin/services/departmentService';
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
  const department = useSelector((s: RootState) => s.project.department);
  const [allowedTypesByDepartment, setAllowedTypesByDepartment] = React.useState<
    Record<string, { holiday: boolean; publicHoliday: boolean }>
  >({});
  const employee1 = useSelector((s: RootState) =>
    s.project.employees.find((e) => e.employee_id === employee_id)
  );
  const proj = employee1?.projects?.projectId?.[project_index];
  const deptKey = (department ?? '').trim().toLowerCase();
  const deptOptions = allowedTypesByDepartment[deptKey];
  const allowHoliday = deptOptions ? deptOptions.holiday : true;
  const allowPublicHoliday = deptOptions ? deptOptions.publicHoliday : true;
  const allowedTypes = OVERTIME_TYPES.filter((type) => {
    if (type === 'holiday') return allowHoliday;
    if (type === 'public_holiday') return allowPublicHoliday;
    return true;
  });

  const persistedType = normalizeOvertimeType(proj?.overtime_type);
  const typeVal = allowedTypes.includes(persistedType)
    ? persistedType
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

  React.useEffect(() => {
    if (!proj) return;
    if (typeVal === persistedType) return;
    const h = typeof proj.overtime === 'number' ? proj.overtime : 0;
    dispatch(
      overtime_hours({
        overtime_Hours: h,
        employee_id,
        project_index,
        overtime_type: DEFAULT_OVERTIME_TYPE,
      })
    );
  }, [dispatch, employee_id, project_index, proj, persistedType, typeVal]);

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

  return (
    <div className="w-full mt-5 space-y-2">
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
