import type { DepartmentKey } from './types';

export const DEPARTMENTS: { value: DepartmentKey; label: string }[] = [
  { value: 'Construction', label: 'Construction' },
  { value: 'maintenance', label: 'Maintenance' },
];

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
