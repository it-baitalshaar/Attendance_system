import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendMail } from '@/lib/email';
import {
  reconcileOfficeAttendanceDateRange,
  reconcileOfficeAttendanceDay,
} from '@/lib/officeAttendanceReconcileRpc';

const OFFICE_DEPARTMENTS = ['Bait Alshaar', 'Al Saqia'] as const;
type OfficeDept = (typeof OFFICE_DEPARTMENTS)[number];
const UAE_TIMEZONE = 'Asia/Dubai';
const MIN_CHECKOUT_GAP_MS = 3 * 60 * 1000;

function isOfficeDept(s: string): s is OfficeDept {
  return OFFICE_DEPARTMENTS.includes(s as OfficeDept);
}

function todayIso(): string {
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
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function uaeTodayIso(): string {
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
  return `${parts.year ?? '1970'}-${parts.month ?? '01'}-${parts.day ?? '01'}`;
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

function dateKeyFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return String(iso).slice(0, 10);
}

function isIsoDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isIsoMonth(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}$/.test(s);
}

function inferCheckoutFromLogs(
  checkInIso: string | null,
  existingCheckoutIso: string | null,
  logs: string[]
): string | null {
  if (existingCheckoutIso) return existingCheckoutIso;
  if (!checkInIso) return null;
  const checkInMs = new Date(checkInIso).getTime();
  if (!Number.isFinite(checkInMs)) return null;
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

  let body: {
    department?: string;
    reportType?: 'daily' | 'monthEnd';
    reportDate?: string; // YYYY-MM-DD (daily override)
    reportMonth?: string; // YYYY-MM (month-end override)
  } = {};
  try {
    body = await request.json();
  } catch {
    // no body = run all departments
  }
  const singleDept =
    typeof body?.department === 'string' && isOfficeDept(body.department) ? body.department : null;
  const reportType: 'daily' | 'monthEnd' = body?.reportType === 'monthEnd' ? 'monthEnd' : 'daily';

  const reportDateOverride = typeof body?.reportDate === 'string' ? body.reportDate.trim() : null;
  const reportMonthOverride = typeof body?.reportMonth === 'string' ? body.reportMonth.trim() : null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const uaeToday = uaeTodayIso();
  let reportDate: string;
  let monthStart: string;
  let monthEnd: string;

  if (reportType === 'monthEnd') {
    const baseMonthIso = isIsoMonth(reportMonthOverride) ? `${reportMonthOverride}-01` : uaeToday;
    monthStart = firstDayOfMonth(baseMonthIso);
    monthEnd = lastDayOfMonth(baseMonthIso);
    reportDate = monthEnd; // not used in month-end html logic, but keeps variables consistent
  } else {
    reportDate = isIsoDate(reportDateOverride) ? reportDateOverride : todayIso();
    monthStart = firstDayOfMonth(reportDate);
    monthEnd = lastDayOfMonth(reportDate);
  }

  if (reportType === 'monthEnd') {
    await reconcileOfficeAttendanceDateRange(supabase, monthStart, monthEnd);
  } else {
    await reconcileOfficeAttendanceDay(supabase, reportDate);
  }

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
    const subject =
      reportType === 'monthEnd'
        ? `Office Month-end Report — ${department} — ${monthStart.slice(0, 7)}`
        : `Office Daily Report — ${department} — ${reportDate}`;

    const { data: employees } = await supabase
      .from('office_employees')
      .select('id, employee_code, name')
      .eq('department', department);
    const empList = ((employees ?? []) as { id: string; employee_code: string; name: string }[]).sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
    const empIds = empList.map((e) => e.id);

    if (empIds.length === 0) {
      html = `
        <h2>${reportType === 'monthEnd' ? 'Office Month-end Report' : 'Office Daily Report'} — ${department}</h2>
        <p><strong>${reportType === 'monthEnd' ? 'Month' : 'Date'}:</strong> ${
          reportType === 'monthEnd' ? `${monthStart} to ${monthEnd}` : reportDate
        }</p>
        <p>No employees in this department.</p>
        <p><strong>Monthly period:</strong> ${monthStart} to ${monthEnd}</p>
      `;
    } else {
      if (reportType === 'monthEnd') {
        const { data: monthLogs } = await supabase
          .from('office_attendance_logs')
          .select('employee_id, timestamp')
          .in('employee_id', empIds)
          .gte('timestamp', `${monthStart}T00:00:00.000Z`)
          .lte('timestamp', `${monthEnd}T23:59:59.999Z`)
          .order('timestamp', { ascending: true });
        const logsByDateEmp = new Map<string, string[]>();
        for (const l of (monthLogs ?? []) as { employee_id: string; timestamp: string }[]) {
          const dk = dateKeyFromIso(l.timestamp);
          if (!dk) continue;
          const k = `${l.employee_id}|${dk}`;
          const arr = logsByDateEmp.get(k) ?? [];
          arr.push(l.timestamp);
          logsByDateEmp.set(k, arr);
        }

        const { data: monthAttendance } = await supabase
          .from('office_attendance')
          .select('employee_id, date, check_in, check_out, worked_hours')
          .gte('date', monthStart)
          .lte('date', monthEnd)
          .in('employee_id', empIds)
          .order('date', { ascending: true });

        const empMap = new Map(empList.map((e) => [e.id, e] as const));
        const totals = new Map<string, { hours: number; days: Set<string> }>();
        const byDateEmp = new Map<string, Map<string, { check_in: string | null; check_out: string | null; h: number }>>();
        let maxDateSeen = monthStart;

        for (const row of (monthAttendance ?? []) as {
          employee_id: string;
          date: string;
          check_in: string | null;
          check_out: string | null;
          worked_hours: number | null;
        }[]) {
          const inferredCheckout = inferCheckoutFromLogs(
            row.check_in,
            row.check_out,
            logsByDateEmp.get(`${row.employee_id}|${row.date}`) ?? []
          );
          let h = Number(row.worked_hours) || 0;
          if (h <= 0 && row.check_in && inferredCheckout) {
            const ms = new Date(inferredCheckout).getTime() - new Date(row.check_in).getTime();
            if (Number.isFinite(ms) && ms > 0) h = Math.round((ms / 36e5) * 100) / 100;
          }
          const t = totals.get(row.employee_id) ?? { hours: 0, days: new Set<string>() };
          t.hours += h;
          if (row.date) t.days.add(row.date);
          totals.set(row.employee_id, t);
          if (row.date > maxDateSeen) maxDateSeen = row.date;

          const dateMap = byDateEmp.get(row.date) ?? new Map<string, { check_in: string | null; check_out: string | null; h: number }>();
          dateMap.set(row.employee_id, { check_in: row.check_in, check_out: inferredCheckout, h });
          byDateEmp.set(row.date, dateMap);
        }

        const summaryRows = empList
          .map((emp) => {
            const t = totals.get(emp.id) ?? { hours: 0, days: new Set<string>() };
            return `<tr><td>${emp.name}</td><td>${emp.employee_code}</td><td>${t.days.size}</td><td>${t.hours.toFixed(
              2
            )}</td></tr>`;
          })
          .join('');
        const endDateForGrid = maxDateSeen > monthStart ? maxDateSeen : monthEnd;
        const dateList: string[] = [];
        {
          const start = new Date(`${monthStart}T00:00:00.000Z`);
          const end = new Date(`${endDateForGrid}T00:00:00.000Z`);
          for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
            dateList.push(d.toISOString().slice(0, 10));
          }
        }

        const headerCols = empList
          .map((emp) => `<th style="min-width: 140px;">${emp.name}<br/><span style="font-weight: normal; color: #6b7280;">${emp.employee_code}</span></th>`)
          .join('');

        const gridRows = dateList
          .map((date) => {
            const perEmp = byDateEmp.get(date) ?? new Map<string, { check_in: string | null; check_out: string | null; h: number }>();
            const cols = empList
              .map((emp) => {
                const r = perEmp.get(emp.id);
                if (!r) {
                  return '<td style="color:#9ca3af;background:#f3f4f6;">—</td>';
                }
                const cin = formatTime(r.check_in);
                const cout = formatTime(r.check_out);
                const hasEither = cin !== '—' || cout !== '—';
                const timeRange = hasEither ? `${cin}-${cout}` : '—';
                const incomplete = cin !== '—' && cout === '—';
                const cellStyle = incomplete ? 'background:#fffbeb;color:#92400e;' : '';
                return `<td style="${cellStyle}">${timeRange}<br/><span style="font-size:11px;color:#6b7280;">${r.h.toFixed(
                  2
                )}h</span></td>`;
              })
              .join('');
            return `<tr><td><strong>${date}</strong></td>${cols}</tr>`;
          })
          .join('');

        const detailTable = `
  <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-top: 12px; font-size: 12px;">
    <thead>
      <tr style="background: #f3f4f6;">
        <th style="min-width: 110px;">Date</th>
        ${headerCols}
      </tr>
    </thead>
    <tbody>${gridRows}</tbody>
  </table>`;

        html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Office Month-end Report — ${department}</title></head>
<body style="font-family: sans-serif; max-width: 900px; margin: 0 auto; padding: 16px;">
  <h2>Office Month-end Report — ${department}</h2>
  <p><strong>Month (UAE):</strong> ${monthStart} to ${monthEnd}</p>
  <h3>Summary per employee</h3>
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
    <thead><tr style="background: #f3f4f6;"><th>Name</th><th>Code</th><th>Worked days</th><th>Total hours</th></tr></thead>
    <tbody>${summaryRows}</tbody>
  </table>
  <h3 style="margin-top: 16px;">Daily details (employees as columns)</h3>
  ${detailTable}
</body>
</html>`;
      } else {
        const { data: dayLogs } = await supabase
          .from('office_attendance_logs')
          .select('employee_id, timestamp')
          .in('employee_id', empIds)
          .gte('timestamp', `${reportDate}T00:00:00.000Z`)
          .lte('timestamp', `${reportDate}T23:59:59.999Z`)
          .order('timestamp', { ascending: true });
        const logsByEmp = new Map<string, string[]>();
        for (const l of (dayLogs ?? []) as { employee_id: string; timestamp: string }[]) {
          const arr = logsByEmp.get(l.employee_id) ?? [];
          arr.push(l.timestamp);
          logsByEmp.set(l.employee_id, arr);
        }

        const { data: todayAttendance } = await supabase
          .from('office_attendance')
          .select('employee_id, check_in, check_out, worked_hours')
          .eq('date', reportDate)
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
          const inferredCheckout = inferCheckoutFromLogs(
            row.check_in,
            row.check_out,
            logsByEmp.get(row.employee_id) ?? []
          );
          let h = Number(row.worked_hours) || 0;
          if (h <= 0 && row.check_in && inferredCheckout) {
            const ms = new Date(inferredCheckout).getTime() - new Date(row.check_in).getTime();
            if (Number.isFinite(ms) && ms > 0) h = Math.round((ms / 36e5) * 100) / 100;
          }
          todayByEmp.set(row.employee_id, {
            check_in: row.check_in,
            check_out: inferredCheckout,
            hours: h,
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
  <p><strong>Date:</strong> ${reportDate}</p>
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
