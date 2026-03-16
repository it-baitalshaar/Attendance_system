import { createSupabbaseFrontendClient } from '@/lib/supabase';
import type { OfficeReportDepartmentKey } from '../types';
import type { OfficeReportSetting, OfficeReportEmailRow } from '../types';

const OFFICE_DEPTS: OfficeReportDepartmentKey[] = ['Office Baitalshaar', 'Alsaqia Showroom'];

export async function loadOfficeReportSettings(): Promise<OfficeReportSetting[]> {
  const supabase = createSupabbaseFrontendClient();
  const { data, error } = await supabase
    .from('office_report_settings')
    .select('id, department, enabled, report_time, updated_at')
    .in('department', OFFICE_DEPTS)
    .order('department');
  if (error) {
    console.error('Error loading office report settings', error);
    return [];
  }
  return (data ?? []) as OfficeReportSetting[];
}

export async function loadOfficeReportEmails(): Promise<Record<OfficeReportDepartmentKey, OfficeReportEmailRow[]>> {
  const supabase = createSupabbaseFrontendClient();
  const { data, error } = await supabase
    .from('office_report_emails')
    .select('id, department, email, created_at')
    .in('department', OFFICE_DEPTS)
    .order('department')
    .order('created_at');
  if (error) {
    console.error('Error loading office report emails', error);
    return { 'Office Baitalshaar': [], 'Alsaqia Showroom': [] };
  }
  const rows = (data ?? []) as OfficeReportEmailRow[];
  return {
    'Office Baitalshaar': rows.filter((r) => r.department === 'Office Baitalshaar'),
    'Alsaqia Showroom': rows.filter((r) => r.department === 'Alsaqia Showroom'),
  };
}

export async function toggleOfficeReport(id: string, enabled: boolean): Promise<{ error: unknown }> {
  const supabase = createSupabbaseFrontendClient();
  const { error } = await supabase
    .from('office_report_settings')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error ?? null };
}

export async function addOfficeReportEmail(
  department: OfficeReportDepartmentKey,
  email: string
): Promise<{ error: unknown }> {
  const supabase = createSupabbaseFrontendClient();
  const { error } = await supabase.from('office_report_emails').insert({ department, email });
  return { error: error ?? null };
}

export async function deleteOfficeReportEmail(id: string): Promise<{ error: unknown }> {
  const supabase = createSupabbaseFrontendClient();
  const { error } = await supabase.from('office_report_emails').delete().eq('id', id);
  return { error: error ?? null };
}

export async function updateOfficeReportTime(
  id: string,
  reportTime: string
): Promise<{ error: unknown }> {
  const supabase = createSupabbaseFrontendClient();
  const [h = '00', m = '00'] = reportTime.split(':');
  const timeSql = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`;
  const { error } = await supabase
    .from('office_report_settings')
    .update({ report_time: timeSql, updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error ?? null };
}

export async function sendTestOfficeReport(
  department: OfficeReportDepartmentKey
): Promise<{ sent?: number; reason?: string; error?: unknown }> {
  const supabase = createSupabbaseFrontendClient();
  const { data, error } = await supabase.functions.invoke('send-office-daily-report', {
    body: { department },
  });
  if (error) return { error };
  const sent = (data as { sent?: number })?.sent;
  const reason = (data as { reason?: string })?.reason;
  return { sent, reason };
}
