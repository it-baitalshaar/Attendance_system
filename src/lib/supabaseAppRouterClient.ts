import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'


export function createSupabaseServerClient(serverComponent = false) {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string)
                {
                    return cookies().get(name)?.value;
                },
                set(name: string, value: string, options: any)
                {
                    if (serverComponent)
                    {
                        return;
                    }
                    cookies().set(name, value, options);
                },
                remove(name: string, options: any)
                {
                    cookies().set(name, "", options)
                }
            }
        }
    )
}

export function createSupabaseServerComponentClient(){
    return createSupabaseServerClient(true);
}