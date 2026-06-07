'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  loadPayrollReportDelivery,
  addPayrollReportEmail,
  deletePayrollReportEmail,
  savePayrollReportWhatsApp,
  EMAIL_REGEX,
  type PayrollReportEmailRow,
} from '../../services/payrollReportDeliveryService';
import { buildWhatsAppUrl } from '@/lib/payrollReportWhatsApp';
import { openMailtoCompose } from '@/lib/payrollReportMailto';
import { buildSalaryReportWhatsAppMessage } from '@/lib/salaryReportEmailHtml';
import { formatPeriodLabel } from '@/lib/payrollPeriod';
import type { SalaryReconciliationSummary } from '../../types/projectCostReport';

interface PayrollReportDeliveryPanelProps {
  reportKind: 'salary' | 'attendance';
  hasReport: boolean;
  disabled?: boolean;
  from?: string;
  to?: string;
  department?: string | null;
  employeeId?: string | null;
  viewMode?: 'employee' | 'project';
  filterLabel?: string;
  reconciliationSummary?: SalaryReconciliationSummary | null;
  attendanceWhatsApp?: {
    employeeCount: number;
    grandTotalSalary: number;
  };
  onBuildAttendanceWhatsAppMessage?: () => string;
}

export function PayrollReportDeliveryPanel({
  reportKind,
  hasReport,
  disabled,
  from = '',
  to = '',
  filterLabel = 'All Departments',
  reconciliationSummary = null,
  onBuildAttendanceWhatsAppMessage,
}: PayrollReportDeliveryPanelProps) {
  const [emails, setEmails] = useState<PayrollReportEmailRow[]>([]);
  const [whatsappNumber, setWhatsappNumber] = useState('+971527249586');
  const [newEmail, setNewEmail] = useState('');
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [emailError, setEmailError] = useState('');
  const [saveWaStatus, setSaveWaStatus] = useState('');
  const [sendStatus, setSendStatus] = useState('');

  const refresh = useCallback(async () => {
    setLoadingSettings(true);
    try {
      const data = await loadPayrollReportDelivery();
      setEmails(data.emails);
      setWhatsappNumber(data.whatsappNumber);
    } catch {
      setEmails([]);
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAddEmail = async () => {
    const email = newEmail.trim().toLowerCase();
    if (!email) {
      setEmailError('Enter an email address.');
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setEmailError('Invalid email format.');
      return;
    }
    if (emails.some((e) => e.email === email)) {
      setEmailError('This email is already in the list.');
      return;
    }
    setEmailError('');
    const { error } = await addPayrollReportEmail(email);
    if (error) {
      setEmailError(error);
      return;
    }
    setNewEmail('');
    await refresh();
  };

  const handleDeleteEmail = async (id: string) => {
    await deletePayrollReportEmail(id);
    await refresh();
  };

  const handleSaveWhatsApp = async () => {
    setSaveWaStatus('Saving…');
    const { error } = await savePayrollReportWhatsApp(whatsappNumber);
    setSaveWaStatus(error ? error : 'Saved.');
    setTimeout(() => setSaveWaStatus(''), 2500);
  };

  const buildSummaryMessage = (): string | null => {
    if (reportKind === 'salary' && reconciliationSummary) {
      return buildSalaryReportWhatsAppMessage({ from, to, filterLabel, summary: reconciliationSummary });
    }
    if (reportKind === 'attendance' && onBuildAttendanceWhatsAppMessage) {
      return onBuildAttendanceWhatsAppMessage();
    }
    return null;
  };

  const handleOpenEmail = () => {
    if (!from || !to || emails.length === 0) return;
    const message = buildSummaryMessage();
    if (!message) {
      setSendStatus('Generate the report first.');
      return;
    }

    const periodLabel = formatPeriodLabel(from, to);
    const subject =
      reportKind === 'salary'
        ? `Salary & Project Cost Report — ${periodLabel}`
        : `Attendance Report — ${periodLabel}`;

    openMailtoCompose(
      emails.map((e) => e.email),
      subject,
      message
    );
    setSendStatus('Email app opened — attach the PDF you saved from Print / Save as PDF.');
    setTimeout(() => setSendStatus(''), 6000);
  };

  const handleOpenWhatsApp = () => {
    if (!from || !to || !whatsappNumber.trim()) return;
    const message = buildSummaryMessage();
    if (!message) {
      setSendStatus('Generate the report first.');
      return;
    }

    window.open(buildWhatsAppUrl(whatsappNumber, message), '_blank', 'noopener,noreferrer');
    setSendStatus('WhatsApp opened — attach the PDF you saved from Print / Save as PDF.');
    setTimeout(() => setSendStatus(''), 6000);
  };

  return (
    <div className="mt-6 p-4 rounded-lg border border-gray-200 bg-gray-50/80">
      <h3 className="text-sm font-semibold text-gray-800 mb-1">Send report (Email &amp; WhatsApp)</h3>
      <p className="text-xs text-gray-500 mb-4">
        <strong>1.</strong> Use <strong>Print / Save as PDF</strong> to save the report.{' '}
        <strong>2.</strong> Click Open email or Open WhatsApp below.{' '}
        <strong>3.</strong> Attach the PDF in your email or chat before sending. Recipient emails and
        the WhatsApp number are saved here for reuse each month.
      </p>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Saved recipient emails</label>
        {loadingSettings ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <ul className="space-y-1 mb-2">
            {emails.length === 0 ? (
              <li className="text-sm text-gray-500">No emails yet — add one below.</li>
            ) : (
              emails.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded bg-white border border-gray-100 text-sm"
                >
                  <span>{row.email}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteEmail(row.id)}
                    className="text-red-600 hover:underline text-xs"
                  >
                    Delete
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => {
              setNewEmail(e.target.value);
              setEmailError('');
            }}
            placeholder="finance@company.com"
            className="border rounded px-3 py-2 w-64 max-w-full text-sm"
          />
          <button
            type="button"
            onClick={handleAddEmail}
            className="bg-indigo-600 text-white px-3 py-2 rounded text-sm hover:bg-indigo-700"
          >
            + Add email
          </button>
        </div>
        {emailError && <p className="text-red-500 text-xs mt-1">{emailError}</p>}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">WhatsApp recipient</label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="tel"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            placeholder="+971527249586"
            className="border rounded px-3 py-2 w-48 max-w-full text-sm"
          />
          <button
            type="button"
            onClick={handleSaveWhatsApp}
            className="px-3 py-2 text-sm rounded border border-gray-300 bg-white hover:bg-gray-50"
          >
            Save number
          </button>
          {saveWaStatus && <span className="text-xs text-gray-600">{saveWaStatus}</span>}
        </div>
        <p className="text-xs text-gray-400 mt-1">Default: +971527249586. Edit and save to change.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleOpenEmail}
          disabled={!hasReport || disabled || emails.length === 0 || loadingSettings}
          className="px-4 py-2 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 font-medium"
        >
          Open email
        </button>
        <button
          type="button"
          onClick={handleOpenWhatsApp}
          disabled={!hasReport || disabled || !whatsappNumber.trim()}
          className="px-4 py-2 text-sm rounded bg-[#25D366] text-white hover:opacity-90 disabled:opacity-40 font-medium"
        >
          Open WhatsApp
        </button>
      </div>
      {sendStatus && <p className="mt-2 text-sm text-gray-700">{sendStatus}</p>}
      {!hasReport && (
        <p className="mt-2 text-xs text-amber-700">Generate the report first, then send.</p>
      )}
    </div>
  );
}
