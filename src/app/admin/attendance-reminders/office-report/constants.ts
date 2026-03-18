import type { OfficeReportDepartmentKey } from './types';

export const OFFICE_REPORT_DEPARTMENTS: { value: OfficeReportDepartmentKey; label: string }[] = [
  { value: 'Bait Alshaar', label: 'Bait Alshaar' },
  { value: 'Al Saqia', label: 'Al Saqia' },
];

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
