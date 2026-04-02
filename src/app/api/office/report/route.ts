import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const UAE_TIMEZONE = 'Asia/Dubai';
const MIN_CHECKOUT_GAP_MS = 3 * 60 * 1000;

function uaeDateKeyFromIso(iso: string): string | null {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: UAE_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);

    const get = (t: string) => parts.find((p) => p.type === t)?.value;
    const y = get('year');
    const m = get('month');
    const day = get('day');
    if (!y || !m || !day) return null;
    return `${y}-${m}-${day}`;
  } catch {
    return null;
  }
}

function inferCheckoutFromLogs(
  checkInIso: string | null,
  existingCheckoutIso: string | null,
  logs: string[]
): string | null {
  // If DB already has a checkout, trust it.
  if (existingCheckoutIso) return existingCheckoutIso;
  if (!checkInIso) return null;

  const checkInMs = new Date(checkInIso).getTime();
  if (!Number.isFinite(checkInMs)) return null;

  // Choose the latest punch that is after the check-in by at least a small gap.
  // This handles devices stuck on "check-in" where the second punch should be treated as checkout.
  let best: string | null = null;
  let bestMs = -1;
  for (const ts of logs) {
    const ms = new Date(ts).getTime();
    if (!Number.isFinite(ms)) continue;
    if (ms >= checkInMs + MIN_CHECKOUT_GAP_MS && ms > bestMs) {
      bestMs = ms;
      best = ts;
    }
  }

  return best;
}

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
    .select('id, employee_id, date, check_in, check_out, worked_hours, office_employees(id, employee_code, name, department)')
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  type Emp = { id: string; employee_code: string; name: string; department: string };
  type Row = {
    employee_id: string;
    date: string;
    check_in: string | null;
    check_out: string | null;
    worked_hours: number | null;
    office_employees?: Emp | Emp[] | null;
  };

  type DayEntry = { checkIn: string | null; checkOut: string | null; hours: number };
  const byEmployee = new Map<
    string,
    { employee: Emp; daily: Record<string, DayEntry>; total: number }
  >();

  const rawRows = (rows ?? []) as Row[];

  // Fetch all punches for employees in the selected range so we can infer checkout when devices report
  // only "check-in" action(s) but actually have morning+evening punches.
  const employeeIds = Array.from(new Set(rawRows.map((r) => r.employee_id))).filter(Boolean);
  const startWindow = new Date(`${start}T00:00:00.000Z`);
  const endWindow = new Date(`${end}T23:59:59.999Z`);
  // Pad by 1 day to avoid timezone edge cases when converting punches to UAE calendar dates.
  startWindow.setUTCDate(startWindow.getUTCDate() - 1);
  endWindow.setUTCDate(endWindow.getUTCDate() + 1);

  const logsByEmployeeDate = new Map<string, string[]>();
  if (employeeIds.length > 0) {
    const { data: logRows, error: logsError } = await supabase
      .from('office_attendance_logs')
      .select('employee_id, timestamp')
      .in('employee_id', employeeIds)
      .gte('timestamp', startWindow.toISOString())
      .lte('timestamp', endWindow.toISOString())
      .order('timestamp', { ascending: true });

    if (!logsError) {
      for (const l of (logRows ?? []) as { employee_id: string; timestamp: string }[]) {
        const dk = uaeDateKeyFromIso(l.timestamp);
        if (!dk) continue;
        const k = `${l.employee_id}|${dk}`;
        const arr = logsByEmployeeDate.get(k) ?? [];
        arr.push(l.timestamp);
        logsByEmployeeDate.set(k, arr);
      }
    }
  }

  for (const r of rawRows) {
    const raw = r.office_employees;
    const emp: Emp = Array.isArray(raw)
      ? (raw[0] ?? { id: r.employee_id, employee_code: '', name: 'Unknown', department: '' })
      : (raw ?? { id: r.employee_id, employee_code: '', name: 'Unknown', department: '' });
    const key = r.employee_id;
    if (!byEmployee.has(key)) {
      byEmployee.set(key, { employee: emp, daily: {}, total: 0 });
    }
    const rec = byEmployee.get(key)!;

    const empDateKey = `${r.employee_id}|${r.date}`;
    const inferredCheckout = inferCheckoutFromLogs(
      r.check_in ?? null,
      r.check_out ?? null,
      logsByEmployeeDate.get(empDateKey) ?? []
    );

    let hours = Number(r.worked_hours) || 0;
    if ((!hours || hours <= 0) && r.check_in && inferredCheckout) {
      const ms = new Date(inferredCheckout).getTime() - new Date(r.check_in).getTime();
      if (Number.isFinite(ms) && ms > 0) hours = Math.round((ms / 36e5) * 100) / 100;
    }

    rec.daily[r.date] = {
      checkIn: r.check_in ?? null,
      checkOut: inferredCheckout,
      hours,
    };
    rec.total += hours;
  }

  const results = Array.from(byEmployee.values()).map(({ employee, daily, total }) => ({
    employee: {
      id: employee.id,
      employee_code: employee.employee_code ?? '',
      name: employee.name,
      department: employee.department,
    },
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
