import { useEffect, useMemo, useState } from 'react';
import { createSupabbaseFrontendClient } from '@/lib/supabase';

export type OfficeEmployeeRow = {
  id: string;
  employee_code: string;
  name: string;
  email: string;
  phone: string | null;
  department: string;
  device_id: string | null;
  dynamic_link_token: string;
  created_at: string;
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
  return new Date().toISOString().slice(0, 10);
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
          .select('id, employee_code, name, email, phone, department, device_id, dynamic_link_token, created_at')
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
      setAttendanceToday((attRes.data ?? []) as OfficeAttendanceRow[]);
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
            if (mounted && data) setAttendanceToday((prev) => upsertAttendanceById(prev, data as OfficeAttendanceRow));
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

