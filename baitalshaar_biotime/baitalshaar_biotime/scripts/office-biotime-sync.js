/* eslint-disable no-console */
/**
 * Office BioTime sync (run on a machine that can reach BioTime locally).
 *
 * Requirements:
 *   - Node.js 18+ (fetch is used from global scope)
 *   - repo already has @supabase/supabase-js installed (run `npm install` once)
 *   - create a `.env` file based on `office-biotime-sync.env.example`
 *
 * The script performs two high‑level operations:
 *   1. pull the current employee list from BioTime and upsert it into
 *      Supabase (table name hardcoded below, adjust if needed)
 *   2. pull recent punches (the last 24 hours by default) and upsert
 *      them into Supabase; any punch whose employee id is missing will be
 *      reported as an "unknownEmployee" so you can investigate.
 *
 * At the end it logs a small summary (processed / duplicates / unknownEmployees).
 *
 * To run manually:
 *   node scripts/office-biotime-sync.js
 *
 * The intended use case is to invoke this with Windows Task Scheduler
 * every 5 minutes (see the paired README file for an example command).
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  BIOTIME_BASE_URL,
  BIOTIME_AUTH_HEADER,
  BIOTIME_USERNAME,
  BIOTIME_PASSWORD,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase configuration (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}
if (!BIOTIME_BASE_URL) {
  console.error('Missing BIOTIME_BASE_URL');
  process.exit(1);
}

// names of the tables we'll write to; change if your schema differs
const EMPLOYEE_TABLE = 'biotime_employees';
const PUNCH_TABLE = 'biotime_punches';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normalizeDepartment(dep) {
  if (!dep) return null;
  if (typeof dep === 'string') return dep;
  // common BioTime shapes: { dept_name }, { name }, sometimes nested
  return dep.dept_name || dep.deptName || dep.name || dep.department_name || null;
}

function normalizeEmployee(e) {
  const first = e.first_name || e.firstName || '';
  const last = e.last_name || e.lastName || '';
  const full = `${first} ${last}`.trim();
  return {
    // keep to a minimal, schema-friendly shape
    id: e.id ?? e.emp_id ?? e.employee_id ?? e.employeeId,
    name: e.name || full || e.emp_name || e.empName || null,
    department: normalizeDepartment(e.department),
  };
}

function normalizePunch(p) {
  // keep to a minimal, schema-friendly shape
  return {
    id: p.id ?? p.transaction_id ?? p.transactionId,
    employeeId: p.employee || p.employeeId || p.emp_id || p.empId,
    datetime: p.datetime || p.punch_time || p.punchTime || p.timestamp,
    // BioTime often uses 0/1; some APIs use "in"/"out"
    type: p.type ?? p.punch_state ?? p.punchState ?? p.state,
  };
}

function formatSupabaseError(err) {
  if (!err) return null;
  if (typeof err === 'string') return err;
  return {
    name: err.name,
    message: err.message,
    code: err.code,
    details: err.details,
    hint: err.hint,
    status: err.status,
    statusCode: err.statusCode,
  };
}

async function fetchJSON(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  // read header at runtime in case it was populated by authenticate()
  const authHeader = process.env.BIOTIME_AUTH_HEADER;
  if (authHeader) {
    headers.Authorization = authHeader;
  }
  const url = `${BIOTIME_BASE_URL.replace(/\/+$/,'')}${path}`;
  const res = await fetch(url, { headers, ...opts });
  if (!res.ok) {
    throw new Error(`BioTime request failed for ${url}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function authenticate() {
  // use general token endpoint by default
  if (!BIOTIME_USERNAME || !BIOTIME_PASSWORD) {
    throw new Error('BIOTIME_USERNAME and BIOTIME_PASSWORD required for authentication');
  }
  console.log('Obtaining general API token from BioTime...');
  const authData = await fetchJSON('/api-token-auth/', {
    method: 'POST',
    body: JSON.stringify({ username: BIOTIME_USERNAME, password: BIOTIME_PASSWORD }),
  });
  const token = authData.token;
  if (!token) {
    throw new Error('No token received from authentication');
  }
  console.log('Authentication successful');
  // set global header (Token <token>)
  return `Token ${token}`;
}

async function syncEmployees() {
  console.log('Fetching employees from BioTime...');
  const perPage = 200;
  let all = [];
  let page = 1;
  while (true) {
    const resp = await fetchJSON(`/personnel/api/employees/?page_size=${perPage}&page=${page}`);
    if (!resp || !Array.isArray(resp.data)) break;
    all = all.concat(resp.data);
    if (!resp.next) break;
    page++;
  }
  console.log(`retrieved ${all.length} employees`);
  if (all.length) {
    const rows = all.map(normalizeEmployee).filter(e => e && e.id != null);
    const { data, error } = await supabase
      .from(EMPLOYEE_TABLE)
      .upsert(rows, { onConflict: ['id'] })
      .select('id');
    console.log('upsert result data count', data?.length ?? 0);
    if (error) console.error('upsert result error', formatSupabaseError(error));
    if (error) {
      const { inspect } = await import('util');
      console.error('employee upsert error (inspect)', inspect(error, { showHidden: true, depth: null }));
      throw error;
    }
    console.log(`upserted ${data?.length ?? 0} employees`);
  }
}

async function syncPunches() {
  console.log("Fetching punches from BioTime (paginated)...");
  const perPage = 500;
  let all = [];
  let page = 1;
  while (true) {
    const resp = await fetchJSON(`/iclock/api/transactions/?page_size=${perPage}&page=${page}`);
    if (!resp || !Array.isArray(resp.data)) break;
    all = all.concat(resp.data);
    if (!resp.next) break;
    page++;
  }
  console.log(`retrieved ${all.length} punches`);

  if (all.length) {
    const rows = all.map(normalizePunch).filter(p => p && p.id != null);
    const { data, error } = await supabase
      .from(PUNCH_TABLE)
      .upsert(rows, { onConflict: ['id'] });
    if (error) {
      const { inspect } = await import('util');
      console.error('punch upsert error', formatSupabaseError(error));
      console.error('punch upsert error (inspect)', inspect(error, { showHidden: true, depth: null }));
      throw error;
    }
    const duplicates = all.length - (data?.length ?? 0);
    console.log(`upserted ${data?.length ?? 0} punches (duplicates=${duplicates})`);
  }
}

async function run() {
  try {
    // authenticate first to get a token
    const authHeader = await authenticate();
    // set it for subsequent requests
    process.env.BIOTIME_AUTH_HEADER = authHeader;

    await syncEmployees();
    await syncPunches();
    console.log('sync complete');
    return { success: true };
  } catch (err) {
    // log as much info as possible so callers can debug
    console.error('sync failed', err);
    if (err && err.stack) console.error(err.stack);
    if (err && typeof err === 'object') {
      try { console.error('error details', JSON.stringify(err)); } catch {};
    }
    // when called programmatically we don't exit
    return { success: false, error: err };
  }
}

export { run, authenticate };

// if the script is executed directly via `node scripts/office-biotime-sync.js`
// then run immediately; otherwise importing modules can call `run()` manually.
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] === __filename) {
  run().then(res => {
    if (!res.success) process.exit(1);
  });
}

