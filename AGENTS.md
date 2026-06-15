# Agent instructions — Attendance System

## Before every task

Read **`docs/PROJECT_INDEX.md`** first. Use §0 to find the minimal file set.

## After every task (mandatory)

Do not finish without updating the index:

| Change type | Update in `docs/PROJECT_INDEX.md` |
|-------------|-----------------------------------|
| New/changed API route | §5, §8 |
| New/changed page or admin tab | §4, §8, §9 |
| New/changed DB table/column | §6, §11 |
| New hook or service | §9 or §10 |
| New env var | §2 |
| Payroll / office rule change | §12 or §6 + §16 |
| New migration | §11 + §16 |
| Any other structural change | Relevant section + §16 |

Always add a **§16 changelog** row and bump **Last indexed** at the top when you edit the index.

State in your final reply: which sections you updated, or "index unchanged."

## Stack

Next.js 14 (App Router) · Supabase · Redux Persist · Tailwind · Vercel.

## Non-negotiable conventions

| Area | Rule |
|------|------|
| Payroll | `payrollCalculation.ts` / `buildAttendanceReport` — never duplicate math in UI |
| Office BioTime | Logs first → reconcile RPC (`officeAttendanceReconcileRpc.ts`) |
| Email | `GMAIL_USER`, `GMAIL_APP_PASSWORD` |
| New DB column | migration + services + index §6/§11 |
| New admin tab | `VALID_TABS` + hook + service + component |

## Docs map

| File | Use for |
|------|---------|
| `docs/PROJECT_INDEX.md` | Architecture (read first, update last) |
| `README.md` | Features, env, user workflows |
| `docs/OFFICE_SCHEMA_RUN_ORDER.md` | Office migration order |
| `docs/BIOTIME_TO_SUPABASE_OFFICE_SYNC_SPEC.md` | BioTime mapping |
