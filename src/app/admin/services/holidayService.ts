import { createSupabbaseFrontendClient } from '@/lib/supabase';

export interface DepartmentHoliday {
  id: string;
  department_id: string | null;
  holiday_date: string;
  name: string;
  is_active: boolean;
  created_at?: string;
  /** Joined from departments when listing all holidays. */
  department_name?: string | null;
}

function normalizeHolidayRow(row: Record<string, unknown>): DepartmentHoliday {
  return {
    id: String(row.id),
    department_id: row.department_id ? String(row.department_id) : null,
    holiday_date: String(row.holiday_date).slice(0, 10),
    name: String(row.name),
    is_active: row.is_active !== false,
    created_at: row.created_at ? String(row.created_at) : undefined,
    department_name: row.departments
      ? String((row.departments as { name?: string }).name ?? '')
      : null,
  };
}

export async function fetchDepartmentHolidaysService(options?: {
  departmentId?: string | null;
  fromDate?: string;
  toDate?: string;
}): Promise<DepartmentHoliday[]> {
  const supabase = createSupabbaseFrontendClient();

  let query = supabase
    .from('department_holidays')
    .select('id, department_id, holiday_date, name, is_active, created_at, departments(name)')
    .eq('is_active', true)
    .order('holiday_date', { ascending: true });

  if (options?.fromDate) {
    query = query.gte('holiday_date', options.fromDate);
  }
  if (options?.toDate) {
    query = query.lte('holiday_date', options.toDate);
  }

  const { data, error } = await query;
  if (error) {
    if (error.message?.includes('department_holidays')) {
      return [];
    }
    throw error;
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const deptId = options?.departmentId ?? null;

  return rows
    .map(normalizeHolidayRow)
    .filter((h) => {
      if (!deptId) return true;
      return h.department_id === null || h.department_id === deptId;
    });
}

export async function fetchHolidaysForDepartment(
  departmentName: string
): Promise<DepartmentHoliday[]> {
  const supabase = createSupabbaseFrontendClient();
  const trimmed = departmentName.trim();
  if (!trimmed) return [];

  const { data: deptRows } = await supabase
    .from('departments')
    .select('id')
    .ilike('name', trimmed)
    .limit(1);

  const deptId = deptRows?.[0]?.id as string | undefined;

  const { data, error } = await supabase
    .from('department_holidays')
    .select('id, department_id, holiday_date, name, is_active')
    .eq('is_active', true)
    .order('holiday_date', { ascending: true });

  if (error) {
    if (error.message?.includes('department_holidays')) return [];
    throw error;
  }

  return (data ?? [])
    .map((row) => normalizeHolidayRow(row as Record<string, unknown>))
    .filter(
      (h) => h.department_id === null || (deptId != null && h.department_id === deptId)
    );
}

export async function fetchHolidayDatesForDepartment(
  departmentName: string
): Promise<string[]> {
  const holidays = await fetchHolidaysForDepartment(departmentName);
  const dates = new Set<string>();
  for (const h of holidays) {
    dates.add(h.holiday_date);
  }
  return Array.from(dates).sort();
}

export async function createDepartmentHolidayService(input: {
  departmentId: string | null;
  holidayDate: string;
  name: string;
}): Promise<void> {
  const supabase = createSupabbaseFrontendClient();
  const { error } = await supabase.from('department_holidays').insert({
    department_id: input.departmentId,
    holiday_date: input.holidayDate,
    name: input.name.trim(),
    is_active: true,
  });
  if (error) throw error;
}

export async function deleteDepartmentHolidayService(id: string): Promise<void> {
  const supabase = createSupabbaseFrontendClient();
  const { error } = await supabase.from('department_holidays').delete().eq('id', id);
  if (error) throw error;
}

export async function deactivateDepartmentHolidayService(id: string): Promise<void> {
  const supabase = createSupabbaseFrontendClient();
  const { error } = await supabase
    .from('department_holidays')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}
