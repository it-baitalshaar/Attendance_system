/**
 * Payroll period helpers.
 * Default cycle: 26th of previous calendar month → 25th of selected payroll month.
 */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Inclusive day count between two YYYY-MM-DD dates. */
export function countInclusiveDays(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

/**
 * Payroll month YYYY-MM → period ending on the 25th of that month.
 * e.g. "2026-05" → 2026-04-26 … 2026-05-25
 */
export function getPayrollPeriodBounds(payrollYearMonth: string): {
  from: string;
  to: string;
} {
  const [y, m] = payrollYearMonth.split('-').map(Number);
  const to = `${y}-${pad(m)}-25`;
  const prevMonth = m === 1 ? 12 : m - 1;
  const prevYear = m === 1 ? y - 1 : y;
  const from = `${prevYear}-${pad(prevMonth)}-26`;
  return { from, to };
}

/** Payroll month (YYYY-MM) that contains today under the 26→25 cycle. */
export function getCurrentPayrollYearMonth(reference = new Date()): string {
  const y = reference.getFullYear();
  const m = reference.getMonth() + 1;
  const day = reference.getDate();

  if (day >= 26) {
    if (m === 12) return `${y + 1}-01`;
    return `${y}-${pad(m + 1)}`;
  }
  return `${y}-${pad(m)}`;
}

export function formatPeriodLabel(from: string, to: string): string {
  if (!from || !to) return '';
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const fromStr = new Date(fy, fm - 1, fd).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const toStr = new Date(ty, tm - 1, td).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${fromStr} – ${toStr}`;
}

export function payrollMonthLabel(payrollYearMonth: string): string {
  const [y, m] = payrollYearMonth.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}
