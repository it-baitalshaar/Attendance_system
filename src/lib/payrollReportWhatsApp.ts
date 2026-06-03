const DEFAULT_WHATSAPP = '+971527249586';

export function normalizeWhatsAppDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('971')) return digits;
  if (digits.startsWith('0')) return `971${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('5')) return `971${digits}`;
  return digits;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = normalizeWhatsAppDigits(phone || DEFAULT_WHATSAPP);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export { DEFAULT_WHATSAPP };
