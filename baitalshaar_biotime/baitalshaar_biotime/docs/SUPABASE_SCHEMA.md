# Supabase schema reference (BioTime sync)

This project uses the following tables when `BIOTIME_SYNC_TARGET=office`.  
For the full sync script spec (what to fetch, flow, env), see **docs/BIOTIME_SYNC_SPEC.md**.

## office_employees

Stores employees imported from BioTime (via **Import Employees from BioTime** or sync).

| Column             | Type   | Notes                          |
|--------------------|--------|--------------------------------|
| id                 | uuid   | Primary key                    |
| employee_code      | text   | BioTime employee ID (e.g. 888, BS0003). UNIQUE. |
| name               | text   | Display name                   |
| department         | text   | e.g. "Al Saqia", "Bait Alshaar" |
| email              | text   | Required, UNIQUE (placeholder if missing) |
| device_id          | text   | Optional                       |
| dynamic_link_token | text   | Optional, UNIQUE               |
| created_at         | timestamptz | Optional                  |

**Used by:** `/api/employees`, `/api/punches` (enrichment), `/api/attendance`, `/api/report`, sync script (lookup by `employee_code`).

---

## office_attendance_logs

One row per punch (check-in/check-out) from BioTime.

| Column     | Type        | Notes |
|------------|-------------|--------|
| id         | uuid        | Primary key |
| employee_id| uuid        | References office_employees(id) |
| action     | text        | `checkin` or `checkout` |
| method     | text        | e.g. `biometric` |
| timestamp  | timestamptz | Punch time |

Unique on `(employee_id, action, method, timestamp)`.

**Used by:** `/api/punches`, sync script (writes from BioTime transactions).

---

## office_attendance

One row per employee per day (daily summary: first check-in, last check-out).

| Column    | Type        | Notes |
|-----------|-------------|--------|
| id        | uuid        | Primary key |
| employee_id | uuid      | References office_employees(id) |
| date      | date        | Day (YYYY-MM-DD) |
| check_in  | timestamptz | First check-in |
| check_out | timestamptz | Last check-out (must be >= check_in) |
| method    | text        | e.g. `biometric` |

Unique on `(employee_id, date)`. Check constraint: `check_out >= check_in`.

**Used by:** `/api/attendance`, `/api/report`, sync script (writes from logs).

---

## Data flow

1. **Employees:** BioTime `/personnel/api/employees/` → `POST /api/biotime/employees/load` → `office_employees`.
2. **Punches:** BioTime `/iclock/api/transactions/` → sync script → `office_attendance_logs` and `office_attendance`.
3. **Dashboard:** Reads from `office_employees`, `office_attendance_logs`, `office_attendance` via server APIs.

## Troubleshooting: Recent Punches show "—" for Code / Name / Department

- **Cause:** `office_attendance_logs.employee_id` must match `office_employees.id`. If punches were synced before employees were imported, or with different employee rows, the lookup finds no row.
- **Fix:** Run **Import Employees from BioTime** first so `office_employees` has all staff; then run sync (or wait for the 5‑min cron). New punches will then link to the correct employee and show code, name, and department.
- Ensure Supabase RLS (if any) allows the service role to read `office_employees` and `office_attendance_logs`.
