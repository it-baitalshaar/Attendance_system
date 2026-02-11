'use client';

import { useState, useCallback, useEffect } from 'react';
import type { DepartmentKey } from '../types';
import { EMAIL_REGEX } from '../constants';
import {
  loadSettings,
  loadEmails,
  toggleReminder,
  addReminderEmail,
  deleteReminderEmail,
  updateReminderTime,
  sendTestReminder,
} from '../services/remindersService';
import type { ReminderSetting, ReminderEmailRow } from '../types';

export function useRemindersData() {
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

  const refreshSettings = useCallback(async () => {
    const rows = await loadSettings();
    setSettings(rows);
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

  const refreshEmails = useCallback(async () => {
    const byDept = await loadEmails();
    setEmailsByDept(byDept);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([refreshSettings(), refreshEmails()]).finally(() => setLoading(false));
  }, [refreshSettings, refreshEmails]);

  const handleToggle = async (department: DepartmentKey) => {
    const row = settings.find((s) => s.department === department);
    if (!row) return;
    setToggling(department);
    const { error } = await toggleReminder(row.id, !row.enabled);
    setToggling(null);
    if (error) {
      console.error('Toggle error', error);
      return;
    }
    await refreshSettings();
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
    const { error } = await addReminderEmail(department, email);
    if (error) {
      setErrorByDept((prev) => ({ ...prev, [department]: (error as Error).message }));
      return;
    }
    setNewEmail((prev) => ({ ...prev, [department]: '' }));
    await refreshEmails();
  };

  const handleDeleteEmail = async (id: string) => {
    const { error } = await deleteReminderEmail(id);
    if (error) console.error('Delete error', error);
    else await refreshEmails();
  };

  const handleTestSend = async (department: DepartmentKey) => {
    setTestingDept(department);
    setTestStatusByDept((prev) => ({ ...prev, [department]: 'Sending test…' }));
    const result = await sendTestReminder(department);
    setTestingDept(null);
    if (result.error) {
      const err = result.error as { message?: string; context?: { body?: string } };
      let msg = `Error: ${err?.message ?? 'Unknown'}`;
      if (err?.context?.body) msg = `Error from function: ${err.context.body}`;
      setTestStatusByDept((prev) => ({ ...prev, [department]: msg }));
      return;
    }
    const sent = result.sent;
    const reason = result.reason;
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
    const { error } = await updateReminderTime(row.id, timeSql);
    if (error) console.error('Update reminder_time error', error);
    else await refreshSettings();
  };

  return {
    settings,
    emailsByDept,
    loading,
    newEmail,
    setNewEmail,
    errorByDept,
    setErrorByDept,
    toggling,
    testingDept,
    testStatusByDept,
    timeByDept,
    handleToggle,
    handleAddEmail,
    handleDeleteEmail,
    handleTestSend,
    handleTimeChange,
  };
}
