# BioTime Data — Spec for Attendance Website

Use this document so your **attendance website** can display the same data we fetch from BioTime and store in Supabase, without errors. It describes exactly what we fetch, how we normalize it, and the API response shapes your frontend can rely on.

---

## 1. Overview

- **BioTime** is the device/source of truth for check-in/check-out (punches).
- We fetch **employees** and **transactions (punches)** from the BioTime API, then sync them into **Supabase** (`office_employees`, `office_attendance_logs`, `office_attendance`).
- Your attendance website can either:
  - **Option A:** Call **our backend API** (same server as this project) and use the response shapes below, or
  - **Option B:** Read from **Supabase** using the same table/column meanings and normalization rules described here.

---

## 2. BioTime API (what we call)

### 2.1 Base URL and auth

- **Base URL:** e.g. `http://192.168.1.50:80` or `http://localhost:8080`. Set via `BIOTIME_BASE_URL`.
- **Auth:** We use **JWT** or **Token**.
  - **JWT:** `POST {base}/jwt-api-token-auth/` with body `{ "username": "...", "password": "..." }` → response `{ "token": "..." }`. Then use header: `Authorization: JWT <token>`.
  - **Token (fallback):** `POST {base}/api-token-auth/` with same body → `{ "token": "..." }`. Then use header: `Authorization: Token <token>`.
- All subsequent requests use the same `Authorization` header.

### 2.2 Transactions (punches) — Real-Time Monitoring / history

- **Path:** Configurable. We use one of:
  - `/iclock/api/transactions/` (common on devices)
  - `/att/api/transactionReport/` (default in docs)
  Set via `BIOTIME_TRANSACTION_PATH` (or `BIOTIME_TRANSACTIONS_PATH`).
- **Method:** `GET`.
- **Query parameters:**

| Parameter   | Required | Description |
|------------|----------|-------------|
| `page_size`| No      | Max items per page (we use 200–500). |
| `page`     | No      | Page number (1-based). |
| `start_time` | No    | ISO datetime; return only transactions **at or after** this time. Use for “recent” or incremental sync. |
| `end_time`   | No    | ISO datetime; return only transactions **before** this time. |

- **Response shape (one of):**
  - Root is an array: `[ { ... }, { ... } ]`
  - Or wrapped: `{ "data": [ ... ] }` or `{ "results": [ ... ] }`
  We support all three; optional env `BIOTIME_JSON_ROOT` can force `data` or `results` or `array`.

- **Each transaction object** — we accept **any** of these field names (first found wins):

| Meaning        | Possible keys from BioTime   | Type we use |
|----------------|------------------------------|-------------|
| Employee code  | `employee_code`, `emp_code`, `EmployeeCode` | string (trimmed) |
| Punch time     | `punch_time`, `punchTime`, `datetime`       | string or date-like |
| Punch type     | `punch_state`, `punchState`                  | number or string |

- **Punch type (critical):**
  - `0` or `"0"` → **Check-in**
  - `1` or `"1"` → **Check-out**
  Any other value is ignored (invalid).

- **Punch time formats we handle:**
  - ISO: `2026-03-11T08:05:00` or `2026-03-11T08:05:00+04:00`
  - Date + time: `2026-03-11 08:05:00`
  - **DD/MM/YYYY** or **DD-MM-YYYY** (with optional time): `11/03/2026 08:05`, `09-03-2026`
  We always derive:
  - **Date:** `YYYY-MM-DD` for the calendar day (for daily attendance).
  - **Timestamp:** ISO string for storing exact time (e.g. for logs and check_in/check_out).

- **Normalization rules your site should mirror:**
  - `employee_code`: trim whitespace; compare case-sensitively to `office_employees.employee_code`.
  - `punch_state`: accept both number `0`/`1` and string `"0"`/`"1"`.
  - Ignore transactions with missing `employee_code`, missing `punch_time`, or `punch_state` not in `{0, 1}`.

