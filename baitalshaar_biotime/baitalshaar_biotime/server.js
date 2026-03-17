/*
 * Simple web server that exposes the BioTime sync functionality and runs it
 * every five minutes automatically.  It also provides a `/status` endpoint so
 * you can verify the last run result.
 *
 * Usage:
 *   npm install express node-cron
 *   node server.js
 *
 * then visit http://localhost:3000/status or /sync to trigger manually.
 */

import express from 'express';
import cron from 'node-cron';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { run as genericSync } from './scripts/office-biotime-sync.js';
import { run as officeSync } from './scripts/office-biotime-office-sync.js';

// choose which sync behavior to use; default is the original generic
const syncRun = process.env.BIOTIME_SYNC_TARGET === 'office' ? officeSync : genericSync;

// supabase client for additional API routes
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);


const app = express();
let lastRun = { timestamp: null, success: null, message: '', stats: null };

async function performSync() {
  lastRun.timestamp = new Date();
  lastRun.stats = null;
  try {
    const res = await syncRun();
    if (res.success) {
      lastRun.success = true;
      lastRun.message = 'completed successfully';
      lastRun.stats = res.stats || null;
      const s = res.stats;
      if (s) {
        console.log(`[${lastRun.timestamp.toISOString()}] sync succeeded: ${s.success} synced, ${s.unknown} unknown, ${s.invalid} invalid, ${s.duplicateLog} duplicate(s) skipped`);
        if (s.unknown > 0 && s.success === 0) {
          console.warn('All transactions were "unknown" — run Import Employees from BioTime so employee_code matches, then sync again.');
        }
      } else {
        console.log(`[${lastRun.timestamp.toISOString()}] sync succeeded`);
      }
    } else {
      lastRun.success = false;
      const err = res.error;
      lastRun.message = err?.message || 'failed';
      if (err?.cause?.message) lastRun.message += ' (' + err.cause.message + ')';
      lastRun.stats = null;
      console.error(`[${lastRun.timestamp.toISOString()}] sync failed`, {
        name: err?.name,
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        status: err?.status,
      });
    }
  } catch (err) {
    lastRun.success = false;
    lastRun.message = err.message;
    lastRun.stats = null;
    console.error('unexpected error during sync', err);
  }
}

// schedule every 5 minutes
cron.schedule('*/5 * * * *', () => {
  performSync();
});

app.get('/sync', async (req, res) => {
  await performSync();
  res.json(lastRun);
});

app.get('/status', (req, res) => {
  res.json(lastRun);
});

// serve static dashboard files from public/
app.use(express.static('public'));

// REST API helpers
const IS_OFFICE_MODE = process.env.BIOTIME_SYNC_TARGET === 'office';
const EMP_TABLE = IS_OFFICE_MODE ? 'office_employees' : 'biotime_employees';
const PUNCH_TABLE = IS_OFFICE_MODE ? 'office_attendance_logs' : 'biotime_punches';

function formatSupabaseError(err) {
  if (!err) return null;
  return {
    message: err.message,
    code: err.code,
    details: err.details,
    hint: err.hint,
    status: err.status,
  };
}

function normalizeDepartment(dep) {
  if (!dep) return null;
  if (typeof dep === 'string') return dep;
  return dep.dept_name || dep.deptName || dep.name || dep.department_name || null;
}

async function fetchBioTimeJSON(path, opts = {}) {
  const base = process.env.BIOTIME_BASE_URL;
  if (!base) throw new Error('Missing BIOTIME_BASE_URL');

  const headers = { 'Content-Type': 'application/json' };
  const auth = process.env.BIOTIME_AUTH_HEADER;
  if (auth) headers.Authorization = auth;

  const url = `${base.replace(/\/+$/,'')}${path}`;
  const res = await fetch(url, { headers, ...opts });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep raw */ }
  if (!res.ok) {
    throw new Error(`BioTime request failed for ${url}: ${res.status} ${res.statusText} - ${text}`);
  }
  return json;
}

