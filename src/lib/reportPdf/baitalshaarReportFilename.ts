/**
 * Default PDF / print Save-as names for Bait Al Shaar reports.
 * Example: Baitalshaar_construction_june_july_2026
 */

const MONTH_NAMES = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

/** Lowercase alphanumeric slug (spaces/punctuation removed). */
export function slugReportToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .replace(/^-+|-+$/g, '');
}

function parseIsoDate(iso: string): { y: number; m: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.slice(0, 10));
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) };
}

/**
 * Basename (no .pdf) for Save as PDF / attachments.
 * - One month: Baitalshaar_construction_july_2026
 * - Two months (payroll 26→25): Baitalshaar_construction_june_july_2026
 * - All departments: Baitalshaar_all_june_july_2026
 */
export function buildBaitalshaarReportBasename(input: {
  department?: string | null;
  from: string;
  to: string;
}): string {
  const from = parseIsoDate(input.from);
  const to = parseIsoDate(input.to);
  const deptRaw = (input.department ?? '').trim();
  const dept =
    !deptRaw || /^all(\s+departments)?$/i.test(deptRaw)
      ? 'all'
      : slugReportToken(deptRaw) || 'all';

  if (!from || !to) {
    return `Baitalshaar_${dept}_report`;
  }

  const fromMonth = MONTH_NAMES[from.m - 1];
  const toMonth = MONTH_NAMES[to.m - 1];
  const monthPart =
    from.y === to.y && from.m === to.m
      ? fromMonth
      : `${fromMonth}_${toMonth}`;
  const yearPart = from.y === to.y ? String(from.y) : `${from.y}_${to.y}`;

  return `Baitalshaar_${dept}_${monthPart}_${yearPart}`;
}

export function buildBaitalshaarReportPdfFilename(input: {
  department?: string | null;
  from: string;
  to: string;
}): string {
  return `${buildBaitalshaarReportBasename(input)}.pdf`;
}
