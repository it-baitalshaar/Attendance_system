import { createSupabbaseFrontendClient } from '@/lib/supabase';
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
  if (payload.salary != null && payload.salary !== '' && !Number.isNaN(Number(payload.salary))) {
    row.salary = Number(payload.salary);
  }
  const { error } = await supabase.from('Employee').insert([row]);

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
  // Your Employee table only has employee_id as identifier (no "id" or "uuid" column).
  // Match the row by employee_id only so we never reference non-existent columns.
  const { error } = await supabase
    .from('Employee')
    .update(updates)
    .eq('employee_id', id);

  if (error) {
    throw error;
  }
}

