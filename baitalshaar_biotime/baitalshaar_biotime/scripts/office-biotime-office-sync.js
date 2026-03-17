/* eslint-disable no-console */
/**
 * BioTime → Supabase Office Attendance Sync.
 * See docs/BIOTIME_SYNC_SPEC.md for the full spec.
 *
 * Fetches transactions from BioTime (endpoint configurable), maps employee_code
 * to office_employees.id, inserts into office_attendance_logs, then upserts
 * office_attendance (one row per employee per day). Does not set worked_hours
 * (DB trigger). Preserves method = 'manual'. On duplicate log, skips attendance
 * update for that punch.
 *
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BIOTIME_BASE_URL required.
 * Optional: BIOTIME_TRANSACTION_PATH (default /att/api/transactionReport/),
 *   BIOTIME_TRANSACTIONS_PATH (alias), BIOTIME_JSON_ROOT (array|data|results),
 *   BIOTIME_AUTH_HEADER, BIOTIME_USERNAME, BIOTIME_PASSWORD.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const {
  SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  BIOTIME_BASE_URL,
  BIOTIME_TRANSACTION_PATH,
  BIOTIME_TRANSACTIONS_PATH,
  BIOTIME_JSON_ROOT,
  BIOTIME_USERNAME,
  BIOTIME_PASSWORD,
  BIOTIME_AUTH_HEADER,
} = process.env;

const SUPABASE_URL_RESOLVED = SUPABASE_URL || NEXT_PUBLIC_SUPABASE_URL;

if (!SUPABASE_URL_RESOLVED || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase configuration (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}
if (!BIOTIME_BASE_URL) {
  console.error('Missing BIOTIME_BASE_URL');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL_RESOLVED, SUPABASE_SERVICE_ROLE_KEY);

function buildUrl(path) {
  return `${BIOTIME_BASE_URL.replace(/\/+$/, '')}${path}`;
}

async function fetchJSON(path, opts = {}) {
  const url = buildUrl(path);
  const headers = { 'Content-Type': 'application/json' };
  const auth = process.env.BIOTIME_AUTH_HEADER || BIOTIME_AUTH_HEADER;
  if (auth) headers.Authorization = auth;
  let res;
  try {
    res = await fetch(url, { headers, ...opts });
  } catch (err) {
    const cause = err?.cause?.message || err?.cause || err?.message || '';
    throw new Error(`BioTime unreachable (${url}): ${err.message}${cause ? ' — ' + cause : ''}`);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`BioTime request failed for ${url}: ${res.status} ${res.statusText}${text ? ' — ' + text.slice(0, 200) : ''}`);
  }
  return res.json();
}

async function authenticate() {
  if (!BIOTIME_USERNAME || !BIOTIME_PASSWORD) {
    throw new Error('BIOTIME_USERNAME and BIOTIME_PASSWORD required for authentication');
  }
  const body = JSON.stringify({ username: BIOTIME_USERNAME, password: BIOTIME_PASSWORD });
  try {
    console.log('Obtaining JWT from BioTime...');
    const jwt = await fetchJSON('/jwt-api-token-auth/', { method: 'POST', body });
    if (jwt?.token) {
      process.env.BIOTIME_AUTH_HEADER = `JWT ${jwt.token}`;
      return process.env.BIOTIME_AUTH_HEADER;
    }
  } catch (e) {
    console.warn('JWT auth failed, trying Token auth:', e?.message || e);
  }
  console.log('Obtaining API token from BioTime...');
  const authData = await fetchJSON('/api-token-auth/', { method: 'POST', body });
  const token = authData.token;
  if (!token) throw new Error('No token received from authentication');
  process.env.BIOTIME_AUTH_HEADER = `Token ${token}`;
  return process.env.BIOTIME_AUTH_HEADER;
}

// Spec: default /att/api/transactionReport/; allow override (e.g. /iclock/api/transactions/)
const TRANSACTION_PATH = BIOTIME_TRANSACTION_PATH || BIOTIME_TRANSACTIONS_PATH || '/att/api/transactionReport/';

function getTransactionArray(resp) {
  const root = BIOTIME_JSON_ROOT;
  if (root === 'data') return Array.isArray(resp?.data) ? resp.data : [];
  if (root === 'results') return Array.isArray(resp?.results) ? resp.results : [];
  if (root === 'array') return Array.isArray(resp) ? resp : [];
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp?.data)) return resp.data;
  if (Array.isArray(resp?.results)) return resp.results;
  return [];
}

async function getLastSyncedTimestamp() {
  const { data, error } = await supabase
    .from('office_attendance_logs')
    .select('timestamp')
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data?.timestamp) return null;
  return data.timestamp;
}

async function pullTransactions(opts = {}) {
  const { start_time, end_time, forceFull } = opts;
  console.log('Fetching transactions from BioTime...');
  const perPage = 500;
  let all = [];
  let page = 1;
  const useSince = start_time || ((!forceFull && process.env.BIOTIME_FULL_SYNC !== '1') ? await getLastSyncedTimestamp() : null);
  if (useSince) console.log('Only fetching transactions since', useSince);
  for (;;) {
    let url = `${TRANSACTION_PATH}?page_size=${perPage}&page=${page}`;
    const since = start_time || useSince;
    if (since) url += `&start_time=${encodeURIComponent(since)}`;
    if (end_time) url += `&end_time=${encodeURIComponent(end_time)}`;
    const resp = await fetchJSON(url);
    const batch = getTransactionArray(resp);
    all = all.concat(batch);
    if (batch.length === 0 || !resp?.next) break;
    page++;
  }
  console.log(`retrieved ${all.length} transactions`);
  return all;
}

function normalizeTransaction(tx) {
  const codeRaw = tx.employee_code ?? tx.emp_code ?? tx.EmployeeCode;
  const code = codeRaw != null ? String(codeRaw).trim() : null;
  const time = tx.punch_time ?? tx.punchTime ?? tx.datetime;
  const raw = tx.punch_state != null ? tx.punch_state : tx.punchState;
  const state = raw === 0 || raw === '0' ? 0 : raw === 1 || raw === '1' ? 1 : null;
  return { employee_code: code, punch_time: time, punch_state: state };
}

/**
 * Parse punch_time into date (YYYY-MM-DD) and ISO timestamp.
 * Handles: ISO (2026-03-11T08:05:00), date-only (2026-03-11), DD/MM/YYYY and DD-MM-YYYY with time.
 */
