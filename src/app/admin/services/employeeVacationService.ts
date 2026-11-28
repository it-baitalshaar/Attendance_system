/**
 * Employee vacation periods — admin CRUD (`employee_vacations`).
 *
 * The Attendance Report uses these ranges so days inside an approved vacation
 * are counted as Vacation (V) instead of being flagged as "no attendance record".
 * See `src/lib/fetchEmployeeVacations.ts` for the report-side read.
 *
 * If the migration has not been applied yet, reads return [] and writes throw a
 * readable error — nothing else in the Employees tab breaks.
 */

import { createSupabbaseFrontendClient } from '@/lib/supabase';
import type { EmployeeVacation } from '../types/admin';

const TABLE = 'employee_vacations';

function toDateOnly(value: string): string {
  return String(value ?? '').trim().slice(0, 10);
}

export async function fetchEmployeeVacationsService(
  employeeId: string
): Promise<EmployeeVacation[]> {
  const supabase = createSupabbaseFrontendClient();

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, employee_id, from_date, to_date, note, created_at')
    .eq('employee_id', employeeId)
    .order('from_date', { ascending: false });

  if (error) {
    // Missing table (migration not run) — treat as "no vacations yet".
    const msg = String(error.message ?? '').toLowerCase();
    if (String(error.code ?? '') === '42P01' || msg.includes('does not exist')) {
      return [];
    }
    throw error;
  }

  return ((data ?? []) as EmployeeVacation[]).map((v) => ({
    ...v,
    from_date: toDateOnly(v.from_date),
    to_date: toDateOnly(v.to_date),
  }));
}

export interface AddEmployeeVacationPayload {
  employee_id: string;
  /** YYYY-MM-DD */
  from_date: string;
  /** YYYY-MM-DD, inclusive */
  to_date: string;
  note?: string | null;
}

export async function addEmployeeVacationService(
  payload: AddEmployeeVacationPayload
): Promise<void> {
  const from = toDateOnly(payload.from_date);
  const to = toDateOnly(payload.to_date);
  if (!from || !to) {
    throw new Error('Vacation start and end dates are required.');
  }
  if (to < from) {
    throw new Error('Vacation end date must be on or after the start date.');
  }

  const supabase = createSupabbaseFrontendClient();
  const note = (payload.note ?? '').trim();

  const { error } = await supabase.from(TABLE).insert([
    {
      employee_id: payload.employee_id,
      from_date: from,
      to_date: to,
      note: note === '' ? null : note,
    },
  ]);

  if (error) {
    throw error;
  }
}

export async function deleteEmployeeVacationService(id: string): Promise<void> {
  const supabase = createSupabbaseFrontendClient();
  const { error } = await supabase.from(TABLE).delete().eq('id', id);
  if (error) {
    throw error;
  }
}
