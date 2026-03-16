import type { OfficeReportDepartmentKey } from './types';

export const OFFICE_REPORT_DEPARTMENTS: { value: OfficeReportDepartmentKey; label: string }[] = [
  { value: 'Office Baitalshaar', label: 'Office Baitalshaar' },
  { value: 'Alsaqia Showroom', label: 'Alsaqia Showroom' },
];

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
