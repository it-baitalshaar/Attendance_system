import { useEffect, useMemo, useState } from 'react';
import { createSupabbaseFrontendClient } from '@/lib/supabase';

export type OfficeEmployeeRow = {
  id: string;
  employee_code: string;
  name: string;
  email: string;
  personal_email: string | null;
  phone: string | null;
  department: string;
  device_id: string | null;
  dynamic_link_token: string;
  created_at: string;
  salary: number | null;
  min_working_hours: number | null;
  max_working_hours: number | null;
  auto_daily_report_enabled: boolean;
  auto_daily_report_time: string;
  auto_month_end_report_enabled: boolean;
  auto_month_end_report_time: string;
  last_daily_report_sent_on: string | null;
  last_month_end_report_sent_month: string | null;
};

export type OfficeAttendanceRow = {
  id: string;
  employee_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  worked_hours: number | null;
  method: string;
  location: string | null;
  device: string | null;
  notes: string | null;
  office_employees?: { employee_code: string; name: string; department: string } | null;
};

function upsertById(list: OfficeEmployeeRow[], row: OfficeEmployeeRow): OfficeEmployeeRow[] {
  const idx = list.findIndex((x) => x.id === row.id);
  if (idx === -1) return [row, ...list];
  const next = list.slice();
  next[idx] = { ...next[idx], ...row };
  return next;
}

function upsertAttendanceById(list: OfficeAttendanceRow[], row: OfficeAttendanceRow): OfficeAttendanceRow[] {
  const idx = list.findIndex((x) => x.id === row.id);
  if (idx === -1) return [row, ...list];
  const next = list.slice();
  next[idx] = { ...next[idx], ...row };
  return next;
}

function getTodayIso() {
  const officeTz = process.env.NEXT_PUBLIC_BIOTIME_OFFICE_TZ || 'Asia/Dubai';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: officeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});
  return `${parts.year ?? '1970'}-${parts.month ?? '01'}-${parts.day ?? '01'}`;
}

export function useOfficeEmployeesRealtime() {
  const supabase = useMemo(() => createSupabbaseFrontendClient(), []);
  const [employees, setEmployees] = useState<OfficeEmployeeRow[]>([]);
  const [attendanceToday, setAttendanceToday] = useState<OfficeAttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    const today = getTodayIso();

    async function load() {
      setLoading(true);
      setError('');
      const [empRes, attRes] = await Promise.all([
        supabase
          .from('office_employees')
          .select('id, employee_code, name, email, personal_email, phone, department, device_id, dynamic_link_token, created_at, salary, min_working_hours, max_working_hours, auto_daily_report_enabled, auto_daily_report_time, auto_month_end_report_enabled, auto_month_end_report_time, last_daily_report_sent_on, last_month_end_report_sent_month')
          .order('created_at', { ascending: false }),
        supabase
          .from('office_attendance')
          .select(
            'id, employee_id, date, check_in, check_out, worked_hours, method, location, device, notes, office_employees(employee_code, name, department)'
          )
          .eq('date', today)
          .order('check_in', { ascending: false }),
      ]);

      if (!mounted) return;
      if (empRes.error) {
        setError(empRes.error.message ?? 'Failed to load office employees');
        setEmployees([]);
        setAttendanceToday([]);
        setLoading(false);
        return;
      }
      setEmployees((empRes.data ?? []) as OfficeEmployeeRow[]);
      const rawAttendance = (attRes.data ?? []) as Array<Omit<OfficeAttendanceRow, 'office_employees'> & { office_employees?: OfficeAttendanceRow['office_employees'] | Array<{ employee_code: string; name: string; department: string }> }>;
      const normalized: OfficeAttendanceRow[] = rawAttendance.map((row) => ({
        ...row,
        office_employees: Array.isArray(row.office_employees) ? row.office_employees[0] ?? null : row.office_employees ?? null,
      }));
      setAttendanceToday(normalized);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel('admin-office-employees')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'office_employees' },
        (payload) => {
          if (!mounted) return;
          const event = payload.eventType;
          if (event === 'INSERT' || event === 'UPDATE') {
            const row = payload.new as OfficeEmployeeRow;
            if (!row?.id) return;
            setEmployees((prev) => upsertById(prev, row));
          } else if (event === 'DELETE') {
            const row = payload.old as { id?: string };
            const id = row?.id;
            if (!id) return;
            setEmployees((prev) => prev.filter((x) => x.id !== id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'office_attendance' },
        async (payload) => {
          if (!mounted) return;
          const event = payload.eventType;
          const row = (event === 'DELETE' ? payload.old : payload.new) as OfficeAttendanceRow & { date?: string };
          const date = row?.date;
          if (date !== today) return;
          if (event === 'INSERT' || event === 'UPDATE') {
            const full = payload.new as OfficeAttendanceRow;
            if (!full?.id) return;
            const { data } = await supabase
              .from('office_attendance')
              .select(
                'id, employee_id, date, check_in, check_out, worked_hours, method, location, device, notes, office_employees(employee_code, name, department)'
              )
              .eq('id', full.id)
              .single();
            if (mounted && data) {
              const d = data as typeof data & { office_employees?: OfficeAttendanceRow['office_employees'] | Array<{ employee_code: string; name: string; department: string }> };
              const normalized: OfficeAttendanceRow = {
                ...d,
                office_employees: Array.isArray(d?.office_employees) ? d.office_employees[0] ?? null : d?.office_employees ?? null,
              };
              setAttendanceToday((prev) => upsertAttendanceById(prev, normalized));
            }
          } else if (event === 'DELETE') {
            const id = (payload.old as { id?: string })?.id;
            if (!id) return;
            setAttendanceToday((prev) => prev.filter((x) => x.id !== id));
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return { employees, attendanceToday, loading, error };
}

