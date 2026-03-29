/** Payroll overtime category per project row (not the same as weekend/holiday attendance status). */
export type OvertimeType = 'normal' | 'holiday' | 'public_holiday';

export const DEFAULT_OVERTIME_TYPE: OvertimeType = 'normal';

/** Multipliers applied to base pay for overtime hours (per your payroll rules). */
export const OVERTIME_RATE_BY_TYPE: Record<OvertimeType, number> = {
  normal: 1.25,
  holiday: 1.5,
  public_holiday: 2.5,
};

export const OVERTIME_TYPE_LABELS: Record<OvertimeType, string> = {
  normal: 'Normal overtime (×1.25)',
  holiday: 'Holiday overtime (×1.5)',
  public_holiday: 'Public holiday overtime (×2.5)',
};

export function normalizeOvertimeType(value: unknown): OvertimeType {
  if (value === 'holiday' || value === 'public_holiday' || value === 'normal') return value;
  return DEFAULT_OVERTIME_TYPE;
}

export function getOvertimeRate(type: unknown): number {
  return OVERTIME_RATE_BY_TYPE[normalizeOvertimeType(type)];
}
