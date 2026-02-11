import { createSupabbaseFrontendClient } from '@/lib/supabase';
import { HomeEmployee } from '../types/home';

export async function fetchEmployeesByDepartment(
  department: string
): Promise<HomeEmployee[]> {
  const supabase = createSupabbaseFrontendClient();
  const { data, error } = await supabase
    .from('Employee')
    .select('employee_id, name, position, department')
    .eq('department', department)
    .eq('status', 'active');
  if (error) {
    console.error('Error fetching employees:', error);
    return [];
  }
  return (data ?? []) as HomeEmployee[];
}
