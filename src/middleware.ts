import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseReqResClient } from './lib/supabaseReqResClient';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Skip middleware for static assets and API routes
  if (
    req.nextUrl.pathname.startsWith('/_next') ||
    req.nextUrl.pathname.startsWith('/api')
  ) {
    return res;
  }

  // Create a Supabase client to check the session
  const supabase = createSupabaseReqResClient(req, res);

  // Fetch the authenticated user securely from Supabase
  const { data: userData, error: userError } = await supabase.auth.getUser();

  // If no user is logged in and trying to access protected routes, redirect to login
  if (!userData.user && req.nextUrl.pathname !== '/login') {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // If user is trying to access login page but already authenticated, redirect to appropriate page
  if (userData.user && req.nextUrl.pathname === '/login') {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();
    
    if (profile?.role === 'admin') {
      const adminUrl = new URL('/admin', req.url);
      return NextResponse.redirect(adminUrl);
    } else {
      const homeUrl = new URL('/', req.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  // If user is logged in, continue with the session checks
  if (userData.user) {
    const userId = userData.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Skip attendance check for admin pages
    if (!req.nextUrl.pathname.startsWith('/admin')) {
      const { data: attendance, error: attendanceError } = await supabase
        .from('Track_Attendance')
        .select('*')
        .eq('employee_id', userId)
        .eq('date', today)
        .single();

      if (attendance) {
        const alreadyAttendedUrl = new URL('/already-attended', req.url);
        return NextResponse.redirect(alreadyAttendedUrl); // Redirect if attendance exists
      }
    }

    // Fetch the user's role from the profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)  // Make sure 'id' is the correct field in the profiles table
      .single();

    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError);
      const notAuthorizedUrl = new URL('/app/not-authorized', req.url);
      return NextResponse.redirect(notAuthorizedUrl);
    }

    const userRole = profile.role;

    console.log("this sit eh userrole ", userRole, req.nextUrl.pathname)
    // Restrict access to `/admin` for non-admin users
    if (req.nextUrl.pathname.startsWith('/admin') && userRole !== 'admin') {
      const notAuthorizedUrl = new URL('/app/not-authorized', req.url);
      return NextResponse.redirect(notAuthorizedUrl);
    }
  }

  // If the user is logged in and authorized, proceed to the requested page
  return res;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