function parsePunchTime(punchTime) {
  if (!punchTime) return { date: null, iso: null };
  const s = typeof punchTime === 'string' ? punchTime.trim() : String(punchTime);
  // Already YYYY-MM-DD (ISO or "YYYY-MM-DD HH:mm")
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const date = s.slice(0, 10);
    try {
      const d = new Date(punchTime);
      const iso = Number.isNaN(d.getTime()) ? null : d.toISOString();
      return { date, iso: iso || `${date}T12:00:00.000Z` };
    } catch {
      return { date, iso: `${date}T12:00:00.000Z` };
    }
  }
  // DD/MM/YYYY or DD-MM-YYYY with optional time (e.g. "11/03/2026 08:05" or "09-03-2026")
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmy) {
    const [, d, m, y, h, min, sec] = dmy;
    const day = d.padStart(2, '0');
    const month = m.padStart(2, '0');
    const date = `${y}-${month}-${day}`;
    const hour = (h || '12').padStart(2, '0');
    const minute = (min || '00').padStart(2, '0');
    const second = (sec || '00').padStart(2, '0');
    // Build ISO in local-style then let Date interpret (assume device TZ ≈ server for date)
    const iso = new Date(`${date}T${hour}:${minute}:${second}`).toISOString();
    return { date, iso };
  }
  // Fallback: Date parse; use local date for correct calendar day
  try {
    const d = new Date(punchTime);
    if (Number.isNaN(d.getTime())) return { date: null, iso: null };
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const date = `${y}-${m}-${day}`;
    return { date, iso: d.toISOString() };
  } catch {
    return { date: null, iso: null };
  }
}

function parseDate(punchTime) {
  const { date } = parsePunchTime(punchTime);
  return date;
}

