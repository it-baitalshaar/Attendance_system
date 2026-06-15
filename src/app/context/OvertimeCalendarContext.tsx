'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchDepartmentsService } from '@/app/admin/services/departmentService';
import {
  fetchHolidaysForDepartment,
  type DepartmentHoliday,
} from '@/app/admin/services/holidayService';
import {
  type OvertimeCalendarConfig,
  resolveDefaultOvertimeType,
  resolveHolidayNameForDate,
  resolveSuggestedAttendanceStatus,
  resolveWeekendDaysForDepartment,
  type SuggestedAttendanceStatus,
} from '@/app/lib/overtimeCalendar';
import type { OvertimeType } from '@/app/constants/overtime';

interface OvertimeCalendarContextValue {
  loading: boolean;
  selectedDate: string;
  department: string;
  config: OvertimeCalendarConfig;
  suggestedAttendanceStatus: SuggestedAttendanceStatus;
  /** Admin-configured holiday name for selected date, e.g. "Eid ul Adha". */
  holidayNameForDate: string | null;
  resolveDefault: (attendanceStatus?: string | null) => OvertimeType;
  refresh: () => Promise<void>;
}

const OvertimeCalendarContext = createContext<OvertimeCalendarContextValue | null>(null);

export function OvertimeCalendarProvider({
  department,
  selectedDate,
  children,
}: {
  department: string;
  selectedDate: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [weekendDays, setWeekendDays] = useState<number[]>([]);
  const [holidays, setHolidays] = useState<DepartmentHoliday[]>([]);
  const [allowHolidayOvertime, setAllowHolidayOvertime] = useState(true);
  const [allowPublicHolidayOvertime, setAllowPublicHolidayOvertime] = useState(true);

  const load = useCallback(async () => {
    if (!department?.trim()) {
      setWeekendDays([]);
      setHolidays([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [depts, holidayRows] = await Promise.all([
        fetchDepartmentsService(),
        fetchHolidaysForDepartment(department),
      ]);
      const deptRow = depts.find(
        (d) => d.name.trim().toLowerCase() === department.trim().toLowerCase()
      );
      setWeekendDays(resolveWeekendDaysForDepartment(department, deptRow?.weekend_days));
      setHolidays(holidayRows);
      setAllowHolidayOvertime(deptRow?.allow_holiday_overtime !== false);
      setAllowPublicHolidayOvertime(deptRow?.allow_public_holiday_overtime !== false);
    } catch {
      setWeekendDays(resolveWeekendDaysForDepartment(department, null));
      setHolidays([]);
    } finally {
      setLoading(false);
    }
  }, [department]);

  useEffect(() => {
    void load();
  }, [load, selectedDate]);

  const holidayDates = useMemo(
    () => holidays.map((h) => h.holiday_date),
    [holidays]
  );

  const config = useMemo<OvertimeCalendarConfig>(
    () => ({
      weekendDays,
      holidayDates,
      allowHolidayOvertime,
      allowPublicHolidayOvertime,
    }),
    [weekendDays, holidayDates, allowHolidayOvertime, allowPublicHolidayOvertime]
  );

  const suggestedAttendanceStatus = useMemo(
    () =>
      resolveSuggestedAttendanceStatus({
        dateStr: selectedDate,
        weekendDays,
        holidayDates,
      }),
    [selectedDate, weekendDays, holidayDates]
  );

  const holidayNameForDate = useMemo(
    () => resolveHolidayNameForDate(selectedDate, holidays),
    [selectedDate, holidays]
  );

  const resolveDefault = useCallback(
    (attendanceStatus?: string | null) =>
      resolveDefaultOvertimeType({
        dateStr: selectedDate,
        config,
        attendanceStatus,
      }),
    [selectedDate, config]
  );

  const value = useMemo(
    () => ({
      loading,
      selectedDate,
      department,
      config,
      suggestedAttendanceStatus,
      holidayNameForDate,
      resolveDefault,
      refresh: load,
    }),
    [loading, selectedDate, department, config, suggestedAttendanceStatus, holidayNameForDate, resolveDefault, load]
  );

  return (
    <OvertimeCalendarContext.Provider value={value}>{children}</OvertimeCalendarContext.Provider>
  );
}

export function useOvertimeCalendarContext(): OvertimeCalendarContextValue {
  const ctx = useContext(OvertimeCalendarContext);
  if (!ctx) {
    throw new Error('useOvertimeCalendarContext must be used within OvertimeCalendarProvider');
  }
  return ctx;
}

/** Safe hook for components that may render outside the provider (returns null). */
export function useOptionalOvertimeCalendarContext(): OvertimeCalendarContextValue | null {
  return useContext(OvertimeCalendarContext);
}
