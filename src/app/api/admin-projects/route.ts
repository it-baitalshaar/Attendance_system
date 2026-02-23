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

    const { data, error } = await supabase
      .from('projects')
      .insert({ project_name: trimmed, department: dept, project_status: status })
      .select('project_id, project_name, department, project_status')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
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

    const payload: Record<string, string> = {};

    if (typeof project_name === 'string') {
      const trimmed = project_name.trim();
      if (!trimmed) {
        return NextResponse.json(
          { error: 'Project name cannot be empty' },
          { status: 400 }
        );
      }
      payload.project_name = trimmed;
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
      return NextResponse.json({ ok: true });
    }

    const supabase = getAdminClient();

    const { error } = await supabase
      .from('projects')
      .update(payload)
      .eq('project_id', project_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
