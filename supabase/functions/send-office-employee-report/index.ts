// Supabase Edge Function: send-office-employee-report
// Body: { "employeeId": "<office_employees.id>" }
// Sends today's check-in/out and current month total hours to that employee's email.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2';
const UAE_TIMEZONE = 'Asia/Dubai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const employeeId = typeof body?.employeeId === 'string' ? body.employeeId.trim() : '';
    if (!employeeId) {
      return new Response(
        JSON.stringify({ ok: false, error: 'employeeId is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const apiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Attendance <onboarding@resend.dev>';

    const { data: employee, error: empError } = await supabase
      .from('office_employees')
      .select('id, employee_code, name, email, personal_email, department')
      .eq('id', employeeId)
      .single();

    if (empError || !employee) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Employee not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 },
      );
    }

    const { data: overrideRow } = await supabase
      .from('office_employee_overrides')
      .select('personal_email')
      .eq('employee_id', employeeId)
      .maybeSingle();

    const overrideEmail = (overrideRow as { personal_email?: string | null } | null)?.personal_email?.trim() || null;
    const toEmail = overrideEmail
      || (employee as { personal_email?: string | null }).personal_email?.trim()
      || (employee as { email?: string | null }).email?.trim()
      || '';
    if (!toEmail) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Employee has no email or personal_email set' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      );
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
    const monthHours = (monthRows ?? []).reduce(
      (sum, r) => sum + (Number((r as { worked_hours: number | null }).worked_hours) || 0),
      0,
    );
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

    if (!apiKey) {
      return new Response(
        JSON.stringify({ ok: false, error: 'RESEND_API_KEY is not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
      );
    }

    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject: `Your work hours — ${today}`,
      html,
    });

    return new Response(
      JSON.stringify({ ok: true, sent: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    );
  }
});

