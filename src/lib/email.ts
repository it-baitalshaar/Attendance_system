/**
 * Email sender: same Gmail config as construction/maintenance attendance reminders.
 * Uses GMAIL_USER and GMAIL_APP_PASSWORD only (no Resend).
 */

import nodemailer from 'nodemailer';

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  attachments?: MailAttachment[];
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  return transporter;
}

function normalizeTo(to: string | string[]): string {
  return Array.isArray(to) ? to.join(', ') : to;
}

/**
 * Send email using the same Gmail config as construction/maintenance reminders.
 * Set GMAIL_USER and GMAIL_APP_PASSWORD in .env (same as for reminders).
 */
export async function sendMail(options: SendMailOptions): Promise<{ ok: boolean; error?: string }> {
  const trans = getTransporter();
  if (!trans) {
    return {
      ok: false,
      error: 'Gmail not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in .env (same as construction/maintenance reminders).',
    };
  }

  const from = options.from ?? process.env.GMAIL_USER ?? 'Attendance';
  const fromStr = typeof from === 'string' && from.includes('<') ? from : `Attendance <${process.env.GMAIL_USER}>`;

  try {
    await trans.sendMail({
      from: fromStr,
      to: normalizeTo(options.to),
      subject: options.subject,
      html: options.html,
      attachments: (options.attachments ?? []).map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType ?? 'application/pdf',
      })),
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
