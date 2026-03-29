'use client';

import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import { overtime_hours } from '@/redux/slice';
import {
  OVERTIME_TYPE_LABELS,
  type OvertimeType,
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
  const employee1 = useSelector((s: RootState) =>
    s.project.employees.find((e) => e.employee_id === employee_id)
  );
  const proj = employee1?.projects?.projectId?.[project_index];
  const typeVal = normalizeOvertimeType(proj?.overtime_type);
  const hoursNum = proj?.overtime;
  const hoursSelectValue =
    hoursNum === undefined || hoursNum === null ? '' : String(hoursNum);

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
        {OVERTIME_TYPES.map((k) => (
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
