import { createSupabbaseFrontendClient } from '@/lib/supabase';

export interface Department {
  id: string;
  name: string;
  created_at?: string;
}

export async function fetchDepartmentsService(): Promise<Department[]> {
  const supabase = createSupabbaseFrontendClient();

  const { data, error } = await supabase
    .from('departments')
    .select('id, name, created_at')
    .order('name');

  if (error) throw error;
  return (data || []) as Department[];
}

export async function createDepartmentService(name: string): Promise<void> {
  const supabase = createSupabbaseFrontendClient();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Department name is required');

  const { error } = await supabase.from('departments').insert({ name: trimmed });

  if (error) throw error;
}

export async function updateDepartmentService(
  id: string,
  oldName: string,
  newName: string
): Promise<void> {
  const supabase = createSupabbaseFrontendClient();
  const trimmed = newName.trim();
  const trimmedOld = oldName.trim();
  if (!trimmed) throw new Error('Department name is required');
  if (trimmed.toLowerCase() === trimmedOld.toLowerCase()) return;

  const { error } = await supabase.rpc('update_department_name', {
    p_department_id: id,
    p_old_name: trimmedOld,
    p_new_name: trimmed,
  });

  if (error) throw error;
}

export async function getEmployeeCountByDepartment(
  departmentName: string
): Promise<number> {
  const supabase = createSupabbaseFrontendClient();

  const { data, error } = await supabase.rpc('get_employee_count_by_department', {
    p_department_name: departmentName,
  });

  if (error) throw error;
  return Number(data ?? 0);
}

export async function deleteDepartmentService(
  id: string,
  name: string,
  confirmName: string
): Promise<void> {
  if (confirmName.trim() !== name) {
    throw new Error('Confirmation does not match. Type the department name exactly to delete.');
  }

  const employeeCount = await getEmployeeCountByDepartment(name);
  if (employeeCount > 0) {
    throw new Error(
      `Cannot delete: ${employeeCount} employee(s) are assigned to this department. Reassign them first.`
    );
  }

  const supabase = createSupabbaseFrontendClient();
  const { error } = await supabase.from('departments').delete().eq('id', id);

  if (error) throw error;
}
