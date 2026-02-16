'use client';

import { useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import { RootState } from '@/redux/store';
import { getThemeForDepartment } from '@/app/constants/themes';
import { fetchDepartmentsService } from '@/app/admin/services/departmentService';

/**
 * Returns the theme for the current user's department.
 * Prefers profileDepartment (from profile) when provided; otherwise uses Redux department.
 */
export function useDepartmentTheme(profileDepartment?: string | null) {
  const reduxDepartment = useSelector((state: RootState) => state.project.department);
  const department = profileDepartment !== undefined && profileDepartment !== null
    ? profileDepartment
    : (reduxDepartment ?? '');
  const [departmentThemeMap, setDepartmentThemeMap] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDepartmentsService()
      .then((list) => {
        if (cancelled) return;
        const map: Record<string, string> = {};
        list.forEach((d) => {
          if (d.name && d.theme_id) {
            map[d.name.trim()] = d.theme_id;
          }
        });
        setDepartmentThemeMap(map);
      })
      .catch(() => {
        if (!cancelled) setDepartmentThemeMap(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return getThemeForDepartment(department || undefined, departmentThemeMap ?? undefined);
}
