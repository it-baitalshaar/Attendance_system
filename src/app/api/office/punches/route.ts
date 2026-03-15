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

export async function GET(request: Request) {
  const authResult = await ensureAdmin();
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const { searchParams } = new URL(request.url);
  const startParam = searchParams.get('start')?.trim();
  const endParam = searchParams.get('end')?.trim();

  const now = new Date();
  const defaultEnd = new Date(now);
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - 7);

  // Use start-of-day and end-of-day so "today" includes all of today's punches.
  // Date-only "YYYY-MM-DD" → start 00:00:00.000Z, end 23:59:59.999Z.
  function toStartOfDayISO(param: string | null, fallback: Date): string {
    if (!param) return fallback.toISOString();
    const dateOnly = param.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return `${dateOnly}T00:00:00.000Z`;
    const d = new Date(param);
    return Number.isNaN(d.getTime()) ? fallback.toISOString() : d.toISOString();
  }
  function toEndOfDayISO(param: string | null, fallback: Date): string {
    if (!param) return fallback.toISOString();
    const dateOnly = param.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) return `${dateOnly}T23:59:59.999Z`;
    const d = new Date(param);
    return Number.isNaN(d.getTime()) ? fallback.toISOString() : d.toISOString();
  }

  const startIso = toStartOfDayISO(startParam ?? null, defaultStart);
  const endIso = toEndOfDayISO(endParam ?? null, defaultEnd);

  if (startIso > endIso) {
    return NextResponse.json({ error: 'Start must be before or equal to end' }, { status: 400 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookies().get(name)?.value;
        },
      },
    }
  );

  const { data: rows, error } = await supabase
    .from('office_attendance_logs')
    .select('id, employee_id, action, method, timestamp, office_employees(employee_code, name, department)')
    .gte('timestamp', startIso)
    .lte('timestamp', endIso)
    .order('timestamp', { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Emp = { employee_code: string; name: string; department: string };
  type Row = {
    employee_id: string;
    action: string;
    timestamp: string;
    office_employees?: Emp | Emp[] | null;
  };

  const punches = (rows ?? []).map((r: Row) => {
    const raw = r.office_employees;
    const emp: Emp = Array.isArray(raw) ? (raw[0] ?? { employee_code: '', name: 'Unknown', department: '' }) : (raw ?? { employee_code: '', name: 'Unknown', department: '' });
    return {
      employeeId: r.employee_id,
      employee_code: emp.employee_code,
      name: emp.name,
      department: emp.department,
      datetime: r.timestamp,
      type: r.action === 'checkout' ? 'checkout' : 'checkin',
    };
  });

  return NextResponse.json({ punches, from: startIso, to: endIso });
}
