// Supabase Edge Function: send office daily report (check-in + monthly total hours)
// CRON: run daily at 10:00 AM (configure in Supabase Dashboard → Database → Cron)
// Body (optional): { "department": "Office Baitalshaar" } for test send of one department

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from 'https://esm.sh/resend@2';

const OFFICE_DEPARTMENTS = ['Office Baitalshaar', 'Alsaqia Showroom'] as const;
type OfficeDept = (typeof OFFICE_DEPARTMENTS)[number];

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
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '—';
  }
}

Deno.serve(async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));
    const singleDept = typeof body?.department === 'string' && isOfficeDept(body.department)
      ? body.department
      : null;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const apiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Attendance <onboarding@resend.dev>';

    const today = todayIso();
    const monthStart = firstDayOfMonth();
    const monthEnd = lastDayOfMonth();

    let totalSent = 0;
    const departmentsToRun: OfficeDept[] = singleDept
      ? [singleDept]
      : OFFICE_DEPARTMENTS.slice();

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

      const { data: employees } = await supabase
        .from('office_employees')
        .select('id, employee_code, name')
        .eq('department', department);
      const empList = (employees ?? []) as { id: string; employee_code: string; name: string }[];
      const empIds = empList.map((e) => e.id);
      if (empIds.length === 0) {
        if (apiKey && recipients.length > 0) {
          const resend = new Resend(apiKey);
          const html = `
            <h2>Office Daily Report — ${department}</h2>
            <p><strong>Date:</strong> ${today}</p>
            <p>No employees in this department.</p>
            <p><strong>Monthly period:</strong> ${monthStart} to ${monthEnd}</p>
          `;
          await resend.emails.send({
            from: fromEmail,
            to: recipients,
            subject: `Office Daily Report — ${department} — ${today}`,
            html,
          });
          totalSent += recipients.length;
        }
        continue;
      }

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
      for (const row of (todayAttendance ?? []) as { employee_id: string; check_in: string | null; check_out: string | null; worked_hours: number | null }[]) {
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

      const html = `
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

      if (apiKey) {
        const resend = new Resend(apiKey);
        await resend.emails.send({
          from: fromEmail,
          to: recipients,
          subject: `Office Daily Report — ${department} — ${today}`,
          html,
        });
        totalSent += recipients.length;
      }
    }

    return new Response(
      JSON.stringify({ ok: true, sent: totalSent }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
