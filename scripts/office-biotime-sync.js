/* eslint-disable no-console */

/**
 * Office BioTime sync (run on a machine that can reach BioTime locally).
 *
 * Requirements:
 * - Node.js 18+ (for global fetch)
 * - Network access to BioTime server
 * - Supabase service role key (writes to office_* tables)
 *
 * Usage:
 *   node scripts/office-biotime-sync.js
 *
 * Env:
 *   SUPABASE_URL                       (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   BIOTIME_BASE_URL                   (e.g. http://192.168.1.50:80)
 *   BIOTIME_TRANSACTION_PATH           (optional; default /att/api/transactionReport/)
 *   BIOTIME_AUTH_HEADER                (optional; e.g. "Bearer xxx" or "Basic base64")
 *   BIOTIME_JSON_ROOT                  (optional; "array" | "data" | "results"; default auto-detect)
 */

const { createClient } = require('@supabase/supabase-js');

function mustGetEnv(key) {
  const v = process.env[key];
  if (!v) throw new Error(`${key} is required`);
  return v;
}

function getEnvAny(keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v) return v;
  }
  return null;
}

function parseIsoDate(isoLike) {
  const s = String(isoLike || '').trim();
  if (s.length < 10) return null;
  const datePart = s.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  return datePart;
}

function normalizeBaseUrl(url) {
  return String(url).replace(/\/+$/, '');
}

async function fetchJsonWithTimeout(url, opts, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    const contentType = res.headers.get('content-type') || '';
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`BioTime HTTP ${res.status}: ${text.slice(0, 500)}`);
    }
    if (!contentType.toLowerCase().includes('application/json')) {
      const text = await res.text().catch(() => '');
      throw new Error(`BioTime response not JSON. content-type=${contentType} body=${text.slice(0, 200)}`);
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function extractTransactions(json) {
  const rootPref = (process.env.BIOTIME_JSON_ROOT || '').trim().toLowerCase();
  if (rootPref === 'array' && Array.isArray(json)) return json;
  if (rootPref === 'data' && Array.isArray(json?.data)) return json.data;
  if (rootPref === 'results' && Array.isArray(json?.results)) return json.results;

  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.results)) return json.results;
  return [];
}

async function main() {
  const supabaseUrl = getEnvAny(['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL']);
  const supabaseKey = mustGetEnv('SUPABASE_SERVICE_ROLE_KEY');
  const biotimeBase = mustGetEnv('BIOTIME_BASE_URL');
  const txPath = (process.env.BIOTIME_TRANSACTION_PATH || '/att/api/transactionReport/').trim();

  const biotimeUrl = `${normalizeBaseUrl(biotimeBase)}${txPath.startsWith('/') ? '' : '/'}${txPath}`;

  const authHeader = (process.env.BIOTIME_AUTH_HEADER || '').trim();
  const headers = { Accept: 'application/json' };
  if (authHeader) headers.Authorization = authHeader;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`[office-biotime-sync] Fetching ${biotimeUrl}`);
  const json = await fetchJsonWithTimeout(
    biotimeUrl,
    { method: 'GET', headers, cache: 'no-store' },
    20000
  );

  const txs = extractTransactions(json);
  console.log(`[office-biotime-sync] fetched=${txs.length}`);
  if (txs.length === 0) {
    console.log('[office-biotime-sync] done (no transactions)');
    return;
  }

  const { data: empRows, error: empErr } = await supabase
    .from('office_employees')
    .select('id, employee_code');

  if (empErr) throw new Error(`Failed loading office_employees: ${empErr.message}`);

  function normalizeCode(code) {
    return String(code || '').trim().replace(/\s+/g, '');
  }

  const employeeIdByCode = new Map();
  (empRows || []).forEach((r) => {
    if (!r?.employee_code) return;
    const raw = String(r.employee_code).trim();
    const id = String(r.id);
    employeeIdByCode.set(raw, id);
    const norm = normalizeCode(raw);
    if (norm !== raw) employeeIdByCode.set(norm, id);
  });

  let inserted = 0;
  let skipped = 0;
  let unknownEmployees = 0;
  let unknownCodes = [];
  let duplicates = 0;

  // Track which (employeeId, date) pairs received new punches so we can reconcile them.
  const affectedDates = new Set(); // values: "YYYY-MM-DD"

  for (const tx of txs) {
    const rawCode = String(tx?.employee_code ?? tx?.emp_code ?? tx?.code ?? tx?.pin ?? '').trim();
    const employeeCode = rawCode || normalizeCode(tx?.employee_code ?? tx?.emp_code ?? tx?.code ?? tx?.pin);
    const punchTime = String(tx?.punch_time ?? '').trim();
    const punchState = tx?.punch_state;

    if (!employeeCode || !punchTime || (punchState !== 0 && punchState !== 1)) {
      skipped++;
      continue;
    }

    let employeeId = employeeIdByCode.get(employeeCode);
    if (!employeeId) employeeId = employeeIdByCode.get(normalizeCode(employeeCode));
    if (!employeeId) {
      unknownEmployees++;
      if (unknownCodes.length < 15 && !unknownCodes.includes(employeeCode)) unknownCodes.push(employeeCode);
      continue;
    }

    const date = parseIsoDate(punchTime);
    if (!date) {
      skipped++;
      continue;
    }

    const action = punchState === 0 ? 'checkin' : 'checkout';

    // Only insert into logs — office_attendance is updated by the reconcile call below.
    // This avoids out-of-order punch issues when the device labels don't match arrival order.
    const { error: logErr } = await supabase.from('office_attendance_logs').insert({
      employee_id: employeeId,
      action,
      method: 'biometric',
      timestamp: punchTime,
    });

    if (logErr) {
      const msg = String(logErr.message || '').toLowerCase();
      const code = logErr.code;
      if (code === '23505' || msg.includes('duplicate key')) {
        duplicates++;
        continue;
      }
      throw new Error(`Failed inserting office_attendance_logs: ${logErr.message}`);
    }

    affectedDates.add(date);
    inserted++;
  }

  // Reconcile each affected date: reads ALL logs for the day and resolves
  // check_in (first punch) and check_out (last punch) correctly, regardless
  // of device punch_state labels or the order punches arrived in the API.
  let reconciled = 0;
  for (const date of affectedDates) {
    const { error: rpcErr } = await supabase.rpc('office_reconcile_office_day', { p_date: date });
    if (rpcErr) {
      console.error(`[office-biotime-sync] reconcile failed for ${date}:`, rpcErr.message);
    } else {
      reconciled++;
    }
  }

  console.log(
    `[office-biotime-sync] inserted=${inserted} skipped=${skipped} duplicates=${duplicates} unknownEmployees=${unknownEmployees} reconciled=${reconciled}/${affectedDates.size} dates`
  );
  if (unknownCodes.length > 0) {
    console.log('[office-biotime-sync] unknown employee_code values from BioTime (check if they exist in office_employees):', unknownCodes.join(', '));
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[office-biotime-sync] ERROR:', err?.message || err);
    process.exit(1);
  });

