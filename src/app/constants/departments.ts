export const DEPARTMENTS = [
  { value: 'construction', label: 'Construction' },
  { value: 'Maintenance', label: 'Maintenance' },
] as const;

export type DepartmentValue = (typeof DEPARTMENTS)[number]['value'];
