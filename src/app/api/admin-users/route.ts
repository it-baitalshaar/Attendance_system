import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SUPER_USER_EMAIL = 'itbaitalshaar@gmail.com';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const missing = !url ? 'NEXT_PUBLIC_SUPABASE_URL' : 'SUPABASE_SERVICE_ROLE_KEY';
    throw new Error(`${missing} is required. Add it to .env.local (local dev) or your deployment env vars.`);
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isSuperUserEmail(email: string | null | undefined): boolean {
  return email?.toLowerCase().trim() === SUPER_USER_EMAIL.toLowerCase();
}

async function ensureSuperUser() {
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

  if (!isSuperUserEmail(user.email)) {
    return { error: 'User management is restricted to the super user', status: 403 as const };
  }

  return { user };
}

export async function GET() {
  const authResult = await ensureSuperUser();
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const supabaseAdmin = getAdminClient();

    const { data: usersData, error: usersError } =
      await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    if (usersError) {
      return NextResponse.json(
        { error: usersError.message },
        { status: 400 }
      );
    }

    const userIds = usersData.users.map((u) => u.id);
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, role, Department')
      .in('id', userIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [
        p.id,
        {
          role: (p as { role?: string }).role || 'regular_user',
          Department: (p as { Department?: string }).Department || null,
        },
      ])
    );

    const users = usersData.users
      .filter((u) => u.email)
      .map((u) => {
        const p = profileMap.get(u.id);
        return {
          id: u.id,
          email: u.email,
          role: p?.role || 'regular_user',
          department: p?.Department || null,
        };
      });

    return NextResponse.json({ users });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authResult = await ensureSuperUser();
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await req.json();
    const { email, password, role, department } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getAdminClient();

    const { data: newUser, error: createError } =
      await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
      });

    if (createError) {
      return NextResponse.json(
        { error: createError.message },
        { status: 400 }
      );
    }

    if (!newUser.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 400 }
      );
    }

    await supabaseAdmin.from('profiles').upsert(
      {
        id: newUser.user.id,
        role: role || 'regular_user',
        Department: department || null,
      },
      { onConflict: 'id' }
    );

    return NextResponse.json({
      message: 'User created successfully',
      user: {
        id: newUser.user.id,
        email: newUser.user.email,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const authResult = await ensureSuperUser();
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const body = await req.json();
    const { userId, role, department } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getAdminClient();

    const payload: { id: string; role?: string; Department?: string | null } = {
      id: userId,
    };
    if (role !== undefined) payload.role = role;
    if (department !== undefined) payload.Department = department || null;

    if (Object.keys(payload).length === 1) {
      return NextResponse.json(
        { error: 'Nothing to update' },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert(payload, { onConflict: 'id' });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: 'Profile updated' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const authResult = await ensureSuperUser();
  if ('error' in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    if (userId === authResult.user.id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      );
    }

    const supabaseAdmin = getAdminClient();

    await supabaseAdmin.from('profiles').delete().eq('id', userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
