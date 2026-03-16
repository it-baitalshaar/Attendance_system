import nodemailer from 'nodemailer';

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

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export async function sendMailGmail(options: SendMailOptions): Promise<{ ok: boolean; error?: string }> {
  const trans = getTransporter();
  if (!trans) {
    return { ok: false, error: 'Gmail not configured (GMAIL_USER / GMAIL_APP_PASSWORD)' };
  }
  const from = options.from ?? process.env.GMAIL_USER ?? 'Attendance';
  try {
    await trans.sendMail({
      from: typeof from === 'string' && from.includes('<') ? from : `${from} <${process.env.GMAIL_USER}>`,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
    });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}