### 2.3 Employees (personnel)

- **Path:** `GET {base}/personnel/api/employees/`
- **Query:** `page_size`, `page` (pagination). We use `page_size=200`.
- **Response:** Usually `{ "data": [ ... ] }` and optionally `next` for next page. We treat the list as `resp.data` if present, else root array.

- **Per-employee object** — we accept:

| Meaning     | Possible keys              | Use |
|-------------|----------------------------|-----|
| Code        | `emp_code`, `employee_code`, `empCode` | string (trimmed); required. |
| First name  | `first_name`, `firstName`  | For full name. |
| Last name   | `last_name`, `lastName`    | For full name. |
| Full name   | `name`, `nickname`         | Prefer over first+last if present. |
| Department  | `department` (object or string) | We support string or `{ dept_name, deptName, name, department_name }`. |
| Email       | `email`                    | Use as-is if non-empty; else we use placeholder e.g. `{code}@biotime.local`. |

- **Name resolution:** `nickname || name || (first_name + " " + last_name).trim() || employee_code || "Unknown"`.
- **Department:** If object, we take `dept_name` or `deptName` or `name` or `department_name`; else use string as-is.

---

## 3. Our backend API (for your attendance website)

If your attendance website calls **our** server (this project), use these endpoints and response shapes. All dates are **YYYY-MM-DD** unless noted. All employee lookups use **lowercase UUID** for `employee_id` matching.

### 3.1 GET `/api/employees`

- **Returns:** Array of employees (from Supabase `office_employees`, populated from BioTime + manual edits).
- **Shape per row:**

```json
{
  "id": "uuid",
  "employee_code": "BS0003",
  "name": "Abduo Mohamed",
  "department": "Bait Alshaar",
  "email": "..."
}
```

- **Notes:** Sorted by `department` then `name`. Use `employee_code` to match with punches.

### 3.2 GET `/api/punches`

- **Query (optional):** `start`, `end` — ISO datetime strings to filter by punch time.
- **Returns:** Array of punch records (from `office_attendance_logs`, enriched with employee code/name/department).
- **Shape per row:**

```json
{
  "employeeId": "uuid",
  "employee_code": "BS0003",
  "name": "Abduo Mohamed",
  "department": "Bait Alshaar",
  "datetime": "2026-03-11T08:05:00.000Z",
  "type": "checkin"
}
```

- **`type`:** `"checkin"` or `"checkout"` only.

### 3.3 GET `/api/attendance?date=YYYY-MM-DD`

- **Query:** `date` — required, format **YYYY-MM-DD** (e.g. `2026-03-11`). We normalize to 10 chars; invalid date falls back to today.
- **Returns:** Daily summary (one row per employee per day from `office_attendance`).

```json
{
  "date": "2026-03-11",
  "attendance": [
    {
      "employee_id": "uuid",
      "employee_code": "BS0003",
      "name": "Abduo Mohamed",
      "department": "Bait Alshaar",
      "date": "2026-03-11",
      "check_in": "2026-03-11T08:05:00.000Z",
      "check_out": "2026-03-11T14:59:00.000Z",
      "hours": "6.54",
      "method": "biometric"
    }
  ]
}
```

- **`hours`:** String, computed as `(check_out - check_in)` in hours, 2 decimals. Can be `null` if missing check_in or check_out.

### 3.4 GET `/api/attendance/last`

- **Returns:** Last check-in and last check-out **per employee** (from `office_attendance_logs`).

```json
{
  "last": [
    {
      "employee_id": "uuid",
      "employee_code": "BS0003",
      "name": "Abduo Mohamed",
      "department": "Bait Alshaar",
      "last_checkin": "2026-03-11T08:05:00.000Z",
      "last_checkout": "2026-03-11T14:59:00.000Z"
    }
  ]
}
```

- Either timestamp can be missing (e.g. only check-in so far today).

### 3.5 GET `/api/biotime/recent?minutes=60`