async function ensureBioTimeAuth() {
  if (process.env.BIOTIME_AUTH_HEADER) return process.env.BIOTIME_AUTH_HEADER;
  const u = process.env.BIOTIME_USERNAME;
  const p = process.env.BIOTIME_PASSWORD;
  if (!u || !p) throw new Error('Missing BIOTIME_USERNAME / BIOTIME_PASSWORD');

  // Prefer JWT flow (matches your docs), fallback to Token flow
  try {
    const jwt = await fetchBioTimeJSON('/jwt-api-token-auth/', {
      method: 'POST',
      body: JSON.stringify({ username: u, password: p }),
    });
    if (jwt?.token) {
      process.env.BIOTIME_AUTH_HEADER = `JWT ${jwt.token}`;
      return process.env.BIOTIME_AUTH_HEADER;
    }
  } catch {
    // ignore and try token endpoint
  }

  const tok = await fetchBioTimeJSON('/api-token-auth/', {
    method: 'POST',
    body: JSON.stringify({ username: u, password: p }),
  });
  if (!tok?.token) throw new Error('No token received from BioTime authentication');
  process.env.BIOTIME_AUTH_HEADER = `Token ${tok.token}`;
  return process.env.BIOTIME_AUTH_HEADER;
}

app.get('/api/employees', async (req, res) => {
  let query = supabase.from(EMP_TABLE).select('*');
  // sort employees by department then name for nicer display
  if (IS_OFFICE_MODE) {
    query = query.order('department', { ascending: true }).order('name', { ascending: true });
  } else {
    query = query.order('department', { ascending: true }).order('name', { ascending: true });
  }
  const { data, error } = await query;
  if (error) return res.status(500).json({ error });
  res.json(data);
});

app.get('/api/punches', async (req, res) => {
  // optional start/end query params
  let query = supabase.from(PUNCH_TABLE).select('*');
  const dtCol = IS_OFFICE_MODE ? 'timestamp' : 'datetime';
  if (req.query.start) query = query.gte(dtCol, req.query.start);
  if (req.query.end) query = query.lte(dtCol, req.query.end);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error });
  if (!IS_OFFICE_MODE) return res.json(data);

  // Enrich with employee_code, name, department (case-insensitive UUID lookup)
  const empIds = [...new Set((data || []).map(r => r.employee_id).filter(Boolean))];
  let empMap = new Map();
  if (empIds.length > 0) {
    const { data: emps, error: empErr } = await supabase.from('office_employees').select('id, employee_code, name, department').in('id', empIds);
    if (empErr) {
      console.warn('/api/punches employee lookup error', empErr.message || empErr);
    } else if (Array.isArray(emps)) {
      for (const e of emps) {
        const key = e.id != null ? String(e.id).toLowerCase() : null;
        if (key) {
          empMap.set(key, {
            employee_code: e.employee_code ?? null,
            name: e.name ?? null,
            department: e.department ?? null,
          });
        }
      }
      if (emps.length === 0 && empIds.length > 0) {
        console.warn('/api/punches: no office_employees rows for', empIds.length, 'employee_id(s) – run Import Employees and re-sync');
      }
    }
  }
  const normalized = (data || []).map(r => {
    const key = r.employee_id != null ? String(r.employee_id).toLowerCase() : null;
    const emp = key ? empMap.get(key) : null;
    return {
      employeeId: r.employee_id,
      employee_code: emp?.employee_code ?? null,
      name: emp?.name ?? null,
      department: emp?.department ?? null,
      datetime: r.timestamp,
      type: r.action,
    };
  });
  return res.json(normalized);
});

// Daily check-in/check-out (office mode): GET /api/attendance?date=YYYY-MM-DD
app.get('/api/attendance', async (req, res) => {
  if (!IS_OFFICE_MODE) {
    return res.status(400).json({ error: { message: 'This endpoint is only for BIOTIME_SYNC_TARGET=office' } });
  }
  let date = req.query.date || new Date().toISOString().slice(0, 10);
  if (typeof date === 'string') date = date.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = new Date().toISOString().slice(0, 10);
  const { data: rows, error } = await supabase
    .from('office_attendance')
    .select('employee_id, date, check_in, check_out, method')
    .eq('date', date)
    .order('check_in', { ascending: true });
  if (error) return res.status(500).json({ error });
  const empIds = [...new Set((rows || []).map(r => r.employee_id).filter(Boolean))];
  if (empIds.length === 0) return res.json({ date, attendance: [] });
  const { data: emps, error: e2 } = await supabase
    .from('office_employees')
    .select('id, name, employee_code, department')
    .in('id', empIds);
  if (e2) return res.status(500).json({ error: e2 });
  const empMap = new Map();
  for (const e of emps || []) {
    if (e.id != null) empMap.set(String(e.id).toLowerCase(), e);
  }
  const attendance = (rows || []).map(r => {
    const emp = r.employee_id != null ? empMap.get(String(r.employee_id).toLowerCase()) : null;
    const checkIn = r.check_in ? new Date(r.check_in) : null;
    const checkOut = r.check_out ? new Date(r.check_out) : null;
    let hours = null;
    if (checkIn && checkOut) hours = ((checkOut - checkIn) / (1000 * 60 * 60)).toFixed(2);
    return {
      employee_id: r.employee_id,
      name: emp?.name ?? emp?.employee_code ?? '',
      employee_code: emp?.employee_code ?? '',
      department: emp?.department ?? '',
      date: r.date,
      check_in: r.check_in,
      check_out: r.check_out,
      hours,
      method: r.method,
    };
  });
  res.json({ date, attendance });
});

