/**
 * POST /api/attendance-report-edit
 *
 * Admin-only. Updates a single employee/date attendance record in place:
 *   - Attendance.status + status_attendance (from status_code)
 *   - Attendance.notes
 *   - Attendance_projects.working_hours  (distributed proportionally across existing rows)
 *   - Attendance_projects.overtime_hours (per OT-type bucket, proportional)
 *
 * If no Attendance_projects rows exist for that record, hours/OT updates are skipped
 * and { hoursSkipped: true } is returned in the response body.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Permissive type for the service-role client when used with dynamic table names
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = { from: (table: string) => any };

// ── Reverse map: report status_code → DB columns ──────────────────────────────
function codeToStatus(code: string): { status: string; status_attendance: string } {
  const map: Record<string, { status: string; status_attendance: string }> = {
    P:    { status: 'present',  status_attendance: 'Present' },
    W:    { status: 'present',  status_attendance: 'Weekend' },
    H:    { status: 'present',  status_attendance: 'Holiday-Work' },
    HDAM: { status: 'present',  status_attendance: 'Half Day AM' },
    HDPM: { status: 'present',  status_attendance: 'Half Day PM' },
    AWO:  { status: 'absent',   status_attendance: 'Absence without excuse' },
    SL:   { status: 'absent',   status_attendance: 'Sick Leave' },
    A:    { status: 'absent',   status_attendance: 'Absence with excuse' },
    V:    { status: 'vacation', status_attendance: 'vacation' },
  };
  return map[code] ?? { status: 'present', status_attendance: code };
}

function normalizeOtType(raw: string | null): 'normal' | 'holiday' | 'public_holiday' {
  const s = (raw ?? '').toLowerCase().replace(/[\s-]/g, '_');
  if (s === 'holiday') return 'holiday';
  if (s === 'public_holiday') return 'public_holiday';
  return 'normal';
}

// ── Admin guard ───────────────────────────────────────────────────────────────
async function ensureAdmin(): Promise<{ userId: string } | { error: string; status: 401 | 403 }> {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Unauthorized', status: 401 };
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single();
  if (!profile || (profile as { role?: string }).role !== 'admin') {
    return { error: 'Forbidden', status: 403 };
  }
  return { userId: user.id };
}

// ── Proportional hour distributor ─────────────────────────────────────────────
type ProjRow = {
  project_id: string;
  working_hours: number;
  overtime_hours: number;
  overtime_type: string | null;
};

async function distributeHours(
  db: AnyDb,
  tableName: string,
  attendanceId: string,
  rows: ProjRow[],
  newWorkingHours?: number,
  newOtNormal?: number,
  newOtHoliday?: number,
  newOtPublicHoliday?: number,
): Promise<boolean> {
  // Returns true if any update was skipped due to no rows
  if (rows.length === 0) {
    const wantsUpdate =
      newWorkingHours !== undefined ||
      newOtNormal !== undefined ||
      newOtHoliday !== undefined ||
      newOtPublicHoliday !== undefined;
    return wantsUpdate;
  }

  const scale = (rows: ProjRow[], field: 'working_hours' | 'overtime_hours', oldTotal: number, newTotal: number) =>
    rows.map(r => ({
      project_id: r.project_id,
      newVal: Math.round(
        (oldTotal > 0 ? (Number(r[field]) || 0) / oldTotal : 1 / rows.length) * newTotal * 10
      ) / 10,
    }));

  if (newWorkingHours !== undefined) {
    const oldTotal = rows.reduce((s, r) => s + (Number(r.working_hours) || 0), 0);
    const newTotal = Number(newWorkingHours) || 0;
    if (oldTotal !== newTotal) {
      for (const { project_id, newVal } of scale(rows, 'working_hours', oldTotal, newTotal)) {
        await db.from(tableName)
          .update({ working_hours: newVal })
          .eq('attendance_id', attendanceId)
          .eq('project_id', project_id);
      }
    }
  }

  const otUpdates: Array<{ bucket: 'normal' | 'holiday' | 'public_holiday'; newVal: number | undefined }> = [
    { bucket: 'normal',         newVal: newOtNormal },
    { bucket: 'holiday',        newVal: newOtHoliday },
    { bucket: 'public_holiday', newVal: newOtPublicHoliday },
  ];

  for (const { bucket, newVal } of otUpdates) {
    if (newVal === undefined) continue;
    const bucketRows = rows.filter(r => normalizeOtType(r.overtime_type) === bucket);
    if (bucketRows.length === 0) continue;
    const oldTotal = bucketRows.reduce((s, r) => s + (Number(r.overtime_hours) || 0), 0);
    const newTotal = Number(newVal) || 0;
    if (oldTotal === newTotal) continue;
    for (const { project_id, newVal: scaled } of scale(bucketRows, 'overtime_hours', oldTotal, newTotal)) {
      await db.from(tableName)
        .update({ overtime_hours: scaled })
        .eq('attendance_id', attendanceId)
        .eq('project_id', project_id);
    }
  }

  return false;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const authResult = await ensureAdmin();
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const body = await request.json().catch(() => null);
  const {
    employee_id,
    date,
    status_code,
    working_hours,
    overtime_normal,
    overtime_holiday,
    overtime_public_holiday,
    notes,
  } = body ?? {};

  if (!employee_id || !date) {
    return NextResponse.json({ error: 'employee_id and date are required' }, { status: 400 });
  }

  // Service-role client bypasses RLS for reliable writes
  const db: AnyDb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // Find the Attendance row
  const { data: attData, error: attErr } = await db
    .from('Attendance')
    .select('id')
    .eq('employee_id', employee_id)
    .eq('date', date)
    .limit(1);

  if (attErr) return NextResponse.json({ error: attErr.message }, { status: 500 });
  if (!attData || attData.length === 0) {
    return NextResponse.json(
      { error: `No attendance record found for employee ${employee_id} on ${date}` },
      { status: 404 }
    );
  }
  const attendanceId = (attData[0] as { id: string }).id;

  // Update Attendance (status + notes)
  const attUpdate: Record<string, unknown> = {};
  if (status_code !== undefined) {
    const fields = codeToStatus(String(status_code));
    attUpdate.status = fields.status;
    attUpdate.status_attendance = fields.status_attendance;
  }
  if (notes !== undefined) attUpdate.notes = notes || null;

  if (Object.keys(attUpdate).length > 0) {
    const { error } = await db.from('Attendance').update(attUpdate).eq('id', attendanceId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update Attendance_projects (hours / OT)
  const needsProjectUpdate =
    working_hours !== undefined ||
    overtime_normal !== undefined ||
    overtime_holiday !== undefined ||
    overtime_public_holiday !== undefined;

  let hoursSkipped = false;
  if (needsProjectUpdate) {
    let projTable = 'Attendance_projects';
    let projRows: ProjRow[] = [];

    for (const t of ['Attendance_projects', 'attendance_projects']) {
      const { data, error } = await db
        .from(t)
        .select('project_id, working_hours, overtime_hours, overtime_type')
        .eq('attendance_id', attendanceId);
      if (!error) {
        projTable = t;
        projRows = (data ?? []) as ProjRow[];
        break;
      }
    }

    hoursSkipped = await distributeHours(
      db, projTable, attendanceId, projRows,
      working_hours as number | undefined,
      overtime_normal as number | undefined,
      overtime_holiday as number | undefined,
      overtime_public_holiday as number | undefined,
    );
  }

  return NextResponse.json({ ok: true, ...(hoursSkipped && { hoursSkipped: true }) });
}
