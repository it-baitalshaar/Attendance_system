import { createSupabbaseFrontendClient } from '@/lib/supabase';
import { isUndefinedColumnError } from '@/lib/supabasePostgrestErrors';
import { Employee, EmployeeUpdatePayload } from '../types/admin';

export interface FetchEmployeesResult {
  employees: Employee[];
  departments: string[];
}

export async function fetchEmployeesService(): Promise<FetchEmployeesResult> {
  const supabase = createSupabbaseFrontendClient();

  const { data, error } = await supabase
    .from('Employee')
    .select('*')
    .order('name');

  if (error) {
    throw error;
  }

  const raw = (data || []) as Record<string, unknown>[];
  const employees: Employee[] = raw.map((row) => {
    // Prefer the row's primary key (uuid). Some tables use "id", "Id", or "uuid".
    const id = (row.id ?? row.Id ?? row.uuid ?? row.employee_id) as string;
    return { ...row, id } as Employee;
  });

  const departments = Array.from(
    new Set(employees.map((emp) => emp.department))
  )
    .filter(Boolean)
    .sort();

  return { employees, departments };
}

export interface AddEmployeePayload {
  name: string;
  position: string;
  department: string;
  employee_id: string;
  salary?: number | null;
  /** YYYY-MM-DD; null when unknown. */
  joining_date?: string | null;
}

export async function addEmployeeService(
  payload: AddEmployeePayload
): Promise<void> {
  const supabase = createSupabbaseFrontendClient();

  const row: Record<string, unknown> = {
    name: payload.name,
    position: payload.position,
    department: payload.department,
    employee_id: payload.employee_id,
    status: 'active',
  };
  if (payload.salary !== null && payload.salary !== undefined && !Number.isNaN(payload.salary)) {
    row.salary = payload.salary;
  }
  if (payload.joining_date) {
    row.joining_date = payload.joining_date;
  }
  let { error } = await supabase.from('Employee').insert([row]);

  // Before the joining_date migration is applied, insert without it.
  if (error && 'joining_date' in row && isUndefinedColumnError(error)) {
    const { joining_date: _omitted, ...withoutJoiningDate } = row;
    ({ error } = await supabase.from('Employee').insert([withoutJoiningDate]));
  }

  if (error) {
    throw error;
  }
}

export async function updateEmployeeService(
  id: string,
  payload: EmployeeUpdatePayload
): Promise<void> {
  const supabase = createSupabbaseFrontendClient();
  const updates: Record<string, unknown> = { ...payload };
  if (updates.salary === '' || updates.salary === undefined) {
    updates.salary = null;
  } else if (typeof updates.salary === 'number') {
    // keep as is
  } else {
    updates.salary = Number(updates.salary);
  }
  // Joining date is a date column: an empty string is invalid, so clear it with null.
  if (updates.joining_date === '' || updates.joining_date === undefined) {
    if ('joining_date' in updates) updates.joining_date = null;
  }
  // The joining_date migration may not be applied yet — retry without it so
  // employee edits keep working before the SQL is run.
  let { error } = await supabase
    .from('Employee')
    .update(updates)
    .eq('employee_id', id);

  if (error && 'joining_date' in updates && isUndefinedColumnError(error)) {
    const { joining_date: _omitted, ...withoutJoiningDate } = updates;
    ({ error } = await supabase
      .from('Employee')
      .update(withoutJoiningDate)
      .eq('employee_id', id));
  }

  if (error) {
    throw error;
  }
}

