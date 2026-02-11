'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabbaseFrontendClient } from '@/lib/supabase';

export function useRemindersAuth() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createSupabbaseFrontendClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace('/login');
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userData.user.id)
          .single();
        if (!profile || (profile as { role?: string }).role !== 'admin') {
          router.replace('/not-authorized');
          return;
        }
      }
      setCheckingAuth(false);
    };
    checkAuth();
  }, [router]);

  return { checkingAuth };
}
