'use client';

import { useEffect, useState } from 'react';
import { fetchDepartmentsService } from '@/app/admin/services/departmentService';

interface FutureAttendanceConfig {
  allowFutureAttendance: boolean;
  maxFutureDays: number;
}

const DEFAULT_CONFIG: FutureAttendanceConfig = {
  allowFutureAttendance: false,
  maxFutureDays: 0,
};

/**
 * Returns whether the given department is allowed to submit attendance for
 * future dates, and the maximum number of days ahead that is allowed.
 *
 * This is driven by the departments table (allow_future_attendance column).
 */
export function useDepartmentFutureAttendance(department: string | null | undefined): FutureAttendanceConfig {
  const [map, setMap] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDepartmentsService()
      .then((list) => {
        if (cancelled) return;
        const nextMap: Record<string, boolean> = {};
        list.forEach((d) => {
          if (d.name) {
            nextMap[d.name.trim().toLowerCase()] = Boolean(d.allow_future_attendance);
          }
        });
        setMap(nextMap);
      })
      .catch(() => {
        if (!cancelled) setMap(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const key = department?.trim().toLowerCase();
  if (!key || !map) return DEFAULT_CONFIG;

  const allowFutureAttendance = Boolean(map[key]);
  return {
    allowFutureAttendance,
    maxFutureDays: allowFutureAttendance ? 10 : 0,
  };
}

