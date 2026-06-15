'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchDepartmentsService } from '@/app/admin/services/departmentService';
import { fetchHolidayDatesForDepartment } from '@/app/admin/services/holidayService';
import {
  type OvertimeCalendarConfig,
  resolveDefaultOvertimeType,
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
  const [holidayDates, setHolidayDates] = useState<string[]>([]);
  const [allowHolidayOvertime, setAllowHolidayOvertime] = useState(true);
  const [allowPublicHolidayOvertime, setAllowPublicHolidayOvertime] = useState(true);

  const load = useCallback(async () => {
    if (!department?.trim()) {
      setWeekendDays([]);
      setHolidayDates([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [depts, holidays] = await Promise.all([
        fetchDepartmentsService(),
        fetchHolidayDatesForDepartment(department),
      ]);
      const deptRow = depts.find(
        (d) => d.name.trim().toLowerCase() === department.trim().toLowerCase()
      );
      setWeekendDays(resolveWeekendDaysForDepartment(department, deptRow?.weekend_days));
      setHolidayDates(holidays);
      setAllowHolidayOvertime(deptRow?.allow_holiday_overtime !== false);
      setAllowPublicHolidayOvertime(deptRow?.allow_public_holiday_overtime !== false);
    } catch {
      setWeekendDays(resolveWeekendDaysForDepartment(department, null));
      setHolidayDates([]);
    } finally {
      setLoading(false);
    }
  }, [department]);

  useEffect(() => {
    void load();
  }, [load, selectedDate]);

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
      resolveDefault,
      refresh: load,
    }),
    [loading, selectedDate, department, config, suggestedAttendanceStatus, resolveDefault, load]
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
