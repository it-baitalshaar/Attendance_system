import { createSupabbaseFrontendClient } from '@/lib/supabase';

export interface UserProfile {
  email: string;
  id: string;
  role: string;
}

export interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export async function fetchUserProfileService(): Promise<UserProfile | null> {
  const supabase = createSupabbaseFrontendClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw userError || new Error('No user found');
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userData.user.id)
    .single();

  if (profileError) {
    throw profileError;
  }

  return {
    email: userData.user.email || '',
    id: userData.user.id,
    role: (profileData as any)?.role || '',
  };
}

export async function updatePasswordService(
  email: string,
  passwordData: PasswordData
): Promise<void> {
  const supabase = createSupabbaseFrontendClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: passwordData.currentPassword,
  });

  if (signInError) {
    const error: any = new Error('Current password is incorrect');
    error.code = 'INVALID_CURRENT_PASSWORD';
    throw error;
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: passwordData.newPassword,
  });

  if (updateError) {
    const error: any = new Error(updateError.message);
    error.code = 'UPDATE_PASSWORD_FAILED';
    throw error;
  }
}

export async function logoutService(): Promise<void> {
  const supabase = createSupabbaseFrontendClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

