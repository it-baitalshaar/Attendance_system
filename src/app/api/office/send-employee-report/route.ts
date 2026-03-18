import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstDayOfMonth(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function lastDayOfMonth(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const y = last.getFullYear();
  const m = String(last.getMonth() + 1).padStart(2, '0');
  const day = String(last.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '—';
  }
}

async function ensureAdmin(): Promise<{ ok: true } | { error: string; status: number }> {
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
  if (!user) return { error: 'Unauthorized', status: 401 };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || (profile as { role?: string }).role !== 'admin') return { error: 'Forbidden', status: 403 };
  return { ok: true };
}

export async function POST(request: Request) {
  const auth = await ensureAdmin();
  if (!('ok' in auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { employeeId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const employeeId = typeof body?.employeeId === 'string' ? body.employeeId.trim() : null;
  if (!employeeId) {
    return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: employee, error: empError } = await supabase
    .from('office_employees')
    .select('id, employee_code, name, email, personal_email, department')
    .eq('id', employeeId)
    .single();

  if (empError || !employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const { data: override } = await supabase
    .from('office_employee_overrides')
    .select('personal_email')
    .eq('employee_id', employeeId)
    .maybeSingle();

  const toEmail = (override as { personal_email?: string | null } | null)?.personal_email?.trim() ||
    (employee as { personal_email?: string | null }).personal_email?.trim() ||
    (employee as { email?: string }).email?.trim();
  if (!toEmail) {
    return NextResponse.json({ error: 'Employee has no email or personal email set' }, { status: 400 });
  }

  const today = todayIso();
  const monthStart = firstDayOfMonth();
  const monthEnd = lastDayOfMonth();

  const { data: todayRow } = await supabase
    .from('office_attendance')
    .select('check_in, check_out, worked_hours')
    .eq('employee_id', employeeId)
    .eq('date', today)
    .maybeSingle();

  const { data: monthRows } = await supabase
    .from('office_attendance')
    .select('worked_hours')
    .eq('employee_id', employeeId)
    .gte('date', monthStart)
    .lte('date', monthEnd);

  const todayEntry = (todayRow ?? null) as { check_in: string | null; check_out: string | null; worked_hours: number | null } | null;
  const monthHours = (monthRows ?? []).reduce((sum, r) => sum + (Number((r as { worked_hours: number | null }).worked_hours) || 0), 0);
  const monthlyTotal = Math.round(monthHours * 100) / 100;

  const name = (employee as { name?: string }).name ?? 'Employee';
  const code = (employee as { employee_code?: string }).employee_code ?? '';
  const checkIn = todayEntry ? formatTime(todayEntry.check_in) : '—';
  const checkOut = todayEntry ? formatTime(todayEntry.check_out) : '—';
  const todayHours = todayEntry ? (Number(todayEntry.worked_hours) || 0).toFixed(2) : '—';

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Your work hours — ${name}</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 16px;">
  <h2>Your work hours</h2>
  <p>Hi ${name},</p>
  <p><strong>Date:</strong> ${today}</p>
  <p><strong>Monthly period:</strong> ${monthStart} to ${monthEnd}</p>
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
    <thead>
      <tr style="background: #f3f4f6;">
        <th>Check-in</th>
        <th>Check-out</th>
        <th>Today (h)</th>
        <th>Monthly total (h)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${checkIn}</td>
        <td>${checkOut}</td>
        <td>${todayHours}</td>
        <td>${monthlyTotal.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  <p style="margin-top: 24px; color: #6b7280; font-size: 12px;">Employee code: ${code}</p>
</body>
</html>`;

  const result = await sendMail({
    to: toEmail,
    subject: `Your work hours — ${today}`,
    html,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent: true });
}
