import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { createSupabaseServerComponentClient } from "@/lib/supabaseAppRouterClient";

export async function POST(req: Request) {
  const { password } = await req.json();
  const supbase = createSupabaseServerComponentClient();

//   if (!access_token) {
//     return NextResponse.json({ error: 'Missing access token' }, { status: 400 });
//   }

  // Create the server-side Supabase client
//   const supabase = createServerClient({ cookies: req.cookies });

  // Reset password with the access token
//   const { error } = await supabase.auth.api.updateUser(access_token, { password });
  const { data, error } = await supbase.auth.updateUser({
    password,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ message: 'Password updated successfully' });
}
