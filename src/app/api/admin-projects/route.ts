import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const missing = !url ? 'NEXT_PUBLIC_SUPABASE_URL' : 'SUPABASE_SERVICE_ROLE_KEY';
    throw new Error(`${missing} is required`);
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function ensureAdmin() {
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

  if (!user) {
    return { error: 'Unauthorized', status: 401 as const };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || (profile as { role?: string }).role !== 'admin') {
    return { error: 'Forbidden', status: 403 as const };
  }

  return { user };
}

export async function GET() {
  const authResult = await ensureAdmin();
  if ('error' in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('projects')
      .select('project_id, project_name, department, project_status')
      .order('project_name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ projects: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await ensureAdmin();
  if ('error' in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const body = await request.json();
    const { project_name, department, project_status } = body;

    const trimmed = typeof project_name === 'string' ? project_name.trim() : '';
    if (!trimmed) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    const validDepts = ['Construction', 'Maintenance', 'Construction Maintenance'];
    const dept = validDepts.includes(department) ? department : 'Construction';

    const validStatuses = ['active', 'none active'];
    const status = validStatuses.includes(project_status)
      ? project_status
      : 'active';

    const supabase = getAdminClient();

    // projects.project_id is a text primary key with no DB default and it doubles
    // as the value stored in Attendance_projects.project_id, so it must equal the name.
    // projects.overtime_rate is legacy and unused (OT rates live on Attendance_projects),
    // but it is NOT NULL without a default, so it must be sent as 0 like every existing row.
    const [{ data: sameId }, { data: sameName }] = await Promise.all([
      supabase.from('projects').select('project_id').eq('project_id', trimmed).limit(1),
      supabase.from('projects').select('project_id').eq('project_name', trimmed).limit(1),
    ]);

    if ((sameId?.length ?? 0) > 0 || (sameName?.length ?? 0) > 0) {
      return NextResponse.json(
        { error: `A project named "${trimmed}" already exists` },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        project_id: trimmed,
        project_name: trimmed,
        department: dept,
        project_status: status,
        overtime_rate: 0,
      })
      .select('project_id, project_name, department, project_status')
      .single();

    if (error) {
      const message =
        error.code === '23505'
          ? `A project named "${trimmed}" already exists`
          : error.message;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ project: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await ensureAdmin();
  if ('error' in authResult) {
    return NextResponse.json(
      { error: authResult.error },
      { status: authResult.status }
    );
  }

  try {
    const body = await request.json();
    const { project_id, project_name, department, project_status } = body;

    if (!project_id || typeof project_id !== 'string') {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { data: current, error: loadError } = await supabase
      .from('projects')
      .select('project_id, project_name, department, project_status')
      .eq('project_id', project_id)
      .maybeSingle();

    if (loadError) {
      return NextResponse.json({ error: loadError.message }, { status: 400 });
    }
    if (!current) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const payload: Record<string, string> = {};
    let renamedTo: string | null = null;

    if (typeof project_name === 'string') {
      const trimmed = project_name.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: 'Project name cannot be empty' },
          { status: 400 }
        );
      }

      if (trimmed !== current.project_name || trimmed !== current.project_id) {
        const [{ data: sameId }, { data: sameName }] = await Promise.all([
          supabase
            .from('projects')
            .select('project_id')
            .eq('project_id', trimmed)
            .neq('project_id', project_id)
            .limit(1),
          supabase
            .from('projects')
            .select('project_id')
            .eq('project_name', trimmed)
            .neq('project_id', project_id)
            .limit(1),
        ]);

        if ((sameId?.length ?? 0) > 0 || (sameName?.length ?? 0) > 0) {
          return NextResponse.json(
            { error: `A project named "${trimmed}" already exists` },
            { status: 409 }
          );
        }

        // Keep project_id === project_name so attendance history and dropdowns stay aligned.
        payload.project_name = trimmed;
        payload.project_id = trimmed;
        renamedTo = trimmed;
      }
    }

    if (department !== undefined) {
      const validDepts = [
        'Construction',
        'Maintenance',
        'Construction Maintenance',
      ];
      if (validDepts.includes(department)) {
        payload.department = department;
      }
    }

    if (project_status !== undefined) {
      if (project_status === 'active' || project_status === 'none active') {
        payload.project_status = project_status;
      }
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json({
        ok: true,
        project_id: current.project_id,
      });
    }

    const { error } = await supabase
      .from('projects')
      .update(payload)
      .eq('project_id', project_id);

    if (error) {
      const message =
        error.code === '23505'
          ? `A project named "${payload.project_name ?? ''}" already exists`
          : error.message;
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Cascade rename into attendance history (no FK CASCADE assumed).
    if (renamedTo && renamedTo !== project_id) {
      for (const tableName of ['Attendance_projects', 'attendance_projects'] as const) {
        const { error: cascadeError } = await supabase
          .from(tableName)
          .update({ project_id: renamedTo })
          .eq('project_id', project_id);

        // Ignore missing alternate table name; report real update failures.
        if (
          cascadeError &&
          !/relation|does not exist|schema cache/i.test(cascadeError.message)
        ) {
          return NextResponse.json(
            {
              error: `Project renamed, but failed to update attendance history: ${cascadeError.message}`,
            },
            { status: 400 }
          );
        }
        if (!cascadeError) break;
      }
    }

    return NextResponse.json({
      ok: true,
      project_id: renamedTo ?? project_id,
      renamed: Boolean(renamedTo && renamedTo !== project_id),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
