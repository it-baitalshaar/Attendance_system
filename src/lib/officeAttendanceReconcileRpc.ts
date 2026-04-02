import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Rebuilds office_attendance from office_attendance_logs for one office calendar day (Asia/Dubai).
 * Safe to call if RPC is missing (migration not applied): no-op on error.
 */
export async function reconcileOfficeAttendanceDay(
  supabase: SupabaseClient,
  reportDate: string
): Promise<void> {
  const { error } = await supabase.rpc('office_reconcile_office_day', { p_date: reportDate });
  if (error && process.env.NODE_ENV === 'development') {
    console.warn('[officeAttendanceReconcileRpc] office_reconcile_office_day:', error.message);
  }
}

export async function reconcileOfficeAttendanceDateRange(
  supabase: SupabaseClient,
  start: string,
  end: string
): Promise<void> {
  const { error } = await supabase.rpc('office_reconcile_office_date_range', {
    p_start: start,
    p_end: end,
  });
  if (error && process.env.NODE_ENV === 'development') {
    console.warn('[officeAttendanceReconcileRpc] office_reconcile_office_date_range:', error.message);
  }
}
