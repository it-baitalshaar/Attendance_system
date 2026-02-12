import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabbaseFrontendClient } from '@/lib/supabase';
import {
  PasswordData,
  UserProfile,
  fetchUserProfileService,
  logoutService,
  updatePasswordService,
} from '../services/profileService';
import { isSuperUserEmail } from '../constants';

type AdminTab = 'employees' | 'departments' | 'users' | 'attendance' | 'profile' | 'reports' | 'reminders';

export function useAdminAuth(initialTab: AdminTab = 'employees') {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isSuperUser, setIsSuperUser] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    email: '',
    id: '',
    role: '',
  });
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    const supabase = createSupabbaseFrontendClient();

    const checkAuth = async () => {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
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

        if (!profile || (profile as any).role !== 'admin') {
          router.replace('/app/not-authorized');
          return;
        }
        setCurrentUserId(userData.user.id);
        const email =
          userData.user.email ??
          sessionData.session.user?.email ??
          (userData.user as { email?: string }).email;
        setIsSuperUser(isSuperUserEmail(email));
      }

      setCheckingAuth(false);
    };

    checkAuth();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkAuth();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router]);

  useEffect(() => {
    const shouldFetchProfile = activeTab === 'profile' && !checkingAuth;

    if (!shouldFetchProfile) {
      return;
    }

    const loadProfile = async () => {
      try {
        const profile = await fetchUserProfileService();
        if (profile) {
          setUserProfile(profile);
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      }
    };

    loadProfile();
  }, [activeTab, checkingAuth]);

  const handleLogout = async () => {
    try {
      await logoutService();
      router.replace('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const handlePasswordInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);
    setPasswordMessage('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage('New passwords do not match');
      setPasswordLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordMessage('Password must be at least 6 characters');
      setPasswordLoading(false);
      return;
    }

    try {
      await updatePasswordService(userProfile.email, passwordData);
      setPasswordMessage('Password updated successfully');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      if (error?.code === 'INVALID_CURRENT_PASSWORD') {
        setPasswordMessage('Current password is incorrect');
      } else if (error?.code === 'UPDATE_PASSWORD_FAILED') {
        setPasswordMessage(`Error updating password: ${error.message}`);
      } else {
        setPasswordMessage('An unexpected error occurred');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  return {
    checkingAuth,
    activeTab,
    setActiveTab,
    currentUserId,
    isSuperUser,
    userProfile,
    passwordData,
    passwordMessage,
    passwordLoading,
    handleLogout,
    handlePasswordInputChange,
    handlePasswordChange,
  };
}