// Last check-in / check-out per employee (from office_attendance_logs – latest timestamp per action)
app.get('/api/attendance/last', async (req, res) => {
  if (!IS_OFFICE_MODE) {
    return res.status(400).json({ error: { message: 'This endpoint is only for BIOTIME_SYNC_TARGET=office' } });
  }
  const { data: logs, error: logErr } = await supabase
    .from('office_attendance_logs')
    .select('employee_id, action, timestamp');
  if (logErr) return res.status(500).json({ error: logErr });
  const byEmp = new Map();
  for (const row of logs || []) {
    const key = String(row.employee_id).toLowerCase();
    if (!byEmp.has(key)) byEmp.set(key, { employee_id: row.employee_id, last_checkin: null, last_checkout: null });
    const cur = byEmp.get(key);
    const ts = row.timestamp;
    if (row.action === 'checkin' && (cur.last_checkin == null || new Date(ts) > new Date(cur.last_checkin))) cur.last_checkin = ts;
    if (row.action === 'checkout' && (cur.last_checkout == null || new Date(ts) > new Date(cur.last_checkout))) cur.last_checkout = ts;
  }
  const empIds = [...byEmp.values()].map(v => v.employee_id);
  if (empIds.length === 0) return res.json({ last: [] });
  const { data: emps, error: e2 } = await supabase
    .from('office_employees')
    .select('id, employee_code, name, department')
    .in('id', empIds);
  if (e2) return res.status(500).json({ error: e2 });
  const empMap = new Map();
  for (const e of emps || []) {
    empMap.set(String(e.id).toLowerCase(), { employee_code: e.employee_code, name: e.name, department: e.department });
  }
  const last = [];
  for (const [key, cur] of byEmp.entries()) {
    const emp = empMap.get(key);
    last.push({
      employee_id: cur.employee_id,
      employee_code: emp?.employee_code ?? '',
      name: emp?.name ?? '',
      department: emp?.department ?? '',
      last_checkin: cur.last_checkin,
      last_checkout: cur.last_checkout,
    });
  }
  last.sort((a, b) => (a.employee_code || '').localeCompare(b.employee_code || ''));
  res.json({ last });
});

// Live/recent punches from BioTime (same as Real-Time Monitoring) — fetches directly from device
app.get('/api/biotime/recent', async (req, res) => {
  try {
    await ensureBioTimeAuth();
    const minutes = Math.min(1440, Math.max(5, Number(req.query.minutes) || 60));
    const startTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();
    const path = process.env.BIOTIME_TRANSACTION_PATH || process.env.BIOTIME_TRANSACTIONS_PATH || '/iclock/api/transactions/';
    const url = `${path}?page_size=200&start_time=${encodeURIComponent(startTime)}`;
    const resp = await fetchBioTimeJSON(url);
    const root = process.env.BIOTIME_JSON_ROOT;
    let list = [];
    if (root === 'data') list = Array.isArray(resp?.data) ? resp.data : [];
    else if (root === 'results') list = Array.isArray(resp?.results) ? resp.results : [];
    else if (Array.isArray(resp)) list = resp;
    else if (Array.isArray(resp?.data)) list = resp.data;
    else if (Array.isArray(resp?.results)) list = resp.results;

    const { data: emps } = await supabase.from('office_employees').select('id, employee_code, name, department');
    const codeToEmp = new Map();
    for (const e of emps || []) {
      const c = e.employee_code != null ? String(e.employee_code).trim() : null;
      if (c) codeToEmp.set(c, { name: e.name ?? '', department: e.department ?? '' });
    }

    const out = [];
    for (const tx of list) {
      const codeRaw = tx.employee_code ?? tx.emp_code ?? tx.EmployeeCode;
      const code = codeRaw != null ? String(codeRaw).trim() : null;
      const time = tx.punch_time ?? tx.punchTime ?? tx.datetime;
      const raw = tx.punch_state != null ? tx.punch_state : tx.punchState;
      const state = raw === 0 || raw === '0' ? 0 : raw === 1 || raw === '1' ? 1 : null;
      if (!code || !time || (state !== 0 && state !== 1)) continue;
      const emp = codeToEmp.get(code);
      out.push({
        employee_code: code,
        name: emp?.name ?? '',
        department: emp?.department ?? '',
        datetime: time,
        type: state === 0 ? 'checkin' : 'checkout',
      });
    }
    out.sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
    res.json({ recent: out, from: startTime, minutes });
  } catch (err) {
    console.error('api/biotime/recent error', err.message || err);
    res.status(500).json({ error: { message: err.message || 'Failed to fetch recent from BioTime' } });
  }
});

