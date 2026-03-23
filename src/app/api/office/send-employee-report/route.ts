import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { sendOfficeEmployeeReportByIdentifier } from '@/lib/officeEmployeeReport';

/**
 * Proxies to the Supabase Edge Function send-office-employee-report.
 * Email is sent from Supabase (same as send-attendance-reminder) using Supabase secrets.
 * Deploy the function: supabase functions deploy send-office-employee-report
 */
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

export async function POST(request: Request) {
  const auth = await ensureAdminOrCron(request);
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Server misconfiguration: Supabase URL or service role key missing' },
      { status: 500 }
    );
  }

  const invoke = async (functionName: string) => {
    const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`;
    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ employeeId }),
    });
    const data = await res.json().catch(() => ({ error: 'Invalid response from Edge Function' }));
    return { res, data };
  };

  let { res, data } = await invoke('send-office-employee-report');
  // Backward compatibility: some projects deployed this as send-employee-report.
  if (res.status === 404) {
    const fallback = await invoke('send-employee-report');
    res = fallback.res;
    data = fallback.data;
  }

  if (!res.ok) {
    const manual = await sendOfficeEmployeeReportByIdentifier({
      supabaseUrl,
      serviceRoleKey,
      employeeIdentifier: employeeId,
    });
    if (!manual.ok) {
      return NextResponse.json({ ok: false, error: manual.error ?? 'Failed to send email' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, sent: true, via: 'server-fallback' });
  }
  return NextResponse.json(data);
}
