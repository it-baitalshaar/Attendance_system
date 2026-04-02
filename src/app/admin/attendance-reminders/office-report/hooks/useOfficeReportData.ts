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

function uaeTodayIsoDate(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});

  const y = Number(parts.year ?? '1970');
  const m = Number(parts.month ?? '1');
  const d = Number(parts.day ?? '1');
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toISOString().slice(0, 10);
}

function uaeYesterdayIsoDate(): string {
  const today = new Date(uaeTodayIsoDate());
  today.setUTCDate(today.getUTCDate() - 1);
  return today.toISOString().slice(0, 10);
}

function uaeThisMonthIso(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    }, {});
  const y = Number(parts.year ?? '1970');
  const m = String(Number(parts.month ?? '1')).padStart(2, '0');
  return `${y}-${m}`;
}

export function useOfficeReportData() {
  const [settings, setSettings] = useState<OfficeReportSetting[]>([]);
  const [emailsByDept, setEmailsByDept] = useState<Record<OfficeReportDepartmentKey, OfficeReportEmailRow[]>>({
    'Bait Alshaar': [],
    'Al Saqia': [],
  });
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState<Record<OfficeReportDepartmentKey, string>>({
    'Bait Alshaar': '',
    'Al Saqia': '',
  });
  const [errorByDept, setErrorByDept] = useState<Record<OfficeReportDepartmentKey, string>>({
    'Bait Alshaar': '',
    'Al Saqia': '',
  });
  const [toggling, setToggling] = useState<OfficeReportDepartmentKey | null>(null);
  const [testingDept, setTestingDept] = useState<OfficeReportDepartmentKey | null>(null);
  const [testStatusByDept, setTestStatusByDept] = useState<Record<OfficeReportDepartmentKey, string>>({
    'Bait Alshaar': '',
    'Al Saqia': '',
  });
  const [timeByDept, setTimeByDept] = useState<Record<OfficeReportDepartmentKey, string>>({
    'Bait Alshaar': '10:00',
    'Al Saqia': '10:00',
  });
  const [dateByDept, setDateByDept] = useState<Record<OfficeReportDepartmentKey, string>>({
    'Bait Alshaar': uaeYesterdayIsoDate(),
    'Al Saqia': uaeYesterdayIsoDate(),
  });
  const [monthByDept, setMonthByDept] = useState<Record<OfficeReportDepartmentKey, string>>({
    'Bait Alshaar': uaeThisMonthIso(),
    'Al Saqia': uaeThisMonthIso(),
  });

  const refreshSettings = useCallback(async () => {
    const rows = await loadOfficeReportSettings();
    setSettings(rows);
    const nextTimes: Record<OfficeReportDepartmentKey, string> = {
      'Bait Alshaar': '10:00',
      'Al Saqia': '10:00',
    };
    rows.forEach((row) => {
      const [h = '00', m = '00'] = row.report_time.split(':');
      const key = row.department as OfficeReportDepartmentKey;
      if (key === 'Bait Alshaar' || key === 'Al Saqia') {
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

  const handleTestSend = async (
    department: OfficeReportDepartmentKey,
    reportType: 'daily' | 'monthEnd' = 'daily'
  ) => {
    setTestingDept(department);
    setTestStatusByDept((prev) => ({
      ...prev,
      [department]: reportType === 'monthEnd' ? 'Sending month-end report…' : 'Sending test report…',
    }));
    const result = await sendTestOfficeReport(department, reportType, {
      reportDate: reportType === 'daily' ? dateByDept[department] : undefined,
      reportMonth: reportType === 'monthEnd' ? monthByDept[department] : undefined,
    });
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
    if (sent && sent > 0) {
      msg =
        reportType === 'monthEnd'
          ? `Month-end report sent to ${sent} recipient(s).`
          : `Sent to ${sent} recipient(s).`;
    }
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

  const handleDateChange = (department: OfficeReportDepartmentKey, value: string) => {
    setDateByDept((prev) => ({ ...prev, [department]: value }));
  };

  const handleMonthChange = (department: OfficeReportDepartmentKey, value: string) => {
    setMonthByDept((prev) => ({ ...prev, [department]: value }));
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
    dateByDept,
    monthByDept,
    handleToggle,
    handleAddEmail,
    handleDeleteEmail,
    handleTestSend,
    handleTimeChange,
    handleDateChange,
    handleMonthChange,
  };
}
