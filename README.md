# Attendance System

Next.js + Supabase attendance and reporting system.

**Last updated:** 2026-06-01

## Run locally

```bash
pnpm dev
```

App runs at `http://localhost:3000`.

## Environment variables

Required app env vars:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server/admin API routes |
| `GMAIL_USER` | Gmail account for all outbound email (see below) |
| `GMAIL_APP_PASSWORD` | Gmail app password (not your login password) |
| `CRON_SECRET` | Recommended for scheduler endpoints |

### Email (one Gmail setup for everything)

**Salary report, attendance report, construction/maintenance reminders, and office reports all use the same Gmail credentials:**

- `GMAIL_USER`
- `GMAIL_APP_PASSWORD`

Use the same values you already configured for **construction/maintenance attendance reminders**. No separate mail env vars are required for payroll reports.

If email send fails, verify both vars are set in `.env` (local) and in Vercel (production).

## Feature overview

### 1) Attendance reminders (construction/maintenance)

- Admin page: `/admin/attendance-reminders`
- Function: `send-attendance-reminder`
- Behavior: sends only when reminder is enabled and data conditions match
- Email: `GMAIL_USER` / `GMAIL_APP_PASSWORD`

### 2) Attendance Report (Admin → Reports)

- **Path:** Admin → Reports tab → **Attendance Report**
- **API:** `GET /api/attendance-report?from=&to=[&department=][&employee_id=]`
- **Payroll rules:** hourly rate = monthly salary ÷ (calendar month days × 8) from report start date; base = sum of daily work hours × rate; overtime × 1.25 / 1.5 / 2.5
- **Output:** per-employee cards, overall summary table, CSV export, print/PDF
- **Send report:** saved recipient emails + WhatsApp (see §6)

### 3) Salary & Project Cost Report (Admin → Reports)

- **Path:** Admin → Reports tab → **Salary & Project Cost Report**
- **API:** `GET /api/salary-report?from=&to=[&department=][&employee_id=]`
- **Payroll rules:** identical to Attendance Report (shared `payrollCalculation.ts` + `buildAttendanceReport` for days/hours)
- **Payroll period (default):** 26th of previous calendar month → 25th of selected payroll month (e.g. May 2026 → 2026-04-26 … 2026-05-25)
- **Custom date range:** optional checkbox for any from/to dates
- **Views:**
  - **By Employee** — salary card + project cost breakdown per employee
  - **By Project** — cost per project with employee breakdown; optional project filter
- **Overall Summary:** salary vs project cost reconciliation (work hrs vs logged hrs, cost variance); fix mismatches in attendance project hours
- **Print/PDF:** overall summary first; project cost totals table starts on the next printed page
- **Send report:** same saved emails and WhatsApp as attendance (see §6)

### 4) Office department daily report

- Admin tab: `Office Report Settings`
- Route used by UI test button: `POST /api/office/send-daily-report`
- Data date used in email: **yesterday (UAE timezone)** for better check-out completeness
- Includes monthly total hours for the same month
- Timezone for report formatting: `Asia/Dubai`
- Email: same `GMAIL_USER` / `GMAIL_APP_PASSWORD`

### 5) Office employee reports

- Admin tab: `Office Employees`
- Manual buttons per employee:
  - `Email report` → daily employee report (yesterday, UAE)
  - `Month-end` → full month employee report (day-by-day check-in/check-out + hours)
- Route: `POST /api/office/send-employee-report`
- Request body:
  - daily: `{ "employeeId": "..." }`
  - month-end: `{ "employeeId": "...", "reportType": "monthEnd" }`

### 6) Payroll report email & WhatsApp delivery

Shared by **Attendance Report** and **Salary & Project Cost Report**.

**Database (apply migration):**

- `supabase/migrations/add_payroll_report_delivery.sql`
  - `payroll_report_emails` — permanent recipient list (add/delete in UI)
  - `payroll_report_settings` — default WhatsApp: `+971527249586` (editable, saved in DB)

**Admin UI (on each report, after generating):**

- **Saved recipient emails** — add once, reused every month
- **WhatsApp recipient** — default `+971527249586`; change and **Save number**
- **Open email** — opens your email app with saved recipients, subject, and a short summary (you attach the PDF from **Print / Save as PDF**)
- **Open WhatsApp** — opens `wa.me` with a pre-filled summary (you attach the PDF yourself)

**API:**

- `GET /api/payroll-report/delivery` — load emails + WhatsApp number
- `PATCH /api/payroll-report/delivery` — save WhatsApp number
- `POST /api/payroll-report/emails` — add email
- `DELETE /api/payroll-report/emails?id=` — remove email
- `POST /api/payroll-report/send-email` — optional server-side Gmail send (not used by the admin UI; UI opens the local email app instead)
- `POST /api/payroll-report/pdf` — optional server-side PDF (not used by the admin UI; use **Print / Save as PDF**)

