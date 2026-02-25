import { createSupabbaseFrontendClient } from '@/lib/supabase';
import { EmployeeHistoryRecord } from '../types/admin';

/** Postgres code for "relation does not exist" - table not created yet */
const RELATION_DOES_NOT_EXIST = '42P01';

export async function fetchEmployeeHistoryService(
  employeeId: string
): Promise<EmployeeHistoryRecord[]> {
  const supabase = createSupabbaseFrontendClient();
  const { data, error } = await supabase
    .from('Employee_history')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });

  if (error) {
    if (error.code === RELATION_DOES_NOT_EXIST) {
      return [];
    }
    // REST 404 or "does not exist" when table is missing
    if (
      (error as { status?: number }).status === 404 ||
      /does not exist|not found/i.test(String(error.message))
    ) {
      return [];
    }
    throw error;
  }
  return (data || []) as EmployeeHistoryRecord[];
}

export async function addEmployeeHistoryService(
  employeeId: string,
  action: string,
  details: string | null = null
): Promise<void> {
  const supabase = createSupabbaseFrontendClient();
  const { error } = await supabase.from('Employee_history').insert([
    { employee_id: employeeId, action, details },
  ]);

  if (error) {
    // Don't throw when table doesn't exist (42P01) or REST returns 404
    if (
      error.code === RELATION_DOES_NOT_EXIST ||
      (error as { status?: number }).status === 404 ||
      /does not exist|not found/i.test(String(error.message))
    ) {
      return;
    }
    throw error;
  }
}
