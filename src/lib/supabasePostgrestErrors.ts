/** Postgres undefined_column */
const PG_UNDEFINED_COLUMN = '42703';

export function isUndefinedColumnError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  if (e.code === PG_UNDEFINED_COLUMN) return true;
  const m = String(e.message ?? '').toLowerCase();
  return (
    m.includes('column') &&
    (m.includes('does not exist') || m.includes('not exist') || m.includes('undefined'))
  );
}
