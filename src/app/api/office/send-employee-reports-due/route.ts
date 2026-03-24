import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendOfficeEmployeeReportByIdentifier } from '@/lib/officeEmployeeReport';

const UAE_TIMEZONE = 'Asia/Dubai';

type EmployeeScheduleRow = {
  id: string;
  auto_daily_report_enabled: boolean;
  auto_daily_report_time: string;
  auto_month_end_report_enabled: boolean;
  auto_month_end_report_time: string;
  last_daily_report_sent_on: string | null;
  last_month_end_report_sent_month: string | null;
};

function getUaeNowParts(now = new Date()) {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: UAE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});

  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: UAE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});

  const y = dateParts.year ?? '1970';
  const m = dateParts.month ?? '01';
  const d = dateParts.day ?? '01';
  const hh = timeParts.hour ?? '00';
  const mm = timeParts.minute ?? '00';
  const today = `${y}-${m}-${d}`;
  const monthKey = `${y}-${m}`;
  const currentHm = `${hh}:${mm}`;
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  return { today, monthKey, currentHm, isMonthEnd: Number(d) === lastDay };
}

function normalizeHm(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const [h = '00', m = '00'] = value.split(':');
  return `${h.padStart(2, '0').slice(0, 2)}:${m.padStart(2, '0').slice(0, 2)}`;
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: 401 };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || (profile as { role?: string }).role !== 'admin') return { error: 'Forbidden', status: 403 };
  return { ok: true };
}

async function runDueReports(request: Request) {
  const auth = await ensureAdminOrCron(request);
  if (!('ok' in auth)) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Server misconfiguration: Supabase URL or service role key missing' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { today, monthKey, currentHm, isMonthEnd } = getUaeNowParts(new Date());

  const { data: rows, error } = await supabase
    .from('office_employees')
    .select(
      'id, auto_daily_report_enabled, auto_daily_report_time, auto_month_end_report_enabled, auto_month_end_report_time, last_daily_report_sent_on, last_month_end_report_sent_month'
    );
  if (error) {
    return NextResponse.json({ error: error.message ?? 'Failed to load employee schedules' }, { status: 500 });
  }

  let sentDaily = 0;
  let sentMonthEnd = 0;
  const errors: string[] = [];
  const candidates = (rows ?? []) as EmployeeScheduleRow[];

  for (const row of candidates) {
    const monthEndDue =
      isMonthEnd &&
      !!row.auto_month_end_report_enabled &&
      normalizeHm(row.auto_month_end_report_time, '18:00') <= currentHm &&
      row.last_month_end_report_sent_month !== monthKey;

    const dailyDue =
      !!row.auto_daily_report_enabled &&
      normalizeHm(row.auto_daily_report_time, '10:00') <= currentHm &&
      row.last_daily_report_sent_on !== today &&
      !monthEndDue; // On the month-end day, send only month-end to avoid duplicates.

    if (!dailyDue && !monthEndDue) continue;

    const reportType = monthEndDue ? 'monthEnd' : 'daily';
    const send = await sendOfficeEmployeeReportByIdentifier({
      supabaseUrl,
      serviceRoleKey,
      employeeIdentifier: row.id,
      subjectPrefix: reportType === 'monthEnd' ? 'Month-end work hours report' : 'Your work hours',
      reportType,
    });

    if (!send.ok || !send.employeeId) {
      errors.push(`employee ${row.id}: ${send.error ?? 'send failed'}`);
      continue;
    }

    const patch: Record<string, string> = {};
    if (dailyDue) {
      patch.last_daily_report_sent_on = today;
      sentDaily += 1;
    }
    if (monthEndDue) {
      patch.last_month_end_report_sent_month = monthKey;
      sentMonthEnd += 1;
    }
    const { error: updateError } = await supabase.from('office_employees').update(patch).eq('id', send.employeeId);
    if (updateError) {
      errors.push(`employee ${row.id}: failed to update send markers (${updateError.message})`);
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    timezone: UAE_TIMEZONE,
    currentTime: currentHm,
    today,
    month: monthKey,
    sentDaily,
    sentMonthEnd,
    errors,
  });
}

export async function POST(request: Request) {
  return runDueReports(request);
}

export async function GET(request: Request) {
  return runDueReports(request);
}
