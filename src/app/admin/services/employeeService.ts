import { createSupabbaseFrontendClient } from '@/lib/supabase';
import { Employee } from '../types/admin';

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

  const employees = (data || []) as Employee[];

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
}

export async function addEmployeeService(
  payload: AddEmployeePayload
): Promise<void> {
  const supabase = createSupabbaseFrontendClient();

  const { error } = await supabase.from('Employee').insert([
    {
      name: payload.name,
      position: payload.position,
      department: payload.department,
      employee_id: payload.employee_id,
      status: 'active',
    },
  ]);

  if (error) {
    throw error;
  }
}

