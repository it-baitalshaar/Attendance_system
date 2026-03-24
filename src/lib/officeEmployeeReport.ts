import { createClient } from '@supabase/supabase-js';
import { sendMail } from '@/lib/email';

const UAE_TIMEZONE = 'Asia/Dubai';

function getUaeDateIso(offsetDays = 0): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: UAE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});
  const y = Number(parts.year ?? '1970');
  const m = Number(parts.month ?? '1');
  const d = Number(parts.day ?? '1');
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function getUaeMonthEndIso(): string {
  const nowIso = getUaeDateIso(0);
  return lastDayOfMonth(nowIso);
}

function firstDayOfMonth(baseDateIso: string): string {
  const [y = '1970', m = '01'] = baseDateIso.split('-');
  return `${y}-${m}-01`;
}

function lastDayOfMonth(baseDateIso: string): string {
  const [y = '1970', m = '01'] = baseDateIso.split('-');
  const last = new Date(Date.UTC(Number(y), Number(m), 0));
  const day = String(last.getUTCDate()).padStart(2, '0');
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

/** All calendar dates from start to end inclusive (YYYY-MM-DD). */
function enumerateDatesInclusive(startIso: string, endIso: string): string[] {
  const out: string[] = [];
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ey, em, ed] = endIso.split('-').map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  while (cur <= end) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendOfficeEmployeeReportByIdentifier({
  supabaseUrl,
  serviceRoleKey,
  employeeIdentifier,
  subjectPrefix = 'Your work hours',
  reportType = 'daily',
}: {
  supabaseUrl: string;
  serviceRoleKey: string;
  employeeIdentifier: string;
  subjectPrefix?: string;
  reportType?: 'daily' | 'monthEnd';
}): Promise<{ ok: boolean; error?: string; employeeId?: string; reportDate?: string }> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let { data: employee, error: empError } = await supabase
    .from('office_employees')
    .select('id, employee_code, name, email, personal_email, department')
    .eq('id', employeeIdentifier)
    .single();

  if (empError || !employee) {
    const fallbackByCode = await supabase
      .from('office_employees')
      .select('id, employee_code, name, email, personal_email, department')
      .eq('employee_code', employeeIdentifier)
      .maybeSingle();
    employee = fallbackByCode.data as typeof employee;
    empError = fallbackByCode.error as typeof empError;
  }

  if (empError || !employee) {
    return { ok: false, error: `Employee not found for identifier: ${employeeIdentifier}` };
  }

  const resolvedEmployeeId = (employee as { id: string }).id;

  const { data: overrideRow } = await supabase
    .from('office_employee_overrides')
    .select('personal_email')
    .eq('employee_id', resolvedEmployeeId)
    .maybeSingle();

  const overrideEmail = (overrideRow as { personal_email?: string | null } | null)?.personal_email?.trim() || null;
  const toEmail =
    overrideEmail ||
    (employee as { personal_email?: string | null }).personal_email?.trim() ||
    (employee as { email?: string | null }).email?.trim() ||
    '';
  if (!toEmail) {
    return { ok: false, error: 'Employee has no email or personal_email set' };
  }

  const reportDate = reportType === 'monthEnd' ? getUaeMonthEndIso() : getUaeDateIso(-1);
  const monthStart = firstDayOfMonth(reportDate);
  const monthEnd = lastDayOfMonth(reportDate);
  const monthLabel = monthStart.slice(0, 7);

  const name = (employee as { name?: string }).name ?? 'Employee';
  const code = (employee as { employee_code?: string }).employee_code ?? '';
  const safeName = escapeHtml(name);

  let html: string;
  let mailSubject: string;

  if (reportType === 'monthEnd') {
    const { data: monthAttendanceRows, error: monthAttErr } = await supabase
      .from('office_attendance')
      .select('date, check_in, check_out, worked_hours')
      .eq('employee_id', resolvedEmployeeId)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date', { ascending: true });

    if (monthAttErr) {
      return { ok: false, error: monthAttErr.message ?? 'Failed to load attendance' };
    }

    const byDate = new Map<
      string,
      { check_in: string | null; check_out: string | null; worked_hours: number | null }
    >();
    for (const r of (monthAttendanceRows ?? []) as {
      date: string;
      check_in: string | null;
      check_out: string | null;
      worked_hours: number | null;
    }[]) {
      if (r?.date) byDate.set(r.date, { check_in: r.check_in, check_out: r.check_out, worked_hours: r.worked_hours });
    }

    const allDates = enumerateDatesInclusive(monthStart, monthEnd);
    let monthHours = 0;
    const tableRows = allDates
      .map((d) => {
        const row = byDate.get(d);
        const wh = Number(row?.worked_hours) || 0;
        monthHours += wh;
        const cin = row ? formatTime(row.check_in) : '—';
        const cout = row ? formatTime(row.check_out) : '—';
        const hrs = row && row.worked_hours != null ? wh.toFixed(2) : '—';
        return `<tr><td>${d}</td><td>${cin}</td><td>${cout}</td><td>${hrs}</td></tr>`;
      })
      .join('');

    const monthlyTotal = Math.round(monthHours * 100) / 100;

    html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subjectPrefix)} — ${safeName}</title></head>