- **Fetches directly from BioTime** (same as Real-Time Monitoring). Does **not** depend on sync.
- **Query:** `minutes` — last N minutes (5–1440). Default 60.
- **Returns:** Recent punches from the device.

```json
{
  "recent": [
    {
      "employee_code": "BS0003",
      "name": "Abduo Mohamed",
      "department": "Bait Alshaar",
      "datetime": "2026-03-12T08:13:01.000Z",
      "type": "checkin"
    }
  ],
  "from": "2026-03-12T07:13:00.000Z",
  "minutes": 60
}
```

- **`type`:** `"checkin"` or `"checkout"`. Sorted **newest first**.

### 3.6 GET `/api/report`

- **Query (optional):** `start`, `end` — ISO date or datetime; default is **first day of current month** to **last day of current month**.
- **Returns:** Monthly (or range) report from `office_attendance`, with hours per employee and per day.

```json
{
  "start": "2026-03-01T00:00:00.000Z",
  "end": "2026-03-31T23:59:59.999Z",
  "results": [
    {
      "employee": { "id": "uuid", "name": "Abduo Mohamed", "department": "Bait Alshaar" },
      "daily": { "2026-03-01": 6.5, "2026-03-02": 6.2 },
      "monthlyTotal": 120.5
    }
  ],
  "grandTotal": 1250.75
}
```

- **`daily`:** Keys are date strings `YYYY-MM-DD`, values are hours (number).
- **`monthlyTotal`:** Sum of hours for that employee in the range.
- **`grandTotal`:** Sum of all employees’ totals.

---

## 4. Supabase tables (if you read DB directly)

If your attendance website reads from Supabase instead of our API, use the same semantics:

| Table                     | Purpose |
|---------------------------|--------|
| `office_employees`        | One row per employee. Match punches by `employee_code` (trimmed). Use `id` (uuid) as `employee_id` everywhere else. |
| `office_attendance_logs`  | One row per punch. `employee_id` (uuid), `action` (`checkin`/`checkout`), `method`, `timestamp` (timestamptz). Unique on `(employee_id, action, method, timestamp)`. |
| `office_attendance`        | One row per employee per day. `employee_id`, `date` (date), `check_in`, `check_out` (timestamptz), `worked_hours` (often trigger-computed). Unique on `(employee_id, date)`. Constraint: `check_out >= check_in`. |

- **Employee lookup:** Always compare `employee_id` as **lowercase** string when joining (we store UUIDs; DB may return mixed case).
- **Date:** Always **YYYY-MM-DD** for `office_attendance.date` and for any date filter.

### 4.1 Supabase Realtime (every transaction live)

**Saving:** Every BioTime transaction (punch) is saved to **`office_attendance_logs`** — one row per check-in or check-out. The sync script inserts into this table first, then updates `office_attendance` (daily summary). So every transaction is persisted.

**Realtime:** For the attendance website to **see each new punch as it happens**, these tables must be in the **`supabase_realtime`** publication:

| Table                     | Realtime use |
|---------------------------|--------------|
| `office_employees`        | Live employee list changes. |
| `office_attendance`        | Live daily summary (one row per employee per day). |
| `office_attendance_logs`  | **Every transaction** — subscribe here for live check-in/check-out as each punch is synced. |

