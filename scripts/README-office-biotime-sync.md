## Office BioTime Sync (Option 1: run locally)

Use this when you have a PC/server that can access the BioTime local API (LAN) and also has internet access to Supabase.

### 1) Setup

1. Install **Node.js 18+**
2. Copy env example:
   - Copy `scripts/office-biotime-sync.env.example` → `.env`
   - Fill `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BIOTIME_BASE_URL`

### 2) Install dependencies (one time)

From the repo root:

```bash
npm install
```

### 3) Run once (test)

Windows PowerShell:

```powershell
node scripts/office-biotime-sync.js
```

### 4) Run every 5 minutes (Windows Task Scheduler)

Create a task that runs:

- **Program/script**: `node`
- **Arguments**: `scripts/office-biotime-sync.js`
- **Start in**: `C:\path\to\Attendance_system`

Recommended settings:
- Run whether user is logged in or not
- Run with highest privileges
- Trigger: Daily → Repeat task every **5 minutes** for **24 hours**

### Notes

- This script relies on the DB unique constraint in `office_attendance_logs` to **avoid duplicates**.
- If BioTime returns a different JSON shape, set `BIOTIME_JSON_ROOT` in `.env` to `array`, `data`, or `results`.

