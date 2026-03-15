# BioTime → Supabase Office Attendance Sync — Spec for Script

Use this document when implementing or updating the BioTime sync script so it writes exactly to the Supabase office schema and works with Realtime.

---

## 1. What to fetch from BioTime

### API
- **Endpoint:** `GET {BIOTIME_BASE_URL}/att/api/transactionReport/`
- **Example base URL:** `http://192.168.1.50:80` (must be reachable from the machine running the script).

### Required fields per transaction (adjust key names if your BioTime API differs)

| BioTime field   | Type   | Use in Supabase |
|-----------------|--------|------------------|
| `employee_code` | string | Map to `office_employees.employee_code` to get `employee_id` (uuid). |
| `punch_time`    | string | Datetime of the punch. Store as-is for logs; use for `check_in` / `check_out` and date. |
| `punch_state`   | number | **0** = check-in → set `check_in`; **1** = check-out → set `check_out`. |

### Response shape
- Transactions may be: root array `[]`, or inside `data`, or `results`. Support at least:
  - `[]`
  - `{ "data": [] }`
  - `{ "results": [] }`
- Optional env: `BIOTIME_JSON_ROOT` = `array` | `data` | `results` to force the root.

### Punch time format
- Script must derive **date** as `YYYY-MM-DD` (first 10 characters of `punch_time` if ISO-like, or parse your format).
- Store `punch_time` as-is in `office_attendance_logs.timestamp` and use it for `office_attendance.check_in` / `check_out` (timestamptz).

---

## 2. Supabase tables and columns (exact)

### 2.1 `office_employees` (read-only in sync script)

Used only to map BioTime `employee_code` → Supabase `id` (uuid).

| Column              | Type         | Notes |
|---------------------|--------------|--------|
| `id`                | uuid         | Use this as `employee_id` in attendance and logs. |
| `employee_code`     | text, unique | Match with BioTime `employee_code` (trim, string compare). |

**Query:** `SELECT id, employee_code FROM office_employees`  
**Logic:** Build a map `employee_code → id`. If a BioTime transaction has `employee_code` not in this map, skip the row (count as unknown employee).

---

### 2.2 `office_attendance` (insert/update by sync)

One row per employee per calendar day. **Unique constraint:** `(employee_id, date)`.

| Column       | Type      | Notes |
|-------------|-----------|--------|
| `id`        | uuid      | PK, auto. |
| `employee_id` | uuid    | From `office_employees.id`. |
| `date`      | date      | `YYYY-MM-DD` from `punch_time`. |
| `check_in`  | timestamptz | Earliest punch with `punch_state = 0` for that day. |
| `check_out` | timestamptz | Latest punch with `punch_state = 1` for that day. |
| `worked_hours` | numeric | **Do not set in script** — DB trigger computes it when both `check_in` and `check_out` are set. |
| `method`    | text      | Set to `'biometric'` for BioTime. If row already has `method = 'manual'`, do **not** overwrite. |
| `device`    | text      | Optional; e.g. `'BioTime'`. |
| `location`  | text      | Optional. |
| `notes`     | text      | Optional. |
| `created_at`| timestamptz | Default. |

**Logic:**
- For each transaction: get `employee_id` from map, derive `date` from `punch_time`.
- **Check-in (`punch_state === 0`):** set `check_in` = `punch_time` only if current row has no `check_in` or new time is earlier.
- **Check-out (`punch_state === 1`):** set `check_out` = `punch_time` only if current row has no `check_out` or new time is later.
- If no row exists for `(employee_id, date)`, INSERT; else UPDATE. Do not set `worked_hours` in the script.

---

### 2.3 `office_attendance_logs` (insert-only, dedupe by unique constraint)

Every BioTime punch must insert one log row. Dedupe by unique constraint so the same punch is not inserted twice.

| Column       | Type      | Notes |
|-------------|-----------|--------|
| `id`        | uuid      | PK, auto. |
| `employee_id` | uuid    | From `office_employees.id`. |
| `action`    | text      | `'checkin'` when `punch_state === 0`, `'checkout'` when `punch_state === 1`. |
| `method`    | text      | `'biometric'`. |
| `timestamp` | timestamptz | Use BioTime `punch_time` value. |
| `ip_address`| inet      | Optional. |
| `device_info` | text    | Optional. |
| `created_at`| timestamptz | Default. |

**Unique constraint:** `(employee_id, action, method, timestamp)`  
**Logic:** INSERT every punch. On unique violation (e.g. PostgreSQL `23505`), skip that row (already synced). Insert logs **before** updating `office_attendance` so the audit trail is correct.

---

## 3. Sync flow (per BioTime transaction)

For each transaction row from BioTime:

1. **Validate:** `employee_code` and `punch_time` present; `punch_state` in `{0, 1}`. Else skip.
2. **Resolve employee:** `employee_id = map.get(employee_code)`. If missing, skip (count as unknown).
3. **Date:** `date = YYYY-MM-DD` from `punch_time`.
4. **Action:** `action = punch_state === 0 ? 'checkin' : 'checkout'`.
5. **Insert log:**  
   `INSERT INTO office_attendance_logs (employee_id, action, method, timestamp)`  
   with `method = 'biometric'`, `timestamp = punch_time`.  
   If duplicate key error → skip to next transaction (no attendance update for this punch).
6. **Upsert attendance:**
   - SELECT existing row: `office_attendance` WHERE `employee_id` AND `date`.
   - If **checkin:** set `check_in` to `punch_time` if existing `check_in` is null or `punch_time` is earlier.
   - If **checkout:** set `check_out` to `punch_time` if existing `check_out` is null or `punch_time` is later.
   - Set `method = 'biometric'` only if current `method` is not `'manual'`. Set `device = 'BioTime'` if you use it.
   - INSERT new row if none exists; else UPDATE.

---

## 4. Realtime (admin dashboard)

- The admin panel subscribes to Postgres changes on `office_employees` and `office_attendance`.
- For Realtime to work, these tables must be in the **`supabase_realtime`** publication.
- Migration that does this (run once in Supabase):  
  `supabase/migrations/add_office_tables_to_realtime_publication.sql`  
  It adds `office_employees` and `office_attendance` to `supabase_realtime`.
- The sync script does **not** need to enable Realtime; it only needs to INSERT/UPDATE the tables correctly. Once the publication includes these tables, the dashboard will receive changes automatically.

---

## 5. Environment variables (script)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (bypasses RLS). |
| `BIOTIME_BASE_URL` | Yes | Base URL of BioTime API (e.g. `http://192.168.1.50:80`). |
| `BIOTIME_TRANSACTION_PATH` | No | Path after base; default `/att/api/transactionReport/`. |
| `BIOTIME_AUTH_HEADER` | No | e.g. `Bearer TOKEN` or `Basic base64(...)`. |
| `BIOTIME_JSON_ROOT` | No | `array` \| `data` \| `results` if response shape is fixed. |

---

## 6. Summary checklist for the BioTime script

- [ ] Fetch from BioTime: `employee_code`, `punch_time`, `punch_state`.
- [ ] Map `employee_code` → `office_employees.id`; skip unknown codes.
- [ ] Parse `date` (YYYY-MM-DD) from `punch_time`.
- [ ] Insert into `office_attendance_logs` first; on duplicate key, skip attendance update for that punch.
- [ ] Upsert `office_attendance`: one row per (employee_id, date); set earliest check_in, latest check_out; do not overwrite `method = 'manual'`; do not set `worked_hours`.
- [ ] Use Supabase service role; ensure `office_employees` and `office_attendance` are in `supabase_realtime` for the admin dashboard to show live check-in/check-out.
