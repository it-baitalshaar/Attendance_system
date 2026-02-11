import { createSupabbaseFrontendClient } from '@/lib/supabase';
import type { ReminderSetting, ReminderEmailRow, DepartmentKey } from '../types';

export async function loadSettings(): Promise<ReminderSetting[]> {
  const supabase = createSupabbaseFrontendClient();
  const { data, error } = await supabase
    .from('attendance_reminder_settings')
    .select('id, department, enabled, reminder_time, updated_at')
    .in('department', ['construction', 'maintenance'])
    .order('department');
  if (error) {
    console.error('Error loading settings', error);
    return [];
  }
  return (data ?? []) as ReminderSetting[];
}

export async function loadEmails(): Promise<Record<DepartmentKey, ReminderEmailRow[]>> {
  const supabase = createSupabbaseFrontendClient();
  const { data, error } = await supabase
    .from('attendance_reminder_emails')
    .select('id, department, email, created_at')
    .in('department', ['construction', 'maintenance'])
    .order('department')
    .order('created_at');
  if (error) {
    console.error('Error loading emails', error);
    return { construction: [], maintenance: [] };
  }
  const rows = (data ?? []) as ReminderEmailRow[];
  return {
    construction: rows.filter((r) => r.department === 'construction'),
    maintenance: rows.filter((r) => r.department === 'maintenance'),
  };
}

export async function toggleReminder(id: string, enabled: boolean): Promise<{ error: unknown }> {
  const supabase = createSupabbaseFrontendClient();
  const { error } = await supabase
    .from('attendance_reminder_settings')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error ?? null };
}

export async function addReminderEmail(
  department: DepartmentKey,
  email: string
): Promise<{ error: unknown }> {
  const supabase = createSupabbaseFrontendClient();
  const { error } = await supabase.from('attendance_reminder_emails').insert({ department, email });
  return { error: error ?? null };
}

export async function deleteReminderEmail(id: string): Promise<{ error: unknown }> {
  const supabase = createSupabbaseFrontendClient();
  const { error } = await supabase.from('attendance_reminder_emails').delete().eq('id', id);
  return { error: error ?? null };
}

export async function updateReminderTime(
  id: string,
  reminderTime: string
): Promise<{ error: unknown }> {
  const supabase = createSupabbaseFrontendClient();
  const { error } = await supabase
    .from('attendance_reminder_settings')
    .update({ reminder_time: reminderTime, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error ?? null };
}

export async function sendTestReminder(
  department: DepartmentKey
): Promise<{ sent?: number; reason?: string; error?: unknown }> {
  const supabase = createSupabbaseFrontendClient();
  const { data, error } = await supabase.functions.invoke('send-attendance-reminder', {
    body: { department },
  });
  if (error) return { error };
  const sent = (data as { sent?: number })?.sent;
  const reason = (data as { reason?: string })?.reason;
  return { sent, reason };
}
