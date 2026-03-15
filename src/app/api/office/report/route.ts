import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

async function ensureAdmin() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: 401 as const };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || (profile as { role?: string }).role !== 'admin') return { error: 'Forbidden', status: 403 as const };
  return { user };
}

function firstDayOfMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function lastDayOfMonth(d: Date): string {
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  const day = String(next.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function GET(request: Request) {
  const authResult = await ensureAdmin();
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  let start = searchParams.get('start')?.trim().slice(0, 10) || firstDayOfMonth(now);
  let end = searchParams.get('end')?.trim().slice(0, 10) || lastDayOfMonth(now);
  if (start > end) [start, end] = [end, start];

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: rows, error } = await supabase
    .from('office_attendance')
    .select('id, employee_id, date, check_in, check_out, worked_hours, office_employees(id, name, department)')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Row = {
    employee_id: string;
    date: string;
    worked_hours: number | null;
    office_employees: { id: string; name: string; department: string } | null;
  };

  const byEmployee = new Map<
    string,
    { employee: { id: string; name: string; department: string }; daily: Record<string, number>; total: number }
  >();

  for (const r of (rows ?? []) as Row[]) {
    const emp = r.office_employees ?? { id: r.employee_id, name: 'Unknown', department: '' };
    const key = r.employee_id;
    if (!byEmployee.has(key)) {
      byEmployee.set(key, { employee: emp, daily: {}, total: 0 });
    }
    const rec = byEmployee.get(key)!;
    const hours = Number(r.worked_hours) || 0;
    rec.daily[r.date] = hours;
    rec.total += hours;
  }

  const results = Array.from(byEmployee.values()).map(({ employee, daily, total }) => ({
    employee: { id: employee.id, name: employee.name, department: employee.department },
    daily,
    monthlyTotal: Math.round(total * 100) / 100,
  }));

  const grandTotal = results.reduce((sum, r) => sum + r.monthlyTotal, 0);

  return NextResponse.json({
    start: `${start}T00:00:00.000Z`,
    end: `${end}T23:59:59.999Z`,
    results,
    grandTotal: Math.round(grandTotal * 100) / 100,
  });
}
