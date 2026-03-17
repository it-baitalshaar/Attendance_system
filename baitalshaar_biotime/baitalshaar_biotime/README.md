# BioTime Dashboard & Sync

Node.js app that syncs **BioTime** device attendance data to **Supabase** and serves a dashboard to view employees, punches, daily attendance, and monthly reports. Designed to work with an external **attendance website** that can read the same data (and Realtime) from Supabase.

---

## What it does

- **Sync:** Fetches transactions (check-in/check-out) from the BioTime API and writes them to Supabase (`office_attendance_logs`, `office_attendance`). Runs on a schedule (e.g. every 5 minutes) and can be triggered manually.
- **Dashboard:** Web UI to view sync status, employees, recent punches, live punches from BioTime, last check-in/check-out per employee, attendance by date, and a monthly report.
- **API:** REST endpoints for employees, punches, attendance by date, last attendance per employee, live recent from BioTime, and monthly report — so an attendance website can use the same data.
- **Realtime:** Office tables can be added to Supabase Realtime so the attendance website sees new punches as they are synced.

---

## Requirements

- **Node.js** 18+ (ESM)
- **Supabase** project with the Office schema (see [Setup](#setup))
- **BioTime** device or API reachable from this server (HTTP; JWT or Token auth)

---

## Setup

### 1. Clone and install

```bash
cd baitalshaar_biotime
npm install
```

### 2. Environment

Copy `.env.example` to `.env` (or create `.env`) and set:

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (for sync and API) |
| `BIOTIME_BASE_URL` | Yes | BioTime API base URL (e.g. `http://192.168.1.50:80` or `http://localhost:8080`) |
| `BIOTIME_USERNAME` | Yes* | BioTime API username (*if not using pre-set token) |
| `BIOTIME_PASSWORD` | Yes* | BioTime API password |
| `BIOTIME_SYNC_TARGET` | No | Set to `office` (default for this project) |
| `BIOTIME_TRANSACTION_PATH` | No | Transaction path (e.g. `/iclock/api/transactions/`); default `/att/api/transactionReport/` |
| `PORT` | No | Server port (default `5173`) |

Optional: `BIOTIME_JSON_ROOT` (e.g. `data` or `results`), `BIOTIME_FULL_SYNC=1` (full sync once), `BIOTIME_DEBUG_INVALID=1` (log sample invalid transactions).

### 3. Supabase schema

Run the Office schema in Supabase (SQL Editor) so the sync and API have the right tables:

- **New project:** Use **`supabase/migrations/office_schema_bootstrap_from_biotime.sql`** (creates `office_employees`, `office_attendance_logs`, `office_attendance`, `office_qr_sessions`, RLS, trigger for `worked_hours`, and Realtime).
- **Existing project:** See **`docs/OFFICE_SCHEMA_SETUP.md`** for order and options (e.g. add only Realtime + admin policies).

Then add tables to Realtime so the attendance website can subscribe to new punches:

- **`supabase/migrations/add_office_tables_to_realtime_publication.sql`** — adds `office_employees`, `office_attendance`, and **`office_attendance_logs`** (every transaction) to `supabase_realtime`.

### 4. Import employees (one-time)

Before sync can match punches to people, load employees from BioTime into Supabase:

1. Start the server: `npm run dev`
2. Open the dashboard (e.g. `http://localhost:5173`)
3. Click **Import Employees from BioTime**

After that, sync will map BioTime `employee_code` to `office_employees.id` and write to `office_attendance_logs` and `office_attendance`.

---

## Run

### Development / server

```bash
npm run dev
```

- Server: `http://localhost:5173` (or your `PORT`)
- Dashboard: open the same URL in a browser
- Sync runs automatically every 5 minutes; or trigger once: **Sync now** in the UI or `GET http://localhost:5173/sync`
- Last sync result: `GET http://localhost:5173/status`

### Sync only (CLI)

```bash
npm run sync
# or
npm run sync:office
```

Uses `.env` and writes to Supabase only (no server). Use after setting `SUPABASE_*` and `BIOTIME_*`.

### Production

```bash
npm start
```

Use a process manager (e.g. PM2) and keep `.env` secure (no commit).

---

## Dashboard

| Section | Description |
|---------|-------------|
| **Sync Status** | Last run time, success/fail, and stats (synced, unknown, invalid, duplicate). |
| **Employees** | From Supabase; code, name, department. |
| **Recent Punches** | Latest punches from DB (synced data). |
| **Live from BioTime** | Fetches last N minutes directly from the device (Real-Time Monitoring). |
| **Last check-in / check-out** | One row per employee with latest check-in and check-out. |
| **Check-in / Check-out (by date)** | Pick a date; shows daily attendance and hours. |
| **Monthly Report** | Current month (or range) with per-employee daily hours and total. |

Data is cached in the browser (localStorage) so reopening the page shows last data without API calls until you click **Refresh All**.

---

## API (for attendance website or other clients)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/employees` | List employees (code, name, department). |
| GET | `/api/punches` | List punches (optional `start`, `end`). |
| GET | `/api/attendance?date=YYYY-MM-DD` | Daily attendance for one date. |
| GET | `/api/attendance/last` | Last check-in and check-out per employee. |
| GET | `/api/biotime/recent?minutes=60` | Recent punches from BioTime device (live). |
| GET | `/api/report` | Monthly report (optional `start`, `end`). |
| GET | `/sync` | Trigger sync (returns last run result). |
| GET | `/status` | Last sync status and stats. |
| POST | `/api/biotime/employees/load` | Import employees from BioTime into Supabase. |

See **`docs/BIOTIME_DATA_FOR_ATTENDANCE_WEBSITE.md`** for request/response shapes, date rules, and Realtime subscription so the attendance website can display the same data without errors.

---

## Project structure

```
baitalshaar_biotime/
├── server.js              # Express app: API, dashboard static, sync trigger, cron
├── package.json
├── .env                    # Not committed; copy from .env.example
├── public/
│   └── index.html         # Dashboard UI
├── scripts/
│   ├── office-biotime-office-sync.js   # BioTime → Supabase office sync (main)
│   ├── office-biotime-sync.js          # Generic sync variant
│   └── get-auth-token.js               # Get BioTime auth token (CLI)
├── supabase/
│   └── migrations/
│       ├── office_schema_bootstrap_from_biotime.sql  # Full office schema + RLS + Realtime
│       ├── add_office_tables_to_realtime_publication.sql
│       └── office_schema.sql           # Minimal office tables (no RLS)
└── docs/
    ├── BIOTIME_SYNC_SPEC.md            # Sync script spec (fields, flow, env)
    ├── BIOTIME_DATA_FOR_ATTENDANCE_WEBSITE.md  # API + Realtime for attendance website
    ├── OFFICE_SCHEMA_SETUP.md          # What to run in Supabase and in what order
    └── SUPABASE_SCHEMA.md             # Table reference
```

---

## Docs

| Doc | Purpose |
|-----|--------|
| [BIOTIME_SYNC_SPEC.md](docs/BIOTIME_SYNC_SPEC.md) | What we fetch from BioTime, validation, invalid/unknown counts, Realtime. |
| [BIOTIME_DATA_FOR_ATTENDANCE_WEBSITE.md](docs/BIOTIME_DATA_FOR_ATTENDANCE_WEBSITE.md) | Give this to the attendance website: API shapes, Realtime, date rules, pitfalls. |
| [OFFICE_SCHEMA_SETUP.md](docs/OFFICE_SCHEMA_SETUP.md) | Supabase: which migrations to run and in what order. |
| [SUPABASE_SCHEMA.md](docs/SUPABASE_SCHEMA.md) | Table reference (office_employees, office_attendance_logs, office_attendance). |

---

## Troubleshooting

- **Sync: "fetch failed"** — Server cannot reach BioTime. Check `BIOTIME_BASE_URL`, network, and device.
- **All transactions "unknown"** — Run **Import Employees from BioTime** so `office_employees` has rows; sync matches by `employee_code`.
- **Many "invalid"** — Transactions with `punch_state` other than 0 (check-in) or 1 (check-out) are skipped. Set `BIOTIME_DEBUG_INVALID=1` and run sync to see sample invalid rows; see [BIOTIME_SYNC_SPEC.md §7](docs/BIOTIME_SYNC_SPEC.md).
- **No data for a date** — Ensure sync has run and that there are punches for that date; try **Sync now** then **Refresh All**. For old dates, a one-time full sync (`BIOTIME_FULL_SYNC=1`) may be needed.
- **Attendance website not seeing Realtime** — Run `add_office_tables_to_realtime_publication.sql` and include **`office_attendance_logs`** so every new punch is broadcast.

---

## License

Use as needed for the project.
