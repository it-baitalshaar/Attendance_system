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

  const employeeIdByCode = new Map();
  (empRows || []).forEach((r) => {
    if (r?.employee_code) employeeIdByCode.set(String(r.employee_code), String(r.id));
  });

  let processed = 0;
  let skipped = 0;
  let unknownEmployees = 0;
  let duplicates = 0;

  for (const tx of txs) {
    const employeeCode = String(tx?.employee_code ?? '').trim();
    const punchTime = String(tx?.punch_time ?? '').trim();
    const punchState = tx?.punch_state;

    if (!employeeCode || !punchTime || (punchState !== 0 && punchState !== 1)) {
      skipped++;
      continue;
    }

    const employeeId = employeeIdByCode.get(employeeCode);
    if (!employeeId) {
      unknownEmployees++;
      continue;
    }

    const date = parseIsoDate(punchTime);
    if (!date) {
      skipped++;
      continue;
    }

    const action = punchState === 0 ? 'checkin' : 'checkout';

    // Insert log first (dedupe-safe)
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

    // Read existing attendance row
    const { data: existing, error: existingErr } = await supabase
      .from('office_attendance')
      .select('id, check_in, check_out, method')
      .eq('employee_id', employeeId)
      .eq('date', date)
      .maybeSingle();

    if (existingErr) throw new Error(`Failed reading office_attendance: ${existingErr.message}`);

    const next = {
      employee_id: employeeId,
      date,
      device: 'BioTime',
    };

    const existingCheckIn = existing?.check_in ? new Date(existing.check_in).getTime() : null;
    const existingCheckOut = existing?.check_out ? new Date(existing.check_out).getTime() : null;
    const punchMs = new Date(punchTime).getTime();
    if (!Number.isFinite(punchMs)) {
      skipped++;
      continue;
    }

    if (action === 'checkin') {
      if (existingCheckIn == null || punchMs < existingCheckIn) next.check_in = punchTime;
    } else {
      if (existingCheckOut == null || punchMs > existingCheckOut) next.check_out = punchTime;
    }

    // Don't override manual edits
    if (existing?.method !== 'manual') next.method = 'biometric';

    if (existing?.id) {
      const { error: updErr } = await supabase.from('office_attendance').update(next).eq('id', existing.id);
      if (updErr) throw new Error(`Failed updating office_attendance: ${updErr.message}`);
    } else {
      const { error: insErr } = await supabase.from('office_attendance').insert(next);
      if (insErr) throw new Error(`Failed inserting office_attendance: ${insErr.message}`);
    }

    processed++;
  }

  console.log(
    `[office-biotime-sync] processed=${processed} skipped=${skipped} unknownEmployees=${unknownEmployees} duplicates=${duplicates}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[office-biotime-sync] ERROR:', err?.message || err);
    process.exit(1);
  });