**One-time setup in Supabase:** Run the migration that adds all three tables to the publication (e.g. `supabase/migrations/add_office_tables_to_realtime_publication.sql`). It must include:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE office_employees;
ALTER PUBLICATION supabase_realtime ADD TABLE office_attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE office_attendance_logs;
```

**Attendance website:** Subscribe to **`office_attendance_logs`** (Supabase Realtime channel) with event type **INSERT** (and optionally UPDATE/DELETE). Each payload will contain the new row: `employee_id`, `action` (`checkin` | `checkout`), `method`, `timestamp` (ISO). Join `employee_id` to `office_employees` (e.g. by `id`, case-insensitive) to show employee code, name, and department. If `office_attendance_logs` is not in the publication, Realtime will not emit events for new punches—run the migration above and confirm in Supabase Dashboard → Database → Replication that the table is in the publication.

---

## 5. Date and time rules (avoid errors)

- **Display:** Use `new Date(...).toLocaleString()` or your locale equivalent for showing punch times; we store ISO timestamps.
- **Requesting by date:** Always send **YYYY-MM-DD** (e.g. `2026-03-11`). Do not send `DD/MM/YYYY` or `MM/DD/YYYY` to our API.
- **BioTime punch_time:** We accept ISO, `YYYY-MM-DD HH:mm`, or **DD/MM/YYYY** / **DD-MM-YYYY** (with optional time). We never treat a DD/MM string as MM/DD (to avoid July vs March mix-ups).
- **Report and attendance:** Our report uses `date` as **YYYY-MM-DD** string keys; our attendance endpoint expects `date=YYYY-MM-DD`.

---

## 6. Common pitfalls (so your site matches)

1. **Employee code:** Trim and use exact string match. Codes like `BS0003` and `888` are case-sensitive.
2. **Punch type:** Accept both number (`0`, `1`) and string (`"0"`, `"1"`) from raw BioTime; we normalize to `checkin` / `checkout`.
3. **JSON root:** BioTime may return `[]`, `{ "data": [] }`, or `{ "results": [] }`. Handle all when parsing transactions or employees.
4. **Empty lists:** Our API returns `attendance: []`, `recent: []`, `last: []`, `results: []` when there is no data; don’t assume a missing key.
5. **UUID casing:** When matching `employee_id` to employees, use lowercase (or case-insensitive) comparison.
6. **Live/recent data:** Use `/api/biotime/recent` for “right now” from the device; use `/api/punches` for synced history from Supabase.

---

## 7. Env / config (reference)

If you run the same backend, these env vars affect what we fetch and how:

| Variable                     | Purpose |
|-----------------------------|--------|
| `BIOTIME_BASE_URL`          | Base URL of BioTime API. |
| `BIOTIME_TRANSACTION_PATH`  | Path for transactions (e.g. `/iclock/api/transactions/`). |
| `BIOTIME_JSON_ROOT`         | Optional: `data` \| `results` \| `array` to force response root. |
| `BIOTIME_USERNAME` / `BIOTIME_PASSWORD` | Used for JWT/Token auth. |
| `BIOTIME_SYNC_TARGET`       | `office` — we use office_* tables. |
| Supabase `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | For DB and sync. |

---

## 8. Quick checklist for attendance website

- [ ] Use **YYYY-MM-DD** for any date parameter or filter.
- [ ] When reading employees/punches, handle **lowercase** `employee_id` if joining by id.
- [ ] Treat **punch type** as `0`/`"0"` = check-in, `1`/`"1"` = check-out; display as “Check In” / “Check Out”.
- [ ] For **live/recent** view, call `/api/biotime/recent?minutes=60` (or desired minutes).
- [ ] For **daily view**, call `/api/attendance?date=YYYY-MM-DD` and use `attendance[]` with `employee_code`, `name`, `department`, `check_in`, `check_out`, `hours`.
- [ ] For **last punch per employee**, use `/api/attendance/last` and show `last_checkin` / `last_checkout`.
- [ ] For **monthly report**, use `/api/report` and parse `results[].employee`, `results[].daily`, `results[].monthlyTotal`; handle empty `results`.
- [ ] Handle **empty arrays** and **null** for optional fields (e.g. `check_out`, `hours`, `last_checkout`) without throwing.
- [ ] **Realtime:** Ensure `office_attendance_logs` is in `supabase_realtime` (run the migration); subscribe to `office_attendance_logs` for INSERT to show every new punch live.

Using this spec, your attendance website can display the same BioTime-sourced data consistently and without errors.