**Note:** Email and WhatsApp buttons only open compose windows. Save the PDF with **Print / Save as PDF**, then attach it before sending.

### 7) Employee auto schedule

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

Supabase automatic trigger (optional):

- Edge Function: `trigger-office-employee-reports-due`
- This function calls your app route: `/api/office/send-employee-reports-due`
- Configure Edge Function secrets in Supabase:
  - `APP_BASE_URL` (example: `https://baitalshaar.vercel.app`)
  - `CRON_SECRET` (must match Vercel `CRON_SECRET`)
- Schedule from Supabase Cron (example every 5 minutes) to call:
  - `https://<project-ref>.functions.supabase.co/trigger-office-employee-reports-due`
- Keep `verify_jwt = false` for this trigger function in `supabase/config.toml` when using cron without auth token.

## Database migrations (important)

Apply all migrations in `supabase/migrations`, including:

| Migration | Purpose |
|-----------|---------|
| `add_office_employee_auto_report_settings.sql` | Per-employee auto schedule fields and send markers |
| `add_office_daily_report.sql` | Office daily report settings and emails |
| `add_payroll_report_delivery.sql` | **Payroll report saved emails + WhatsApp number** |
| `add_employee_salary.sql` / `add_employee_salary_and_history.sql` | Employee salary for payroll reports |

After pulling new code, run new SQL files in the Supabase SQL editor (or your migration workflow) before using report email/WhatsApp features.

## File organization (reporting-related)

### Construction / maintenance reminders

- `src/app/admin/attendance-reminders/` — reminder settings and emails
- `supabase/functions/send-attendance-reminder/` — reminder edge function

### Attendance & salary reports

- `src/app/admin/components/reports/AttendanceReportSection.tsx` — attendance report UI + delivery panel
- `src/app/admin/components/reports/SalaryReportSection.tsx` — salary/project report UI + delivery panel
- `src/app/admin/components/reports/PayrollReportDeliveryPanel.tsx` — shared email/WhatsApp controls
- `src/app/admin/services/payrollCalculation.ts` — shared payroll rules (attendance + salary)
- `src/app/admin/services/salaryReportService.ts` — salary + project cost build
- `src/app/admin/services/projectCostReportService.ts` — project pivot + reconciliation summary
- `src/lib/payrollPeriod.ts` — payroll month 26→25 helpers
- `src/lib/salaryReportEmailHtml.ts` / `src/lib/attendanceReportEmailHtml.ts` — email HTML
- `src/lib/payrollReportWhatsApp.ts` — WhatsApp `wa.me` links
- `src/app/api/attendance-report/route.ts` — attendance report data
- `src/app/api/salary-report/route.ts` — salary report data
- `src/app/api/payroll-report/` — delivery settings + send email

### Office reports

- `src/app/api/office/send-daily-report/route.ts` — department daily report (UAE yesterday)
- `src/app/api/office/send-employee-report/route.ts` — manual employee report
- `src/app/api/office/send-employee-reports-due/route.ts` — cron-safe auto sender
- `src/lib/officeEmployeeReport.ts` — shared employee email logic
- `src/lib/email.ts` — Gmail sender (`GMAIL_USER` / `GMAIL_APP_PASSWORD`)
- `supabase/functions/trigger-office-employee-reports-due/index.ts` — Edge trigger for due reports
- `src/app/admin/components/OfficeEmployeesTab.tsx` — employee actions + schedule
- `src/app/admin/attendance-reminders/office-report/services/officeReportService.ts` — office report settings

## Monthly payroll report workflow

1. Admin → **Reports** → **Salary & Project Cost Report**
2. Select **payroll month** (or custom dates) and filters → **Generate Salary Report**
3. Review **Overall Summary** — salary total should match attendance report; fix project hours in attendance if variance shows
4. **Send email now** to saved recipients, or **Open in WhatsApp** and send from your phone
5. **Print / Save as PDF**, then **Open email** or **Open WhatsApp** and attach the file

## Deploy notes

1. Set env vars in Vercel (Production and Preview if needed), including `GMAIL_USER` and `GMAIL_APP_PASSWORD` (same as construction reminders).
2. Apply `add_payroll_report_delivery.sql` on production Supabase if not already applied.
3. Deploy latest code.
4. In Admin → Reports, add permanent recipient email(s) once.
5. Verify due-reports route if using office auto reports:
   - `GET /api/office/send-employee-reports-due`
