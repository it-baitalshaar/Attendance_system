'use client';

import { useState, useEffect, useCallback } from 'react';
import { createSupabbaseFrontendClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const DEPARTMENTS = [
  { value: 'construction', label: 'Construction' },
  { value: 'maintenance', label: 'Maintenance' },
] as const;

type DepartmentKey = (typeof DEPARTMENTS)[number]['value'];

interface ReminderSetting {
  id: string;
  department: string;
  enabled: boolean;
  reminder_time: string;
  updated_at: string;
}

interface ReminderEmailRow {
  id: string;
  department: string;
  email: string;
  created_at: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatTime(timeStr: string): string {
  if (!timeStr) return '--:--';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h ?? '0', 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${(m ?? '00').padStart(2, '0')} ${ampm}`;
}

export default function AttendanceRemindersPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [settings, setSettings] = useState<ReminderSetting[]>([]);
  const [emailsByDept, setEmailsByDept] = useState<Record<DepartmentKey, ReminderEmailRow[]>>({
    construction: [],
    maintenance: [],
  });
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState<Record<DepartmentKey, string>>({
    construction: '',
    maintenance: '',
  });
  const [errorByDept, setErrorByDept] = useState<Record<DepartmentKey, string>>({
    construction: '',
    maintenance: '',
  });
  const [toggling, setToggling] = useState<DepartmentKey | null>(null);
  const [testingDept, setTestingDept] = useState<DepartmentKey | null>(null);
  const [testStatusByDept, setTestStatusByDept] = useState<Record<DepartmentKey, string>>({
    construction: '',
    maintenance: '',
  });
  const [timeByDept, setTimeByDept] = useState<Record<DepartmentKey, string>>({
    construction: '15:00',
    maintenance: '20:00',
  });

  const loadSettings = useCallback(async () => {
    const supabase = createSupabbaseFrontendClient();
    const { data, error } = await supabase
      .from('attendance_reminder_settings')
      .select('id, department, enabled, reminder_time, updated_at')
      .in('department', ['construction', 'maintenance'])
      .order('department');
    if (error) {
      console.error('Error loading settings', error);
      return;
    }
    const rows = (data ?? []) as ReminderSetting[];
    setSettings(rows);
    // Keep a simple HH:MM value in state for the editable time inputs
    const nextTimes: Record<DepartmentKey, string> = { construction: '15:00', maintenance: '20:00' };
    rows.forEach((row) => {
      const [h = '00', m = '00'] = row.reminder_time.split(':');
      const key = row.department as DepartmentKey;
      if (key === 'construction' || key === 'maintenance') {
        nextTimes[key] = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
      }
    });
    setTimeByDept(nextTimes);
  }, []);

  const loadEmails = useCallback(async () => {
    const supabase = createSupabbaseFrontendClient();
    const { data, error } = await supabase
      .from('attendance_reminder_emails')
      .select('id, department, email, created_at')
      .in('department', ['construction', 'maintenance'])
      .order('department')
      .order('created_at');
    if (error) {
      console.error('Error loading emails', error);
      return;
    }
    const rows = (data ?? []) as ReminderEmailRow[];
    const byDept: Record<DepartmentKey, ReminderEmailRow[]> = {
      construction: rows.filter((r) => r.department === 'construction'),
      maintenance: rows.filter((r) => r.department === 'maintenance'),
    };
    setEmailsByDept(byDept);
  }, []);

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
        if (!profile || profile.role !== 'admin') {
          router.replace('/not-authorized');
          return;
        }
      }
      setCheckingAuth(false);
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (checkingAuth) return;
    setLoading(true);
    Promise.all([loadSettings(), loadEmails()]).finally(() => setLoading(false));
  }, [checkingAuth, loadSettings, loadEmails]);

  const handleToggle = async (department: DepartmentKey) => {
    const row = settings.find((s) => s.department === department);
    if (!row) return;
    setToggling(department);
    const supabase = createSupabbaseFrontendClient();
    const { error } = await supabase
      .from('attendance_reminder_settings')
      .update({ enabled: !row.enabled, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    setToggling(null);
    if (error) {
      console.error('Toggle error', error);
      return;
    }
    await loadSettings();
  };

  const handleAddEmail = async (department: DepartmentKey) => {
    const email = newEmail[department]?.trim().toLowerCase();
    if (!email) {
      setErrorByDept((prev) => ({ ...prev, [department]: 'Enter an email address.' }));
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setErrorByDept((prev) => ({ ...prev, [department]: 'Invalid email format.' }));
      return;
    }
    const existing = emailsByDept[department].some((r) => r.email.toLowerCase() === email);
    if (existing) {
      setErrorByDept((prev) => ({ ...prev, [department]: 'This email is already in the list.' }));
      return;
    }
    setErrorByDept((prev) => ({ ...prev, [department]: '' }));
    const supabase = createSupabbaseFrontendClient();
    const { error } = await supabase.from('attendance_reminder_emails').insert({
      department,
      email,
    });
    if (error) {
      setErrorByDept((prev) => ({ ...prev, [department]: error.message }));
      return;
    }
    setNewEmail((prev) => ({ ...prev, [department]: '' }));
    await loadEmails();
  };

  const handleDeleteEmail = async (id: string) => {
    const supabase = createSupabbaseFrontendClient();
    const { error } = await supabase.from('attendance_reminder_emails').delete().eq('id', id);
    if (error) {
      console.error('Delete error', error);
      return;
    }
    await loadEmails();
  };

  const handleTestSend = async (department: DepartmentKey) => {
    const supabase = createSupabbaseFrontendClient();
    setTestingDept(department);
    setTestStatusByDept((prev) => ({ ...prev, [department]: 'Sending test…' }));
    const { data, error } = await supabase.functions.invoke('send-attendance-reminder', {
      body: { department },
    });
    setTestingDept(null);
    if (error) {
      console.error('send-attendance-reminder error', error);
      const anyErr = error as any;
      const ctxBody = anyErr?.context?.body;
      let msg = `Error: ${error.message}`;
      if (ctxBody) {
        msg = `Error from function: ${ctxBody}`;
      }
      setTestStatusByDept((prev) => ({ ...prev, [department]: msg }));
      return;
    }
    const sent = (data as any)?.sent as number | undefined;
    const reason = (data as any)?.reason as string | undefined;
    let msg: string;
    if (sent && sent > 0) msg = `Sent to ${sent} recipient(s).`;
    else if (reason) msg = `No email sent: ${reason}.`;
    else msg = 'Test call completed.';
    setTestStatusByDept((prev) => ({ ...prev, [department]: msg }));
  };

  const handleTimeChange = async (department: DepartmentKey, value: string) => {
    setTimeByDept((prev) => ({ ...prev, [department]: value }));
    const row = settings.find((s) => s.department === department);
    if (!row) return;
    const [h = '00', m = '00'] = value.split(':');
    const timeSql = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`;
    const supabase = createSupabbaseFrontendClient();
    const { error } = await supabase
      .from('attendance_reminder_settings')
      .update({ reminder_time: timeSql, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (error) {
      console.error('Update reminder_time error', error);
      return;
    }
    await loadSettings();
  };

  if (checkingAuth) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4">Verifying authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="text-blue-600 hover:underline"
          >
            ← Admin Dashboard
          </Link>
          <h1 className="text-2xl font-bold">Attendance Reminder Settings</h1>
        </div>
      </div>

      <p className="text-gray-600 mb-6">
        Control reminder emails for Construction (3:00 PM) and Maintenance (8:00 PM). Only listed emails receive reminders when attendance is not submitted for the day.
      </p>

      {loading ? (
        <p className="text-center py-8">Loading...</p>
      ) : (
        <>
          {/* Section A — Enable / Disable */}
          <section className="mb-8 p-4 bg-white rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Enable / Disable Reminders</h2>
            <div className="space-y-4">
              {DEPARTMENTS.map(({ value, label }) => {
                const row = settings.find((s) => s.department === value);
                const isOn = row?.enabled ?? false;
                const isToggling = toggling === value;
                return (
                  <div
                    key={value}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{label}</span>
                      {row && (
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                          <span>Reminder time:</span>
                          <input
                            type="time"
                            value={timeByDept[value]}
                            onChange={(e) => handleTimeChange(value, e.target.value)}
                            className="border rounded px-2 py-1 text-sm"
                          />
                          <span className="text-gray-400">
                            ({formatTime(row.reminder_time)})
                          </span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle(value)}
                      disabled={isToggling || !row}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                        isOn ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
                          isOn ? 'translate-x-5' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              If OFF, no reminder emails are sent for that department even when attendance is missing.
            </p>
          </section>

          {/* Section B — Email list per department */}
          <section className="space-y-8">
            {DEPARTMENTS.map(({ value, label }) => (
              <div key={value} className="p-4 bg-white rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-3">
                  Reminder emails — {label}
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                  These addresses receive a reminder if attendance is not submitted by the reminder time.
                </p>
                <ul className="space-y-2 mb-4">
                  {emailsByDept[value].length === 0 ? (
                    <li className="text-gray-500 text-sm">No emails added yet.</li>
                  ) : (
                    emailsByDept[value].map((row) => (
                      <li
                        key={row.id}
                        className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-50"
                      >
                        <span className="text-sm">{row.email}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteEmail(row.id)}
                          className="text-red-600 hover:underline text-sm"
                        >
                          Delete
                        </button>
                      </li>
                    ))
                  )}
                </ul>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="email"
                    value={newEmail[value]}
                    onChange={(e) => {
                      setNewEmail((prev) => ({ ...prev, [value]: e.target.value }));
                      setErrorByDept((prev) => ({ ...prev, [value]: '' }));
                    }}
                    placeholder="email@company.com"
                    className="border rounded px-3 py-2 w-64 max-w-full"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddEmail(value)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    + Add Email
                  </button>
                </div>
                {errorByDept[value] && (
                  <p className="text-red-500 text-sm mt-1">{errorByDept[value]}</p>
                )}
                <div className="mt-4 flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTestSend(value)}
                      disabled={testingDept === value}
                      className="text-sm px-3 py-1.5 rounded border border-blue-600 text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                    >
                      {testingDept === value ? 'Sending…' : 'Send test reminder now'}
                    </button>
                    <p className="text-xs text-gray-500">
                      Uses the same rules as CRON: only sends if reminders are enabled, today&apos;s
                      attendance is missing, and there are recipients.
                    </p>
                  </div>
                  {testStatusByDept[value] && (
                    <p className="text-xs text-gray-600">{testStatusByDept[value]}</p>
                  )}
                </div>
              </div>
            ))}
          </section>

          <p className="mt-6 text-sm text-gray-500">
            ENV: {process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'TEST'}
          </p>
        </>
      )}
    </div>
  );
}
