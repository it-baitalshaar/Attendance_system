export const DEPARTMENTS = [
  { value: 'Construction', label: 'Construction' },
  { value: 'Maintenance', label: 'Maintenance' },
] as const;

export type DepartmentValue = (typeof DEPARTMENTS)[number]['value'];
