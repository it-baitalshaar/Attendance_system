export interface PayrollReportEmailRow {
  id: string;
  email: string;
  created_at?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function loadPayrollReportDelivery(): Promise<{
  emails: PayrollReportEmailRow[];
  whatsappNumber: string;
}> {
  const res = await fetch('/api/payroll-report/delivery');
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? 'Failed to load delivery settings');
  }
  return {
    emails: data.emails ?? [],
    whatsappNumber: data.whatsappNumber ?? '+971527249586',
  };
}

export async function addPayrollReportEmail(email: string): Promise<{ error?: string }> {
  const res = await fetch('/api/payroll-report/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error ?? 'Failed to add email' };
  return {};
}

export async function deletePayrollReportEmail(id: string): Promise<{ error?: string }> {
  const res = await fetch(`/api/payroll-report/emails?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error ?? 'Failed to delete email' };
  return {};
}

export async function savePayrollReportWhatsApp(
  whatsappNumber: string
): Promise<{ error?: string }> {
  const res = await fetch('/api/payroll-report/delivery', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ whatsappNumber: whatsappNumber.trim() }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error ?? 'Failed to save WhatsApp number' };
  return {};
}

export async function sendPayrollReportEmail(body: {
  reportType: 'salary' | 'attendance';
  from: string;
  to: string;
  department?: string | null;
  employeeId?: string | null;
  viewMode?: 'employee' | 'project';
  filterLabel?: string;
  /** PDF from Print area (same layout as Print / Save as PDF) */
  pdfBase64?: string;
  pdfFilename?: string;
}): Promise<{ ok: boolean; sent?: number; error?: string }> {
  const res = await fetch('/api/payroll-report/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error ?? data.details ?? 'Send failed' };
  return { ok: true, sent: data.sent };
}

export async function sendSalaryReportEmail(body: {
  from: string;
  to: string;
  department?: string | null;
  employeeId?: string | null;
  viewMode?: 'employee' | 'project';
  filterLabel?: string;
}): Promise<{ ok: boolean; sent?: number; error?: string }> {
  return sendPayrollReportEmail({ reportType: 'salary', ...body });
}

export async function fetchReportPdfBlob(body: {
  reportType: 'salary' | 'attendance';
  from: string;
  to: string;
  department?: string | null;
  employeeId?: string | null;
  viewMode?: 'employee' | 'project';
  filterLabel?: string;
}): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch('/api/payroll-report/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? 'Failed to generate PDF');
  }
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? `report_${body.from}_${body.to}.pdf`;
  const blob = await res.blob();
  return { blob, filename };
}

export { EMAIL_REGEX };
