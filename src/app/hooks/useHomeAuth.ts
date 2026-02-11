'use client';

import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useRouter } from 'next/navigation';
import { createSupabbaseFrontendClient } from '@/lib/supabase';
import { setDepartment } from '@/redux/slice';

export function useHomeAuth() {
  const dispatch = useDispatch();
  const router = useRouter();
  const [userDisplay, setUserDisplay] = useState<{ name?: string; email?: string; id?: string } | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);

  const handleLogout = async () => {
    const supabase = createSupabbaseFrontendClient();
    try {
      await supabase.auth.signOut();
      router.replace('/login');
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function loadUser() {
      const supabase = createSupabbaseFrontendClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const name =
        user.user_metadata?.full_name ||
        user.email?.split('@')[0] ||
        user.id.slice(0, 8);
      setUserDisplay({ name, email: user.email ?? undefined, id: user.id });
      const { data: profile } = await supabase
        .from('profiles')
        .select('Department, role')
        .eq('id', user.id)
        .single();
      if (cancelled) return;
      if (profile) {
        const dept = (profile as { Department?: string }).Department ?? '';
        setUserDepartment(dept || null);
        dispatch(setDepartment(dept));
      }
    }
    loadUser();
    return () => { cancelled = true; };
  }, [dispatch]);

  return { userDisplay, userDepartment, handleLogout };
}