async function run() {
  try {
    if (BIOTIME_USERNAME && BIOTIME_PASSWORD) await authenticate();

    // Build employee_code → id map (trim for spec "trim, string compare")
    const { data: emps, error: empErr } = await supabase.from('office_employees').select('id, employee_code');
    if (empErr) throw empErr;
    const employeeCodeToId = new Map();
    for (const e of emps || []) {
      const code = e.employee_code != null ? String(e.employee_code).trim() : null;
      if (code) employeeCodeToId.set(code, e.id);
    }

    const txs = await pullTransactions({ forceFull: process.env.BIOTIME_FULL_SYNC === '1' });
    let unknown = 0;
    let invalid = 0;
    let success = 0;
    let duplicateLog = 0;
    const logInvalid = process.env.BIOTIME_DEBUG_INVALID === '1' || process.env.DEBUG?.includes('biotime');
    const invalidReasons = [];

    for (const tx of txs) {
      const { employee_code, punch_time, punch_state } = normalizeTransaction(tx);
      if (!employee_code || !punch_time || (punch_state !== 0 && punch_state !== 1)) {
        invalid++;
        if (logInvalid && invalidReasons.length < 5) {
          let reason = !employee_code ? 'missing employee_code' : !punch_time ? 'missing punch_time' : `punch_state=${JSON.stringify(punch_state)} (expected 0 or 1)`;
          invalidReasons.push({ reason, sample: { employee_code: tx.employee_code ?? tx.emp_code, punch_time: tx.punch_time ?? tx.punchTime, punch_state: tx.punch_state ?? tx.punchState } });
        }
        continue;
      }

      const employee_id = employeeCodeToId.get(employee_code);
      if (!employee_id) {
        unknown++;
        continue;
      }

      const parsed = parsePunchTime(punch_time);
      const date = parsed.date;
      const ts = parsed.iso || new Date(punch_time).toISOString();
      if (!date) {
        invalid++;
        if (logInvalid && invalidReasons.length < 5) {
          invalidReasons.push({ reason: 'unparseable punch_time (could not get YYYY-MM-DD)', sample: { punch_time } });
        }
        continue;
      }

      const action = punch_state === 0 ? 'checkin' : 'checkout';

      // 1) Insert log first (spec: insert-only; on duplicate skip attendance update)
      const logObj = { employee_id, action, method: 'biometric', timestamp: ts };
      const { error: logErr } = await supabase.from('office_attendance_logs').insert(logObj);
      if (logErr) {
        if (logErr.code === '23505') {
          duplicateLog++;
          continue;
        }
        console.error('log insert error', logErr);
        throw logErr;
      }

      // 2) Upsert office_attendance (earliest check_in, latest check_out; do not set worked_hours; preserve method = 'manual')
      const { data: existingArr, error: existErr } = await supabase
        .from('office_attendance')
        .select('check_in, check_out, method')
        .eq('employee_id', employee_id)
        .eq('date', date)
        .limit(1);
      if (existErr) throw existErr;

      let check_in = null;
      let check_out = null;
      let method = 'biometric';
      if (existingArr?.length) {
        const e = existingArr[0];
        if (e.check_in) check_in = e.check_in;
        if (e.check_out) check_out = e.check_out;
        if (e.method === 'manual') method = 'manual';
      }

      if (action === 'checkin') {
        if (!check_in || new Date(ts) < new Date(check_in)) check_in = ts;
      } else {
        if (!check_out || new Date(ts) > new Date(check_out)) check_out = ts;
      }

      if (check_in && check_out && new Date(check_out) < new Date(check_in)) check_out = check_in;

      let attendanceObj = { employee_id, date, check_in, check_out, method, device: 'BioTime' };
      let attErr = (await supabase.from('office_attendance').upsert(attendanceObj, { onConflict: ['employee_id', 'date'] })).error;
      if (attErr && String(attErr.message || '').includes('device')) {
        delete attendanceObj.device;
        attErr = (await supabase.from('office_attendance').upsert(attendanceObj, { onConflict: ['employee_id', 'date'] })).error;
      }
      if (attErr) {
        console.error('attendance upsert error', attErr);
        throw attErr;
      }
      success++;
    }

    console.log(`processed ${txs.length} transactions: ${success} synced, ${unknown} unknown, ${invalid} invalid, ${duplicateLog} duplicate log(s) skipped`);
    if (logInvalid && invalidReasons.length > 0) {
      console.warn('Invalid transaction samples (BIOTIME_DEBUG_INVALID=1):', JSON.stringify(invalidReasons, null, 2));
    }
    return { success: true, stats: { total: txs.length, success, unknown, invalid, duplicateLog } };
  } catch (err) {
    console.error('office sync failed', err);
    return { success: false, error: err };
  }
}

export { run, authenticate };

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  run().then(res => { if (!res.success) process.exit(1); });
}