// Import employees from BioTime into office_employees
app.post('/api/biotime/employees/load', async (req, res) => {
  if (!IS_OFFICE_MODE) {
    return res.status(400).json({ error: { message: 'This endpoint is only for BIOTIME_SYNC_TARGET=office' } });
  }
  try {
    await ensureBioTimeAuth();

    const perPage = Number(req.query.page_size || 200);
    let page = 1;
    let all = [];
    while (true) {
      const resp = await fetchBioTimeJSON(`/personnel/api/employees/?page_size=${perPage}&page=${page}`);
      const batch = Array.isArray(resp?.data) ? resp.data : [];
      all = all.concat(batch);
      if (!resp?.next || batch.length === 0) break;
      page++;
    }

    const rowsBase = all.map(e => {
      const codeRaw = e.emp_code ?? e.employee_code ?? e.empCode ?? null;
      const code = codeRaw == null ? null : String(codeRaw).trim();
      const first = e.first_name ?? e.firstName ?? '';
      const last = e.last_name ?? e.lastName ?? '';
      const full = `${first} ${last}`.trim();
      const name = e.nickname || e.name || full || String(code || '').trim() || 'Unknown';
      const emailRaw = e.email == null ? '' : String(e.email).trim();
      const email = emailRaw || (code ? `${code}@biotime.local` : 'unknown@biotime.local');
      return {
        employee_code: code,
        name,
        department: normalizeDepartment(e.department),
        email,
      };
    }).filter(r => r.employee_code);

    async function upsertEmployees(rows) {
      return await supabase
        .from('office_employees')
        .upsert(rows, { onConflict: ['employee_code'] })
        .select('id, employee_code');
    }

    // try to upsert, auto-filling NOT NULL columns if Supabase rejects nulls
    let rows = rowsBase;
    let upsertRes = await upsertEmployees(rows);

    // If a column doesn't exist in the table (common when schema differs), retry with a smaller payload.
    if (upsertRes.error && String(upsertRes.error.message || '').includes('department')) {
      rows = rows.map(r => ({ employee_code: r.employee_code, name: r.name, email: r.email }));
      upsertRes = await upsertEmployees(rows);
    }

    // If id has no default, retry with generated UUIDs.
    if (upsertRes.error && String(upsertRes.error.message || '').includes('null value in column \"id\"')) {
      rows = rows.map(r => ({ ...r, id: randomUUID() }));
      upsertRes = await upsertEmployees(rows);
    }

    // Generic: handle NOT NULL violations by setting missing columns to empty string and retrying a few times.
    for (let i = 0; upsertRes.error?.code === '23502' && i < 5; i++) {
      const msg = String(upsertRes.error.message || '');
      const m = msg.match(/null value in column \"([^\"]+)\"/);
      const col = m?.[1];
      if (!col) break;
      rows = rows.map(r => {
        if (r[col] != null) return r;
        if (col === 'email') {
          return { ...r, email: `${r.employee_code}@biotime.local` };
        }
        return { ...r, [col]: `${col}_${r.employee_code}` };
      });
      upsertRes = await upsertEmployees(rows);
    }

    // Unique constraints: if it fails due to duplicates, generate per-employee placeholders and retry a few times.
    for (let i = 0; upsertRes.error?.code === '23505' && i < 5; i++) {
      const details = String(upsertRes.error.details || '');
      const m = details.match(/Key \\(([^)]+)\\)=\\(([^)]*)\\)/);
      const col = m?.[1];
      if (!col) break;
      rows = rows.map(r => {
        const cur = r[col];
        if (cur == null || String(cur).trim() === '') {
          if (col === 'email') return { ...r, email: `${r.employee_code}@biotime.local` };
          return { ...r, [col]: `${col}_${r.employee_code}` };
        }
        return r;
      });
      upsertRes = await upsertEmployees(rows);
    }

    if (upsertRes.error) {
      return res.status(500).json({ error: formatSupabaseError(upsertRes.error) });
    }

    return res.json({
      success: true,
      fetched: all.length,
      upserted: upsertRes.data?.length ?? 0,
    });
  } catch (err) {
    console.error('load employees error', err);
    return res.status(500).json({ error: { message: err.message } });
  }
});

