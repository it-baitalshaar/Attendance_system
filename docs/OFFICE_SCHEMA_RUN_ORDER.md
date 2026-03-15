# Office schema — what to run and in what order

Use this when setting up the **Office** module (BioTime sync + admin dashboard) on Supabase.

---

## If office_* tables do NOT exist yet

Run **one** of these (they create the same tables; pick the one that matches your setup):

### Option A — Single bootstrap (recommended for new DB)

Run in **Supabase Dashboard → SQL Editor**:

1. **`supabase/migrations/office_schema_bootstrap_from_biotime.sql`**  
   Creates: `office_employees`, `office_attendance_logs`, `office_attendance`, `office_qr_sessions`, RLS policies, trigger for `worked_hours`, and adds both tables to **Realtime** publication.

2. **`supabase/migrations/add_office_admin_policies.sql`**  
   Lets users with `profiles.role = 'admin'` read all office tables (needed for the admin panel).

That’s it. No need to run a separate realtime migration; it’s inside the bootstrap.

### Option B — This repo’s original migrations (if you use Supabase CLI / migration runner)

Run in order:

1. **`add_office_attendance_module.sql`** — tables + RLS (employee own-data only).
2. **`add_office_admin_policies.sql`** — admin read access.
3. **`add_office_tables_to_realtime_publication.sql`** — Realtime for `office_employees` and `office_attendance`.

---

## If office_* tables already exist

- Only add **Realtime** and **admin access** if they’re missing:
  1. **`add_office_tables_to_realtime_publication.sql`**
  2. **`add_office_admin_policies.sql`**

---

## What you get

| Need | Where it comes from |
|------|----------------------|
| Full office employees (code, name, email, phone, department, token) | `office_employees` |
| Check-in / check-out per day | `office_attendance.check_in`, `office_attendance.check_out` |
| Daily worked hours | `office_attendance.worked_hours` (auto from check_out − check_in) |
| Monthly total hours | In app or SQL: `SUM(worked_hours)` for the month from `office_attendance` |
| Audit of every punch | `office_attendance_logs` |

**Monthly total example (SQL):**

```sql
SELECT employee_id, SUM(worked_hours) AS total_hours
FROM office_attendance
WHERE date >= '2026-03-01' AND date < '2026-04-01'
GROUP BY employee_id;
```
