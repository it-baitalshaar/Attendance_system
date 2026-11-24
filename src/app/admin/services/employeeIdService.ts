import { createSupabbaseFrontendClient } from '@/lib/supabase';

/**
 * Employee ID series.
 *
 * - SA → Saqiya (`SAQIYA` department)
 * - BS → Bait Alshaar: Construction + Maintenance + all BioTime office employees
 *
 * The next number is computed from BOTH `Employee.employee_id` and
 * `office_employees.employee_code` so a new field employee never collides with
 * an ID that already exists in BioTime.
 */
export type EmployeeIdPrefix = 'SA' | 'BS';

/** Suffixes accepted per series (tolerates older/alternate spellings). */
const SERIES_PREFIXES: Record<EmployeeIdPrefix, string[]> = {
  SA: ['SA'],
  BS: ['BS', 'BA'],
};

const ID_PATTERN = /^([A-Za-z]+)\s*[-_ ]?0*(\d+)$/;
const PAD_LENGTH = 4;

export function isSaqiyaDepartment(department: string | null | undefined): boolean {
  return (department ?? '').trim().toLowerCase() === 'saqiya';
}

export function prefixForDepartment(
  department: string | null | undefined
): EmployeeIdPrefix {
  return isSaqiyaDepartment(department) ? 'SA' : 'BS';
}

export function formatEmployeeId(
  prefix: EmployeeIdPrefix,
  serial: number
): string {
  return `${prefix}${String(Math.max(serial, 1)).padStart(PAD_LENGTH, '0')}`;
}

/** Extracts the serial number from an ID belonging to the given series. */
export function parseEmployeeIdSerial(
  value: string | null | undefined,
  prefix: EmployeeIdPrefix
): number | null {
  const match = (value ?? '').trim().match(ID_PATTERN);
  if (!match) return null;
  if (!SERIES_PREFIXES[prefix].includes(match[1].toUpperCase())) return null;
  const serial = Number(match[2]);
  return Number.isFinite(serial) ? serial : null;
}

export interface EmployeeIdPools {
  /** Every existing ID (Employee + office_employees), for duplicate checks. */
  existingIds: string[];
  /** Next free ID per series, e.g. { SA: 'SA0047', BS: 'BS0055' }. */
  nextIds: Record<EmployeeIdPrefix, string>;
}

let poolsPromise: Promise<EmployeeIdPools> | null = null;

/** Call after adding/renaming an employee so the next suggestion refreshes. */
export function invalidateEmployeeIdPools(): void {
  poolsPromise = null;
}

async function selectIds(
  table: 'Employee' | 'office_employees',
  column: 'employee_id' | 'employee_code'
): Promise<string[]> {
  try {
    const supabase = createSupabbaseFrontendClient();
    const { data, error } = await supabase.from(table).select(column);
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[])
      .map((row) => row[column])
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '');
  } catch (error) {
    // office_employees may be blocked by RLS for some admin accounts — the
    // Employee table alone still gives a usable next number.
    console.warn(`Could not read ${table}.${column} for ID suggestions:`, error);
    return [];
  }
}

async function computePools(): Promise<EmployeeIdPools> {
  const [fieldIds, officeIds] = await Promise.all([
    selectIds('Employee', 'employee_id'),
    selectIds('office_employees', 'employee_code'),
  ]);

  const existingIds = [...fieldIds, ...officeIds];

  const maxBySuffix: Record<EmployeeIdPrefix, number> = { SA: 0, BS: 0 };
  for (const id of existingIds) {
    for (const prefix of Object.keys(maxBySuffix) as EmployeeIdPrefix[]) {
      const serial = parseEmployeeIdSerial(id, prefix);
      if (serial !== null && serial > maxBySuffix[prefix]) {
        maxBySuffix[prefix] = serial;
      }
    }
  }

  return {
    existingIds,
    nextIds: {
      SA: formatEmployeeId('SA', maxBySuffix.SA + 1),
      BS: formatEmployeeId('BS', maxBySuffix.BS + 1),
    },
  };
}

export function fetchEmployeeIdPools(): Promise<EmployeeIdPools> {
  if (!poolsPromise) {
    poolsPromise = computePools().catch((error) => {
      poolsPromise = null;
      throw error;
    });
  }
  return poolsPromise;
}

/** Convenience: next ID for the given department (Construction/Maintenance → BS). */
export async function fetchNextEmployeeId(
  department: string | null | undefined
): Promise<string> {
  const { nextIds } = await fetchEmployeeIdPools();
  return nextIds[prefixForDepartment(department)];
}
