export const DEPARTMENTS = [
  { value: 'Construction', label: 'Construction' },
  { value: 'Maintenance', label: 'Maintenance' },
  { value: 'Saqiya', label: 'Al Saqiya' },
] as const;

export type DepartmentValue = (typeof DEPARTMENTS)[number]['value'];
