import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email';

const OFFICE_DEPARTMENTS = ['Bait Alshaar', 'Al Saqia'] as const;
type OfficeDept = (typeof OFFICE_DEPARTMENTS)[number];
const UAE_TIMEZONE = 'Asia/Dubai';

function isOfficeDept(s: string): s is OfficeDept {
  return OFFICE_DEPARTMENTS.includes(s as OfficeDept);
}

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
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: UAE_TIMEZONE,
    }).format(d);
  } catch {
    return '—';
  }
}

async function ensureAdminOrCron(request: Request): Promise<{ ok: true } | { error: string; status: number }> {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = request.headers.get('x-cron-secret') ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (header === cronSecret) return { ok: true };
  }
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
  const auth = await ensureAdminOrCron(request);
  if (!('ok' in auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let body: { department?: string } = {};
  try {
    body = await request.json();
  } catch {
    // no body = run all departments
  }
  const singleDept =
    typeof body?.department === 'string' && isOfficeDept(body.department) ? body.department : null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = todayIso();
  const monthStart = firstDayOfMonth();
  const monthEnd = lastDayOfMonth();

  const departmentsToRun: OfficeDept[] = singleDept ? [singleDept] : [...OFFICE_DEPARTMENTS];
  let totalSent = 0;
  const errors: string[] = [];

  for (const department of departmentsToRun) {
    const { data: settingRow } = await supabase
      .from('office_report_settings')
      .select('id, enabled')
      .eq('department', department)
      .single();

    if (!settingRow || !(settingRow as { enabled?: boolean }).enabled) continue;

    const { data: emailRows } = await supabase
      .from('office_report_emails')
      .select('email')
      .eq('department', department);
    const recipients = ((emailRows ?? []) as { email: string }[]).map((r) => r.email).filter(Boolean);
    if (recipients.length === 0) continue;

    let html: string;
    const subject = `Office Daily Report — ${department} — ${today}`;

    const { data: employees } = await supabase
      .from('office_employees')
      .select('id, employee_code, name')
      .eq('department', department);
    const empList = (employees ?? []) as { id: string; employee_code: string; name: string }[];
    const empIds = empList.map((e) => e.id);

    if (empIds.length === 0) {
      html = `
        <h2>Office Daily Report — ${department}</h2>
        <p><strong>Date:</strong> ${today}</p>
        <p>No employees in this department.</p>
        <p><strong>Monthly period:</strong> ${monthStart} to ${monthEnd}</p>
      `;
    } else {
      const { data: todayAttendance } = await supabase
        .from('office_attendance')
        .select('employee_id, check_in, check_out, worked_hours')
        .eq('date', today)
        .in('employee_id', empIds);

      const { data: monthAttendance } = await supabase
        .from('office_attendance')
        .select('employee_id, worked_hours')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .in('employee_id', empIds);

      const todayByEmp = new Map<string, { check_in: string | null; check_out: string | null; hours: number }>();
      for (const row of (todayAttendance ?? []) as {
        employee_id: string;
        check_in: string | null;
        check_out: string | null;
        worked_hours: number | null;
      }[]) {
        todayByEmp.set(row.employee_id, {
          check_in: row.check_in,
          check_out: row.check_out,
          hours: Number(row.worked_hours) || 0,
        });
      }

      const monthlyByEmp = new Map<string, number>();
      for (const row of (monthAttendance ?? []) as { employee_id: string; worked_hours: number | null }[]) {
        const cur = monthlyByEmp.get(row.employee_id) ?? 0;
        monthlyByEmp.set(row.employee_id, cur + (Number(row.worked_hours) || 0));
      }

      const rows = empList.map((emp) => {
        const todayRow = todayByEmp.get(emp.id);
        const monthlyTotal = Math.round((monthlyByEmp.get(emp.id) ?? 0) * 100) / 100;
        return {
          name: emp.name,
          code: emp.employee_code,
          checkIn: todayRow ? formatTime(todayRow.check_in) : '—',
          checkOut: todayRow ? formatTime(todayRow.check_out) : '—',
          todayHours: todayRow ? todayRow.hours.toFixed(2) : '—',
          monthlyTotal: monthlyTotal.toFixed(2),
        };
      });

      const tableRows = rows
        .map(
          (r) =>
            `<tr><td>${r.name}</td><td>${r.code}</td><td>${r.checkIn}</td><td>${r.checkOut}</td><td>${r.todayHours}</td><td>${r.monthlyTotal}</td></tr>`
        )
        .join('');

      html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Office Daily Report — ${department}</title></head>
<body style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 16px;">
  <h2>Office Daily Report — ${department}</h2>
  <p><strong>Date:</strong> ${today}</p>
  <p><strong>Monthly period:</strong> ${monthStart} to ${monthEnd}</p>
  <h3>Daily check-in &amp; monthly total hours</h3>
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
    <thead>
      <tr style="background: #f3f4f6;">
        <th>Name</th>
        <th>Code</th>
        <th>Check-in</th>
        <th>Check-out</th>
        <th>Today (h)</th>
        <th>Monthly total (h)</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
</body>
</html>`;
    }

    const result = await sendMail({
      to: recipients,
      subject,
      html,
    });
    if (result.ok) {
      totalSent += recipients.length;
    } else {
      errors.push(`${department}: ${result.error ?? 'Send failed'}`);
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    sent: totalSent,
    ...(errors.length > 0 && { errors }),
  });
}
