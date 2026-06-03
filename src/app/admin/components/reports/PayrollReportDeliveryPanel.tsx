'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  loadPayrollReportDelivery,
  addPayrollReportEmail,
  deletePayrollReportEmail,
  savePayrollReportWhatsApp,
  sendPayrollReportEmail,
  fetchReportPdfBlob,
  EMAIL_REGEX,
  type PayrollReportEmailRow,
} from '../../services/payrollReportDeliveryService';
import { buildWhatsAppUrl } from '@/lib/payrollReportWhatsApp';
import {
  buildSalaryReportWhatsAppMessage,
} from '@/lib/salaryReportEmailHtml';
import {
  capturePrintAreaAsPdf,
  printAreaPdfFilename,
} from '@/lib/capturePrintAreaPdf';
import type { SalaryReconciliationSummary } from '../../types/projectCostReport';

interface PayrollReportDeliveryPanelProps {
  reportKind: 'salary' | 'attendance';
  hasReport: boolean;
  disabled?: boolean;
  /** Salary report send / WhatsApp */
  from?: string;
  to?: string;
  department?: string | null;
  employeeId?: string | null;
  viewMode?: 'employee' | 'project';
  filterLabel?: string;
  reconciliationSummary?: SalaryReconciliationSummary | null;
  /** Attendance WhatsApp */
  attendanceWhatsApp?: {
    employeeCount: number;
    grandTotalSalary: number;
  };
  onBuildAttendanceWhatsAppMessage?: () => string;
  /** DOM id of printable report (same as Print / Save as PDF) */
  printAreaId?: string;
}

export function PayrollReportDeliveryPanel({
  reportKind,
  hasReport,
  disabled,
  from = '',
  to = '',
  department = null,
  employeeId = null,
  viewMode = 'employee',
  filterLabel = 'All Departments',
  reconciliationSummary = null,
  attendanceWhatsApp,
  onBuildAttendanceWhatsAppMessage,
  printAreaId,
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

  const buildPrintPdf = async () => {
    if (!printAreaId) {
      throw new Error('Print area not configured.');
    }
    const filename = printAreaPdfFilename(reportKind, from, to);
    return capturePrintAreaAsPdf(printAreaId, filename, {
      landscape: reportKind === 'attendance',
    });
  };

  const handleSendEmail = async () => {
    if (!from || !to) return;
    setSendStatus('Generating PDF (same as Print)…');
    try {
      let pdfBase64: string | undefined;
      let pdfFilename: string | undefined;
      if (printAreaId) {
        const captured = await buildPrintPdf();
        pdfBase64 = captured.base64;
        pdfFilename = captured.filename;
      }
      setSendStatus('Sending email…');
      const result = await sendPayrollReportEmail({
        reportType: reportKind,
        from,
        to,
        department,
        employeeId,
        viewMode: reportKind === 'salary' ? viewMode : undefined,
        filterLabel,
        pdfBase64,
        pdfFilename,
      });
      setSendStatus(
        result.ok
          ? `Email sent with PDF attached to ${result.sent ?? emails.length} recipient(s).`
          : result.error ?? 'Failed to send.'
      );
    } catch (err) {
      setSendStatus(err instanceof Error ? err.message : 'Failed to generate or send PDF.');
    }
    setTimeout(() => setSendStatus(''), 6000);
  };

  const handleWhatsApp = async () => {
    if (!from || !to) return;
    setSendStatus('Generating PDF (same as Print)…');
    try {
      let message = '';
      if (reportKind === 'salary' && reconciliationSummary) {
        message = buildSalaryReportWhatsAppMessage({
          from,
          to,
          filterLabel,
          summary: reconciliationSummary,
        });
      } else if (reportKind === 'attendance' && onBuildAttendanceWhatsAppMessage) {
        message = onBuildAttendanceWhatsAppMessage();
      } else if (attendanceWhatsApp) {
        message = [
          'Attendance Report',
          `Period: ${from} – ${to}`,
          `Scope: ${filterLabel}`,
          `Employees: ${attendanceWhatsApp.employeeCount}`,
        ].join('\n');
      } else {
        setSendStatus('Generate the report first.');
        return;
      }

      const { blob, filename } = printAreaId
        ? await buildPrintPdf()
        : await fetchReportPdfBlob({
            reportType: reportKind,
            from,
            to,
            department,
            employeeId,
            viewMode: reportKind === 'salary' ? viewMode : undefined,
            filterLabel,
          });
      const file = new File([blob], filename, { type: 'application/pdf' });
      const shareText = `${message}\n\n(PDF attached)`;

      if (
        typeof navigator !== 'undefined' &&
        navigator.share &&
        (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }))
      ) {
        await navigator.share({
          title: filename,
          text: shareText,
          files: [file],
        });
        setSendStatus('Shared to WhatsApp (or another app) with PDF attached.');
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        window.open(
          buildWhatsAppUrl(
            whatsappNumber,
            `${message}\n\nPDF downloaded (${filename}). Attach it in WhatsApp before sending.`
          ),
          '_blank',
          'noopener,noreferrer'
        );
        setSendStatus('PDF downloaded. WhatsApp opened — attach the file from Downloads.');
      }
    } catch (err) {
      setSendStatus(err instanceof Error ? err.message : 'WhatsApp share failed.');
    }
    setTimeout(() => setSendStatus(''), 6000);
  };

  return (
    <div className="mt-6 p-4 rounded-lg border border-gray-200 bg-gray-50/80">
      <h3 className="text-sm font-semibold text-gray-800 mb-1">Send report (Email &amp; WhatsApp)</h3>
      <p className="text-xs text-gray-500 mb-4">
        Recipients are saved permanently for monthly sends. Email and WhatsApp use the{' '}
        <strong>same PDF as Print / Save as PDF</strong> (full on-screen report). Email uses Gmail (
        <code className="text-[11px]">GMAIL_USER</code>). WhatsApp shares the PDF on mobile when
        supported; on desktop it downloads the PDF and opens WhatsApp for you to attach it.
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
          onClick={handleSendEmail}
          disabled={!hasReport || disabled || emails.length === 0 || loadingSettings}
          className="px-4 py-2 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 font-medium"
        >
            Send email with PDF
          </button>
          <button
            type="button"
            onClick={handleWhatsApp}
            disabled={!hasReport || disabled || !whatsappNumber.trim()}
            className="px-4 py-2 text-sm rounded bg-[#25D366] text-white hover:opacity-90 disabled:opacity-40 font-medium"
          >
            Share PDF on WhatsApp
          </button>
      </div>
      {sendStatus && <p className="mt-2 text-sm text-gray-700">{sendStatus}</p>}
      {!hasReport && (
        <p className="mt-2 text-xs text-amber-700">Generate the report first, then send.</p>
      )}
    </div>
  );
}
