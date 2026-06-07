export function buildMailtoUrl(
  recipients: string[],
  subject: string,
  body: string
): string {
  const to = recipients.filter(Boolean).join(',');
  const params = new URLSearchParams();
  params.set('subject', subject);
  params.set('body', body);
  return `mailto:${to}?${params.toString()}`;
}

export function openMailtoCompose(recipients: string[], subject: string, body: string): void {
  if (recipients.length === 0) return;
  const url = buildMailtoUrl(recipients, subject, body);
  window.location.href = url;
}
