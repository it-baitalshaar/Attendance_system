# Agent instructions — Attendance System

**Read `docs/PROJECT_INDEX.md` first** before any task in this repository.

## Quick start

1. Open `docs/PROJECT_INDEX.md` and use **§0 Where to look** to find the right files.
2. Read only those files plus direct dependencies — avoid whole-repo exploration.
3. When you ship changes that affect structure, update `docs/PROJECT_INDEX.md` (relevant section + §16 changelog).

## Stack

Next.js 14 (App Router) · Supabase · Redux Persist · Tailwind · deployed on Vercel.

## Non-negotiable conventions

| Area | Rule |
|------|------|
| Payroll | Edit `payrollCalculation.ts` / `buildAttendanceReport` — never duplicate math in UI |
| Office BioTime | Logs first → reconcile RPC (`officeAttendanceReconcileRpc.ts`) |
| Email | Single Gmail config: `GMAIL_USER`, `GMAIL_APP_PASSWORD` |
| New DB column | Add `supabase/migrations/*.sql` + update services + index §6/§11 |
| New admin tab | `VALID_TABS` in `admin/page.tsx` + hook + service + component |

## Docs map

| File | Use for |
|------|---------|
| `docs/PROJECT_INDEX.md` | Architecture, routes, tables, services (primary) |
| `README.md` | Features, env vars, user workflows |
| `docs/OFFICE_SCHEMA_RUN_ORDER.md` | Office migration order |
| `docs/BIOTIME_TO_SUPABASE_OFFICE_SYNC_SPEC.md` | BioTime field mapping |