app.get('/api/report', async (req, res) => {
  try {
    const DEPARTMENTS = ['al saqia', 'baitalshaar'];
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const start = req.query.start ? new Date(req.query.start) : firstOfMonth;
    const end = req.query.end ? new Date(req.query.end) : lastOfMonth;

    if (!IS_OFFICE_MODE) {
      // original biotime_* schema
      const { data: emps, error: e1 } = await supabase
        .from('biotime_employees')
        .select('id, name, department')
        .in('department', DEPARTMENTS);
      if (e1) return res.status(500).json({ error: e1 });
      const empMap = new Map((emps || []).map(e => [e.id, e]));
      const empIds = emps.map(e => e.id);

      let query2 = supabase.from('biotime_punches').select('id, employeeId, datetime, type')
        .in('employeeId', empIds)
        .gte('datetime', start.toISOString())
        .lte('datetime', end.toISOString());
      const { data: punches, error: e2 } = await query2;
      if (e2) return res.status(500).json({ error: e2 });

      const byEmp = new Map();
      for (const p of punches || []) {
        const list = byEmp.get(p.employeeId) || [];
        list.push(p);
        byEmp.set(p.employeeId, list);
      }

      const results = [];
      for (const [empId, list] of byEmp.entries()) {
        list.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        let pendingIn = null;
        const daily = {};
        let monthlyTotal = 0;
        for (const p of list) {
          const t = new Date(p.datetime);
          const dstr = t.toISOString().slice(0, 10);
          const isIn = p.type === 'in' || p.type === 0 || p.type === '0';
          if (isIn) {
            pendingIn = t;
          } else if (pendingIn) {
            const hrs = (t - pendingIn) / (1000 * 60 * 60);
            daily[dstr] = (daily[dstr] || 0) + hrs;
            monthlyTotal += hrs;
            pendingIn = null;
          }
        }
        results.push({ employee: empMap.get(empId), daily, monthlyTotal });
      }
      const grandTotal = results.reduce((sum, r) => sum + r.monthlyTotal, 0);
      return res.json({ start, end, results, grandTotal });
    }

    // office_* schema: derive hours from office_attendance instead of raw punches
    const { data: emps, error: e1 } = await supabase
      .from('office_employees')
      .select('*');
    if (e1) return res.status(500).json({ error: e1 });
    const empMap = new Map();
    for (const e of emps || []) {
      if (e.id != null) empMap.set(String(e.id).toLowerCase(), e);
    }
    const empIds = emps.map(e => e.id);

    const { data: days, error: e2 } = await supabase
      .from('office_attendance')
      .select('employee_id, date, check_in, check_out')
      .in('employee_id', empIds)
      .gte('date', start.toISOString().slice(0, 10))
      .lte('date', end.toISOString().slice(0, 10));
    if (e2) return res.status(500).json({ error: e2 });

    const byEmp = new Map();
    for (const d of days || []) {
      const key = d.employee_id != null ? String(d.employee_id).toLowerCase() : null;
      if (!key) continue;
      const list = byEmp.get(key) || [];
      list.push(d);
      byEmp.set(key, list);
    }

    const results = [];
    for (const [empIdKey, list] of byEmp.entries()) {
      let monthlyTotal = 0;
      const daily = {};
      for (const d of list) {
        if (!d.check_in || !d.check_out) continue;
        const startTs = new Date(d.check_in);
        const endTs = new Date(d.check_out);
        const hrs = (endTs - startTs) / (1000 * 60 * 60);
        const dStr = typeof d.date === 'string' ? d.date.slice(0, 10) : new Date(d.date).toISOString().slice(0, 10);
        daily[dStr] = (daily[dStr] || 0) + hrs;
        monthlyTotal += hrs;
      }
      const e = empMap.get(empIdKey);
      results.push({
        employee: {
          id: e?.id,
          name: e?.name || e?.employee_code || '',
          department: e?.department || '',
        },
        daily,
        monthlyTotal,
      });
    }
    const grandTotal = results.reduce((sum, r) => sum + r.monthlyTotal, 0);
    return res.json({ start, end, results, grandTotal });
  } catch (err) {
    console.error('api/report error', err);
    return res.status(500).json({ error: { message: err.message } });
  }
});

const PORT = process.env.PORT || 5173;
app.listen(PORT, () => {
  console.log(`server listening on port ${PORT}`);
  console.log('hit /sync to run now, /status for last result');
});
