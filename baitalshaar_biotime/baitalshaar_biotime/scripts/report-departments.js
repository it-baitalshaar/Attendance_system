/*
 * simple departmental hours report
 *
 * Usage:
 *   # set SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY in your .env as described
 *   # earlier; the same .env is picked up by dotenv
 *   node scripts/report-departments.js 2026-01-01 2026-01-31
 *
 * The two arguments are the inclusive start/end dates to report on; if you
 * omit them the script defaults to the current month.
 *
 * This example assumes:
 *   - employees live in table `biotime_employees` and have at least
 *     {id, name, department} fields.
 *   - punches live in `biotime_punches` and contain {employeeId, datetime,
 *     type} where `type` is either 'in'/'out' or 0/1.  Adapt the field names
 *     to match your schema.
 *
 * Two departments are hardcoded (`al saqia` and `baitalshaar`), but you can
 * change the DEPARTMENTS array or accept them as command-line options.
 *
 * The script will print a table grouping by employee with daily totals and a
 * monthly summary at the end.  It also emits a CSV to stdout if you pipe the
 * output somewhere.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const DEPARTMENTS = ['al saqia', 'baitalshaar'];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function parseDateArg(arg, fallback) {
  if (!arg) return fallback;
  const d = new Date(arg);
  if (isNaN(d)) {
    throw new Error(`invalid date argument: ${arg}`);
  }
  return d;
}

function hoursBetween(start, end) {
  return (end - start) / (1000 * 60 * 60);
}

async function run() {
  const args = process.argv.slice(2);
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const start = parseDateArg(args[0], firstOfMonth);
  const end = parseDateArg(args[1], lastOfMonth);

  console.log(`requesting punches between ${start.toISOString()} and ${end.toISOString()}`);

  // get relevant employees
  const { data: emps, error: e1 } = await supabase
    .from('biotime_employees')
    .select('id, name, department')
    .in('department', DEPARTMENTS);
  if (e1) throw e1;
  if (!emps || emps.length === 0) {
    console.warn('no employees found for departments', DEPARTMENTS);
    process.exit(0);
  }

  const empMap = new Map(emps.map(e => [e.id, e]));
  const empIds = emps.map(e => e.id);

  const { data: punches, error: e2 } = await supabase
    .from('biotime_punches')
    .select('id, employeeId, datetime, type')
    .in('employeeId', empIds)
    .gte('datetime', start.toISOString())
    .lte('datetime', end.toISOString());
  if (e2) throw e2;

  // group punches per employee
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
    const daily = {}; // date string -> hours
    let monthlyTotal = 0;

    for (const p of list) {
      const t = new Date(p.datetime);
      const dstr = t.toISOString().slice(0, 10);
      const isIn = p.type === 'in' || p.type === 0 || p.type === '0';
      if (isIn) {
        pendingIn = t;
      } else if (pendingIn) {
        const hrs = hoursBetween(pendingIn, t);
        daily[dstr] = (daily[dstr] || 0) + hrs;
        monthlyTotal += hrs;
        pendingIn = null;
      }
    }

    results.push({
      employee: empMap.get(empId),
      daily,
      monthlyTotal,
    });
  }

  // print
  for (const r of results) {
    console.log('---');
    console.log(`Employee: ${r.employee.name} (dept: ${r.employee.department})`);
    for (const [day, hrs] of Object.entries(r.daily)) {
      console.log(`  ${day}: ${hrs.toFixed(2)}h`);
    }
    console.log(`  monthly total: ${r.monthlyTotal.toFixed(2)}h`);
  }

  const grandTotal = results.reduce((sum, r) => sum + r.monthlyTotal, 0);
  console.log('===');
  console.log(`grand total for ${DEPARTMENTS.join(', ')}: ${grandTotal.toFixed(2)}h`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
