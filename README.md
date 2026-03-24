# Attendance System

Next.js + Supabase attendance and reporting system.

## Run locally

```bash
pnpm dev
```

App runs at `http://localhost:3000`.

## Environment variables

Required app env vars:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`
- `CRON_SECRET` (recommended for scheduler endpoints)

## Feature overview

### 1) Attendance reminders (construction/maintenance)

- Admin page: `/admin/attendance-reminders`
- Function: `send-attendance-reminder`
- Behavior: sends only when reminder is enabled and data conditions match

### 2) Office department daily report

- Admin tab: `Office Report Settings`
- Route used by UI test button: `POST /api/office/send-daily-report`
- Data date used in email: **yesterday (UAE timezone)** for better check-out completeness
- Includes monthly total hours for the same month
- Timezone for report formatting: `Asia/Dubai`

### 3) Office employee reports

- Admin tab: `Office Employees`
- Manual buttons per employee:
  - `Email report` -> daily employee report (yesterday, UAE)
  - `Month-end` -> full month employee report (day-by-day check-in/check-out + hours)
- Route: `POST /api/office/send-employee-report`
- Request body:
  - daily: `{ "employeeId": "..." }`
  - month-end: `{ "employeeId": "...", "reportType": "monthEnd" }`

### 4) Employee auto schedule

Configured in **Edit employee** modal:

- `Enable daily automatic report`
- `Daily report time (UAE)`
- `Enable month-end automatic report`
- `Month-end report time (UAE)`

Scheduler endpoint (manual trigger mode):

- `GET/POST /api/office/send-employee-reports-due`
- Sends due reports and writes send markers to prevent duplicates
- Supports admin session or cron header auth (`CRON_SECRET`)
- Office Employees page includes **Run due reports now** button to trigger this manually

## Database migrations (important)

Apply all migrations in `supabase/migrations`, including:

- `add_office_employee_auto_report_settings.sql`  
  Adds per-employee auto schedule fields and send markers.

## File organization (reporting-related)

- `src/app/api/office/send-daily-report/route.ts`  
  Department daily report sender (UAE-time yesterday logic).

- `src/app/api/office/send-employee-report/route.ts`  
  Manual employee report sender (`daily` and `monthEnd`).

- `src/app/api/office/send-employee-reports-due/route.ts`  
  Cron-safe auto sender for employee daily/month-end reports.

- `src/lib/officeEmployeeReport.ts`  
  Shared employee email generation and sending logic.

- `src/app/admin/components/OfficeEmployeesTab.tsx`  
  Employee table actions + edit modal schedule controls.

- `src/app/admin/attendance-reminders/office-report/services/officeReportService.ts`  
  Office Report Settings client-side service calls.

- `supabase/migrations/add_office_employee_auto_report_settings.sql`  
  Employee auto-schedule schema updates.

## Deploy notes

1. Set env vars in Vercel (Production and Preview if needed).
2. Deploy latest code.
3. Verify due-reports route returns JSON and no errors:
   - `GET /api/office/send-employee-reports-due`
