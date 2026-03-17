/* eslint-disable no-console */

/**
 * Safe office employees sync from BioTime.
 *
 * Updates only BioTime-sourced columns (name, email, device_id). Never overwrites
 * department, personal_email, phone, salary, min_working_hours, max_working_hours,
 * or dynamic_link_token — so app edits in Admin → Office Employees are preserved.
 *
 * Requirements: Node.js 18+, network to BioTime, Supabase service role key.
 *
 * Usage:
 *   node scripts/office-biotime-sync-employees.js
 *
 * Env:
 *   SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   BIOTIME_BASE_URL
 *   BIOTIME_EMPLOYEE_LIST_PATH   (e.g. /att/api/person/ — path to employee list API)
 *   BIOTIME_AUTH_HEADER          (optional)
 *   BIOTIME_JSON_ROOT            (optional; "array" | "data" | "results")
 *
 * BioTime response: array of objects with at least employee_code (or code/emp_code),
 * name, email. Optional: device_id. Field names are normalized (see normalizePerson).
 *
 * See: docs/OFFICE_EMPLOYEES_SYNC_RULES.md
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

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

function normalizeBaseUrl(url) {
  return String(url).replace(/\/+$/, '');
}

function normalizePerson(row) {
  const code = row?.employee_code ?? row?.emp_code ?? row?.code ?? row?.pin ?? '';
  const name = row?.name ?? row?.emp_name ?? row?.full_name ?? '';
  const email = row?.email ?? row?.email_address ?? '';
  const deviceId = row?.device_id ?? row?.device ?? null;
  return {
    employee_code: String(code).trim(),
    name: String(name).trim(),
    email: String(email).trim(),
    device_id: deviceId != null ? String(deviceId).trim() : null,
  };
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

function extractPersonList(json) {
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
  const listPath = (process.env.BIOTIME_EMPLOYEE_LIST_PATH || '').trim();
  if (!listPath) {
    throw new Error('BIOTIME_EMPLOYEE_LIST_PATH is required (e.g. /att/api/person/)');
  }

  const listUrl = `${normalizeBaseUrl(biotimeBase)}${listPath.startsWith('/') ? '' : '/'}${listPath}`;
  const authHeader = (process.env.BIOTIME_AUTH_HEADER || '').trim();
  const headers = { Accept: 'application/json' };
  if (authHeader) headers.Authorization = authHeader;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('[office-biotime-sync-employees] Fetching', listUrl);
  const json = await fetchJsonWithTimeout(
    listUrl,
    { method: 'GET', headers, cache: 'no-store' },
    20000
  );

  const rawList = extractPersonList(json);
  const people = rawList.map(normalizePerson).filter((p) => p.employee_code && p.name && p.email);
  console.log(`[office-biotime-sync-employees] BioTime list=${rawList.length} valid=${people.length}`);

  const { data: existingRows, error: selectErr } = await supabase
    .from('office_employees')
    .select('id, employee_code');

  if (selectErr) throw new Error(`Failed loading office_employees: ${selectErr.message}`);

  const byCode = new Map();
  (existingRows || []).forEach((r) => {
    if (r?.employee_code) byCode.set(String(r.employee_code), { id: r.id });
  });

  let updated = 0;
  let inserted = 0;

  for (const p of people) {
    const existing = byCode.get(p.employee_code);
    if (existing) {
      const { error: updErr } = await supabase
        .from('office_employees')
        .update({
          name: p.name,
          email: p.email,
          ...(p.device_id != null && p.device_id !== '' && { device_id: p.device_id }),
        })
        .eq('id', existing.id);

      if (updErr) throw new Error(`Failed updating office_employees (${p.employee_code}): ${updErr.message}`);
      updated++;
    } else {
      const dynamicLinkToken = crypto.randomUUID();
      const { error: insErr } = await supabase.from('office_employees').insert({
        employee_code: p.employee_code,
        name: p.name,
        email: p.email,
        device_id: p.device_id || null,
        department: 'Office',
        dynamic_link_token: dynamicLinkToken,
      });

      if (insErr) throw new Error(`Failed inserting office_employees (${p.employee_code}): ${insErr.message}`);
      inserted++;
    }
  }

  const invalid = rawList.length - people.length;
  console.log(`[office-biotime-sync-employees] updated=${updated} inserted=${inserted} invalid_skipped=${invalid}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[office-biotime-sync-employees] ERROR:', err?.message || err);
    process.exit(1);
  });