<body style="font-family: sans-serif; max-width: 720px; margin: 0 auto; padding: 16px;">
  <h2>${escapeHtml(subjectPrefix)}</h2>
  <p>Hi ${safeName},</p>
  <p><strong>Month (UAE):</strong> ${monthStart} to ${monthEnd}</p>
  <p style="font-size: 13px; color: #4b5563;">Below is each day in the month with check-in, check-out, and hours. Days with no attendance show —.</p>
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 13px;">
    <thead>
      <tr style="background: #f3f4f6;">
        <th align="left">Date</th>
        <th align="left">Check-in</th>
        <th align="left">Check-out</th>
        <th align="right">Hours</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr style="background: #f9fafb; font-weight: bold;">
        <td colspan="3" align="right">Monthly total</td>
        <td align="right">${monthlyTotal.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  <p style="margin-top: 24px; color: #6b7280; font-size: 12px;">Employee code: ${escapeHtml(code)}</p>
</body>
</html>`;
    mailSubject = `${subjectPrefix} — ${monthLabel}`;
  } else {
    const { data: todayRow } = await supabase
      .from('office_attendance')
      .select('check_in, check_out, worked_hours')
      .eq('employee_id', resolvedEmployeeId)
      .eq('date', reportDate)
      .maybeSingle();

    const { data: monthRows } = await supabase
      .from('office_attendance')
      .select('worked_hours')
      .eq('employee_id', resolvedEmployeeId)
      .gte('date', monthStart)
      .lte('date', monthEnd);

    const todayEntry = (todayRow ?? null) as {
      check_in: string | null;
      check_out: string | null;
      worked_hours: number | null;
    } | null;
    const monthHours = (monthRows ?? []).reduce(
      (sum, r) => sum + (Number((r as { worked_hours: number | null }).worked_hours) || 0),
      0
    );
    const monthlyTotal = Math.round(monthHours * 100) / 100;

    const checkIn = todayEntry ? formatTime(todayEntry.check_in) : '—';
    const checkOut = todayEntry ? formatTime(todayEntry.check_out) : '—';
    const todayHours = todayEntry ? (Number(todayEntry.worked_hours) || 0).toFixed(2) : '—';

    html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(subjectPrefix)} — ${safeName}</title></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 16px;">
  <h2>${escapeHtml(subjectPrefix)}</h2>
  <p>Hi ${safeName},</p>
  <p><strong>Date (yesterday, UAE):</strong> ${reportDate}</p>
  <p><strong>Monthly period:</strong> ${monthStart} to ${monthEnd}</p>
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
    <thead>
      <tr style="background: #f3f4f6;">
        <th>Check-in</th>
        <th>Check-out</th>
        <th>Day (h)</th>
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
  <p style="margin-top: 24px; color: #6b7280; font-size: 12px;">Employee code: ${escapeHtml(code)}</p>
</body>
</html>`;
    mailSubject = `${subjectPrefix} — ${reportDate}`;
  }

  const result = await sendMail({
    to: toEmail,
    subject: mailSubject,
    html,
  });
  if (!result.ok) return { ok: false, error: result.error ?? 'Failed to send email' };
  return { ok: true, employeeId: resolvedEmployeeId, reportDate };
}
