'use client';

import { useState, useCallback, useEffect } from 'react';
import type { OfficeReportDepartmentKey } from '../types';
import { EMAIL_REGEX } from '../constants';
import {
  loadOfficeReportSettings,
  loadOfficeReportEmails,
  toggleOfficeReport,
  addOfficeReportEmail,
  deleteOfficeReportEmail,
  updateOfficeReportTime,
  sendTestOfficeReport,
} from '../services/officeReportService';
import type { OfficeReportSetting, OfficeReportEmailRow } from '../types';

export function useOfficeReportData() {
  const [settings, setSettings] = useState<OfficeReportSetting[]>([]);
  const [emailsByDept, setEmailsByDept] = useState<Record<OfficeReportDepartmentKey, OfficeReportEmailRow[]>>({
    'Office Baitalshaar': [],
    'Alsaqia Showroom': [],
  });
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState<Record<OfficeReportDepartmentKey, string>>({
    'Office Baitalshaar': '',
    'Alsaqia Showroom': '',
  });
  const [errorByDept, setErrorByDept] = useState<Record<OfficeReportDepartmentKey, string>>({
    'Office Baitalshaar': '',
    'Alsaqia Showroom': '',
  });
  const [toggling, setToggling] = useState<OfficeReportDepartmentKey | null>(null);
  const [testingDept, setTestingDept] = useState<OfficeReportDepartmentKey | null>(null);
  const [testStatusByDept, setTestStatusByDept] = useState<Record<OfficeReportDepartmentKey, string>>({
    'Office Baitalshaar': '',
    'Alsaqia Showroom': '',
  });
  const [timeByDept, setTimeByDept] = useState<Record<OfficeReportDepartmentKey, string>>({
    'Office Baitalshaar': '10:00',
    'Alsaqia Showroom': '10:00',
  });

  const refreshSettings = useCallback(async () => {
    const rows = await loadOfficeReportSettings();
    setSettings(rows);
    const nextTimes: Record<OfficeReportDepartmentKey, string> = {
      'Office Baitalshaar': '10:00',
      'Alsaqia Showroom': '10:00',
    };
    rows.forEach((row) => {
      const [h = '00', m = '00'] = row.report_time.split(':');
      const key = row.department as OfficeReportDepartmentKey;
      if (key === 'Office Baitalshaar' || key === 'Alsaqia Showroom') {
        nextTimes[key] = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
      }
    });
    setTimeByDept(nextTimes);
  }, []);

  const refreshEmails = useCallback(async () => {
    const byDept = await loadOfficeReportEmails();
    setEmailsByDept(byDept);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([refreshSettings(), refreshEmails()]).finally(() => setLoading(false));
  }, [refreshSettings, refreshEmails]);

  const handleToggle = async (department: OfficeReportDepartmentKey) => {
    const row = settings.find((s) => s.department === department);
    if (!row) return;
    setToggling(department);
    const { error } = await toggleOfficeReport(row.id, !row.enabled);
    setToggling(null);
    if (error) {
      console.error('Toggle error', error);
      return;
    }
    await refreshSettings();
  };

  const handleAddEmail = async (department: OfficeReportDepartmentKey) => {
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
    const { error } = await addOfficeReportEmail(department, email);
    if (error) {
      setErrorByDept((prev) => ({ ...prev, [department]: (error as Error).message }));
      return;
    }
    setNewEmail((prev) => ({ ...prev, [department]: '' }));
    await refreshEmails();
  };

  const handleDeleteEmail = async (id: string) => {
    const { error } = await deleteOfficeReportEmail(id);
    if (error) console.error('Delete error', error);
    else await refreshEmails();
  };

  const handleTestSend = async (department: OfficeReportDepartmentKey) => {
    setTestingDept(department);
    setTestStatusByDept((prev) => ({ ...prev, [department]: 'Sending test report…' }));
    const result = await sendTestOfficeReport(department);
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
    else if (reason) msg = reason;
    else msg = 'Test report sent.';
    setTestStatusByDept((prev) => ({ ...prev, [department]: msg }));
  };

  const handleTimeChange = async (department: OfficeReportDepartmentKey, value: string) => {
    setTimeByDept((prev) => ({ ...prev, [department]: value }));
    const row = settings.find((s) => s.department === department);
    if (!row) return;
    const [h = '00', m = '00'] = value.split(':');
    const timeSql = `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`;
    const { error } = await updateOfficeReportTime(row.id, timeSql);
    if (error) console.error('Update report_time error', error);
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
