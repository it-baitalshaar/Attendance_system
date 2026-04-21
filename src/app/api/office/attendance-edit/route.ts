import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

async function ensureAdmin() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get(name: string) { return cookieStore.get(name)?.value; } } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: 401 as const };
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!profile || (profile as { role?: string }).role !== 'admin') return { error: 'Forbidden', status: 403 as const };
  return { user };
}

/**
 * POST /api/office/attendance-edit
 *
 * Body: { employee_id, date, check_in, check_out }
 *   employee_id : office_employees.id (uuid)
 *   date        : "YYYY-MM-DD"
 *   check_in    : ISO timestamp or null
 *   check_out   : ISO timestamp or null
 *
 * Upserts into office_attendance with method='manual' using the service role
 * key so RLS is bypassed. Only admins may call this.
 */
export async function POST(request: Request) {
  const authResult = await ensureAdmin();
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const body = await request.json().catch(() => null);
  const { employee_id, date, check_in, check_out } = body ?? {};

  if (!employee_id || !date) {
    return NextResponse.json({ error: 'employee_id and date are required' }, { status: 400 });
  }

  let workedHours: number | null = null;
  if (check_in && check_out) {
    const diff = (new Date(check_out).getTime() - new Date(check_in).getTime()) / 3600000;
    workedHours = diff > 0 ? Math.round(diff * 100) / 100 : null;
  }

  // Use service role key to bypass RLS
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error } = await serviceClient
    .from('office_attendance')
    .upsert(
      {
        employee_id,
        date,
        check_in: check_in ?? null,
        check_out: check_out ?? null,
        worked_hours: workedHours,
        method: 'manual',
      },
      { onConflict: 'employee_id,date' }
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
