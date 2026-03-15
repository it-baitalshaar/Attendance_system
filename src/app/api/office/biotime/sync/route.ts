import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type BioTimePunchState = 0 | 1;

type BioTimeTransaction = {
  employee_code?: string | null;
  punch_time?: string | null;
  punch_state?: BioTimePunchState | number | null;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

function parseIsoDate(isoLike: string): string | null {
  // Accepts ISO strings like "2026-03-09T08:55:00" or "2026-03-09 08:55:00"
  const s = isoLike.trim();
  if (s.length < 10) return null;
  const datePart = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  return datePart;
}

export async function POST(req: Request) {
  const expected = process.env.OFFICE_SYNC_SECRET;
  const provided =
    req.headers.get('x-office-sync-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    null;
  if (!expected || !provided || provided !== expected) {
    return unauthorized();
  }

  const baseUrl = process.env.BIOTIME_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: 'BIOTIME_BASE_URL is not set' },
      { status: 500 }
    );
  }

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/att/api/transactionReport/`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      // If your BioTime server needs auth, add headers here (token/basic/etc).
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json(
        { error: 'Failed to fetch BioTime transactions', status: res.status, details: text.slice(0, 500) },
        { status: 502 }
      );
    }

    const json = (await res.json()) as unknown;
    const rows: BioTimeTransaction[] = Array.isArray(json)
      ? (json as BioTimeTransaction[])
      : Array.isArray((json as any)?.data)
        ? ((json as any).data as BioTimeTransaction[])
        : Array.isArray((json as any)?.results)
          ? ((json as any).results as BioTimeTransaction[])
          : [];

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, fetched: 0, processed: 0, skipped: 0 });
    }

    const supabaseAdmin = getAdminClient();

    // Build employee_code -> id map
    const { data: empRows, error: empErr } = await supabaseAdmin
      .from('office_employees')
      .select('id, employee_code');

    if (empErr) {
      return NextResponse.json(
        { error: 'Failed to load office_employees', details: empErr.message },
        { status: 500 }
      );
    }

    const employeeIdByCode = new Map<string, string>();
    (empRows ?? []).forEach((r: { id: string; employee_code: string }) => {
      if (r?.employee_code) employeeIdByCode.set(String(r.employee_code), String(r.id));
    });

    let processed = 0;
    let skipped = 0;
    let unknownEmployees = 0;

    for (const tx of rows) {
      const employeeCode = (tx.employee_code ?? '').toString().trim();
      const punchTime = (tx.punch_time ?? '').toString().trim();
      const punchState = tx.punch_state;

      if (!employeeCode || !punchTime || (punchState !== 0 && punchState !== 1)) {
        skipped++;
        continue;
      }

      const employeeId = employeeIdByCode.get(employeeCode);
      if (!employeeId) {
        unknownEmployees++;
        continue;
      }

      const date = parseIsoDate(punchTime);
      if (!date) {
        skipped++;
        continue;
      }

      const action = punchState === 0 ? 'checkin' : 'checkout';

      // 1) Insert log first (dedupe on unique constraint)
      const { error: logErr } = await supabaseAdmin.from('office_attendance_logs').insert({
        employee_id: employeeId,
        action,
        method: 'biometric',
        timestamp: punchTime,
      });

      if (logErr) {
        // Skip duplicates (unique constraint violation)
        const msg = (logErr.message ?? '').toLowerCase();
        const code = (logErr as any)?.code;
        if (code === '23505' || msg.includes('duplicate key')) {
          skipped++;
          continue;
        }
        return NextResponse.json(
          { error: 'Failed inserting office_attendance_logs', details: logErr.message },
          { status: 500 }
        );
      }

      // 2) Update office_attendance row safely (min checkin / max checkout)
      const { data: existing, error: existingErr } = await supabaseAdmin
        .from('office_attendance')
        .select('id, check_in, check_out, method')
        .eq('employee_id', employeeId)
        .eq('date', date)
        .maybeSingle();

      if (existingErr) {
        return NextResponse.json(
          { error: 'Failed reading office_attendance', details: existingErr.message },
          { status: 500 }
        );
      }

      const next: Record<string, unknown> = {
        employee_id: employeeId,
        date,
        device: 'BioTime',
      };

      const existingCheckIn = existing?.check_in ? new Date(existing.check_in).getTime() : null;
      const existingCheckOut = existing?.check_out ? new Date(existing.check_out).getTime() : null;
      const punchMs = new Date(punchTime).getTime();

      if (!Number.isFinite(punchMs)) {
        skipped++;
        continue;
      }

      if (action === 'checkin') {
        if (existingCheckIn == null || punchMs < existingCheckIn) {
          next.check_in = punchTime;
        }
      } else {
        if (existingCheckOut == null || punchMs > existingCheckOut) {
          next.check_out = punchTime;
        }
      }

      // Set method to biometric unless attendance was manually overridden.
      const existingMethod = (existing?.method ?? null) as string | null;
      if (existingMethod !== 'manual') {
        next.method = 'biometric';
      }

      if (existing?.id) {
        const { error: updErr } = await supabaseAdmin
          .from('office_attendance')
          .update(next)
          .eq('id', existing.id);
        if (updErr) {
          return NextResponse.json(
            { error: 'Failed updating office_attendance', details: updErr.message },
            { status: 500 }
          );
        }
      } else {
        const { error: insErr } = await supabaseAdmin.from('office_attendance').insert(next);
        if (insErr) {
          return NextResponse.json(
            { error: 'Failed inserting office_attendance', details: insErr.message },
            { status: 500 }
          );
        }
      }

      processed++;
    }

    return NextResponse.json({
      ok: true,
      fetched: rows.length,
      processed,
      skipped,
      unknownEmployees,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'BioTime sync failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

