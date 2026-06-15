# PROJECT_INDEX — AI & Developer Map

> **Purpose:** Single-file project index for fast AI context. Read this first before editing.
> **Last indexed:** 2026-06-15 | **Stack:** Next.js 14 (App Router) + Supabase + Redux Persist + Tailwind
> **Update rule:** When you add routes, tables, migrations, or major features — append a line to §Changelog and update the relevant section.

---

## 0. Where to look (AI quick nav)

| Task | Start here |
|------|------------|
| Field worker attendance submit | `src/app/page.tsx` → `useHomeSubmit` → `Track_Attendance` + `Attendance` |
| Weekend / holiday OT defaults | `OvertimeCalendarContext` + `overtimeCalendar.ts` + `HomeCalendarDayBanner` + Admin → Departments tab |
| Admin dashboard tab | `src/app/admin/page.tsx` → tab via `?tab=` |
| Payroll / attendance reports | `payrollCalculation.ts` + `attendanceReportService.ts` + `ReportsTab` |
| Office BioTime sync | `src/app/api/office/biotime/sync/route.ts` + `scripts/office-biotime-sync.js` |
| Office employee emails | `src/lib/officeEmployeeReport.ts` + `/api/office/send-employee-report` |
| Email sending (Gmail) | `src/lib/email.ts` / `emailGmail.ts` — uses `GMAIL_USER` + `GMAIL_APP_PASSWORD` |
| Auth / role gates | `src/middleware.ts` + `profiles.role` |
| DB schema changes | `supabase/migrations/*.sql` — run in Supabase SQL Editor |
| Supabase client choice | §Supabase clients below |

---

## 1. Run & deploy

```bash
pnpm dev          # http://localhost:3000
pnpm build && pnpm start
```

**Deploy:** Vercel. **DB:** Supabase hosted. **Cron:** optional via `CRON_SECRET` + Edge Function `trigger-office-employee-reports-due`.

---

## 2. Environment variables

| Variable | Used by |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | All Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + middleware |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin API routes (bypass RLS) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | All outbound email (reminders, office, payroll) |
| `CRON_SECRET` | `/api/office/send-employee-reports-due` cron auth |

---

## 3. Auth, roles, middleware

**Flow:** `middleware.ts` → `supabase.auth.getUser()` → `profiles.role`.

| Role | Access |
|------|--------|
| `admin` | `/admin/*`, all tabs |
| `manager` / `supervisor` / `regular_user` | `/` home attendance only |
| Super user | `itbaitalshaar@gmail.com` — unlocks **Users** tab (`admin/constants.ts`) |

**Middleware rules:**
- Unauthenticated → `/login`
- Non-admin on `/admin` → `/not-authorized` (note: redirect path uses `/app/not-authorized` — page is at `/not-authorized`)
- Logged-in user with today's `Track_Attendance` row → `/already-attended` (skipped for `/admin`)
- API routes skip middleware session checks

---

## 4. Pages (routes)

| Path | File | Purpose |
|------|------|---------|
| `/` | `src/app/page.tsx` | Construction/Maintenance/Saqiya daily attendance entry |
| `/login` | `src/app/login/page.tsx` | Supabase email/password login |
| `/set-password` | `src/app/set-password/page.tsx` | First-time password set |
| `/already-attended` | `src/app/already-attended/page.tsx` | Block duplicate daily submit |
| `/not-authorized` | `src/app/not-authorized/page.tsx` | Role denied |
| `/admin` | `src/app/admin/page.tsx` | Admin hub (tabs via `?tab=`) |
| `/admin/attendance-reminders` | `src/app/admin/attendance-reminders/page.tsx` | Standalone reminders page (legacy path) |

### Admin tabs (`?tab=`)

`employees` | `officeEmployees` | `departments` | `projects` | `users`* | `attendance` | `reports` | `reminders` | `officeReport` | `profile`

\* `users` tab only for super user email.

---

## 5. API routes

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/submitAttendance` | session | Legacy/server attendance submit |
| GET | `/api/attendance-report` | admin | Attendance report JSON |
| PATCH | `/api/attendance-report-edit` | admin + service role | Edit attendance rows in reports |
| GET | `/api/salary-report` | admin | Salary + project cost report JSON |
| GET/PATCH | `/api/payroll-report/delivery` | admin | WhatsApp number settings |
| POST/DELETE | `/api/payroll-report/emails` | admin | Saved report recipient emails |
| POST | `/api/payroll-report/send-email` | admin | Server Gmail send (optional) |
| POST | `/api/payroll-report/pdf` | admin | Server PDF gen (optional) |
| GET/POST/PATCH/DELETE | `/api/admin-users` | super user | User CRUD |
| GET/POST/PATCH/DELETE | `/api/admin-projects` | admin | Project CRUD |
| POST | `/api/admin-set-password` | — | Set password for new users |
| POST | `/api/admin-update-password` | session | Admin self password change |
| POST | `/api/set-password` | — | User password set |
| POST | `/api/office/biotime/sync` | cron/secret | BioTime punch ingest → office tables |
| GET | `/api/office/report` | admin | Office report data |
| GET | `/api/office/punches` | admin | Raw punch logs |
| PATCH | `/api/office/attendance-edit` | admin | Edit office check-in/out |
| POST | `/api/office/send-daily-report` | admin | Dept daily email (UAE yesterday) |
| POST | `/api/office/send-employee-report` | admin | Manual employee daily/month-end email |
| GET/POST | `/api/office/send-employee-reports-due` | admin or `CRON_SECRET` | Auto-send due employee reports |

---

## 6. Database tables

### 6.1 Construction / Maintenance / Saqiya (field attendance)

| Table | PK | Notes |
|-------|-----|-------|
| `profiles` | `id` (auth uid) | `role`, `department`, linked to Supabase Auth |
| `Employee` | `employee_id` | `name`, `position`, `department`, `status`, `salary`, `overtime_enabled` |
| `Employee_history` | `id` | Audit log for employee edits |
| `departments` | `id` | `name`, `theme_id`, `allow_future_attendance`, `weekend_days[]`, OT toggles |
| `department_holidays` | `id` | Named dates → default holiday OT (×2.5); `department_id` NULL = all depts |
| `projects` | `id` | Project list for hour allocation |
| `Track_Attendance` | composite | Daily submit lock: one row per user per day |
| `Attendance` | `id` | Per-employee daily record: `status_attendance`, `working_hours`, `notes` |
| `Attendance_projects` | — | Per-project hours + `overtime_hours` + `overtime_type` |
| `attendance_reminder_settings` | `department` | Enable + schedule for construction reminders |
| `attendance_reminder_emails` | `id` | Reminder recipients per department |
| `payroll_report_settings` | `scope` | Default WhatsApp `+971527249586` |
| `payroll_report_emails` | `id` | Permanent payroll report recipients |

**Departments (field):** `Construction`, `Maintenance`, `Saqiya` (`src/app/constants/departments.ts`).

**Attendance statuses (common):** `Present`, `AWO`, `SL`, `A`, `Vacation`, `Weekend`, `Holiday-Work`, half-day variants.

### 6.2 Office module (BioTime / biometric)

| Table | PK | Notes |
|-------|-----|-------|
| `office_employees` | `id` (uuid) | `employee_code`, name, dept, email, auto-report schedule fields |
| `office_attendance` | `id` | One row/employee/day: `check_in`, `check_out`, `worked_hours` (DB trigger) |
| `office_attendance_logs` | `id` | Every punch (deduped); source of truth before reconcile |
| `office_employee_overrides` | — | Per-employee report overrides |
| `office_qr_sessions` | — | QR check-in sessions |
| `office_report_settings` | `department` | Daily dept report enable/schedule |
| `office_report_emails` | `id` | Dept report recipients |

**Timezone:** `Asia/Dubai` for office reports. **Reconcile RPC:** `reconcileOfficeAttendanceDay` / `DateRange` in `src/lib/officeAttendanceReconcileRpc.ts`.

**Office rules (recent):** Friday half-day, 11am cutoff, logs-first then reconcile, preserve manual `method`, don't overwrite existing `check_out` with NULL.

---

## 7. Module architecture

```
┌─────────────────────────────────────────────────────────────┐
│  FIELD ATTENDANCE (Construction / Maintenance / Saqiya)      │
│  page.tsx → Redux slice → useHomeSubmit → Supabase tables    │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  ADMIN PANEL (/admin)                                        │
│  page.tsx → hooks (data) → services (Supabase) → components  │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  REPORTS (shared payroll engine)                             │
│  payrollCalculation.ts ← attendanceReportService.ts          │
│  salaryReportService.ts → projectCostReportService.ts        │
│  ReportsTab → AttendanceReportSection / SalaryReportSection  │
└─────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│  OFFICE (BioTime)                                            │
│  biotime/sync API → office_attendance_logs → reconcile       │
│  OfficeEmployeesTab (realtime) → officeEmployeeReport.ts     │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Directory map (source)

```
src/
├── middleware.ts                 # Auth + attendance lock + admin gate
├── redux/
│   ├── slice.ts                  # Home attendance state (employees, projects, hours, OT)
│   ├── store.ts                  # Redux + persist (department only)
│   └── provider.tsx
├── lib/                          # Shared server/client utilities
│   ├── supabase.ts               # Browser client (typo: createSupabbaseFrontendClient)
│   ├── supabaseAppRouterClient.ts  # Server components + API routes
│   ├── supabaseReqResClient.ts   # Middleware cookies
│   ├── payrollPeriod.ts          # Payroll month 26→25
│   ├── payrollCalculation.ts     # (re-exported from admin/services)
│   ├── fetchAttendanceReportForApi.ts / fetchSalaryReportForApi.ts
│   ├── officeEmployeeReport.ts   # Office email report builder
│   ├── officeAttendanceReconcileRpc.ts
│   ├── email.ts / emailGmail.ts  # Nodemailer Gmail
│   ├── payrollReportWhatsApp.ts / payrollReportMailto.ts
│   ├── attendanceReportEmailHtml.ts / salaryReportEmailHtml.ts
│   ├── capturePrintAreaPdf.ts / reportPdf/
│   └── projectDisplayName.ts
└── app/
    ├── page.tsx                  # Home attendance UI
    ├── layout.tsx                # Fonts + Redux provider
    ├── login/ set-password/ already-attended/ not-authorized/
    ├── hooks/                    # useHomeAuth, useHomePageState, useHomeSubmit, useDepartmentTheme
    ├── components/home/          # Home page sub-components
    ├── components/theme/         # Al Saqiya branding, GeometricDivider
    ├── component/                # Legacy shared UI (EmployeeCard, OvertimeHoursFields, etc.)
    ├── constants/                # departments, themes, overtime, workerCardReportAr
    ├── services/homeService.ts   # Fetch employees for home
    ├── lib/loadAttendanceForDateAndDepartment.ts
    ├── utils/SubmitAttendance.ts
    ├── api/                      # All route.ts handlers (see §5)
    └── admin/
        ├── page.tsx              # Tab shell
        ├── constants.ts          # SUPER_USER_EMAIL
        ├── types/                # admin, attendanceReport, salaryReport, projectCostReport
        ├── hooks/                # One hook per tab/feature (see §9)
        ├── services/             # Supabase CRUD + report builders (see §10)
        ├── components/           # Tab UIs + reports/ + attendance/ + employees/
        ├── utils/adminAttendanceUtils.ts
        └── attendance-reminders/ # Reminders + office-report sub-module

supabase/
├── migrations/                   # SQL migrations (see §11)
├── functions/
│   ├── send-office-daily-report/
│   ├── send-office-employee-report/
│   └── trigger-office-employee-reports-due/  # Calls app cron route
└── config.toml

scripts/
├── office-biotime-sync.js        # External BioTime → Supabase sync
├── office-biotime-sync-employees.js
└── bootstrap-super-admin-password.js

docs/
├── PROJECT_INDEX.md              # ← this file
├── OFFICE_SCHEMA_RUN_ORDER.md
├── BIOTIME_TO_SUPABASE_OFFICE_SYNC_SPEC.md
└── OFFICE_EMPLOYEES_SYNC_RULES.md
```

---

## 9. Admin hooks index

| Hook | Tab / feature |
|------|---------------|
| `useAdminAuth` | Auth, tab state, profile password |
| `useEmployeeManagement` | Employees tab CRUD + manage modal |
| `useEmployeeFilters` | Employee list filters |
| `useDepartmentManagement` | Departments tab |
| `useProjectManagement` | Projects tab |
| `useUserManagement` | Users tab (super user) |
| `useAttendanceDashboard` | Attendance tab list/filters |
| `useLeaveReportDashboard` | Leave report in attendance tab |
| `useAttendanceReport` | Reports → attendance |
| `useSalaryReport` | Reports → salary/project cost |
| `useOfficeEmployeesRealtime` | Office employees live dashboard |
| `useRemindersData` / `useRemindersAuth` | Reminders tab |
| `useOfficeReportData` | Office report settings |
| `useDepartmentFutureAttendance` | Home — future date picker gate |
| `OvertimeCalendarProvider` / `useOvertimeCalendarContext` | Home — weekend/holiday OT defaults from dept calendar |

---

## 10. Admin services index

| Service | Responsibility |
|---------|----------------|
| `employeeService` | Employee CRUD |
| `employeeHistoryService` | `Employee_history` |
| `departmentService` | Departments CRUD + employee counts + `weekend_days` |
| `holidayService` | `department_holidays` CRUD (admin) |
| `projectService` | Projects CRUD |
| `userService` | Users via `/api/admin-users` |
| `profileService` | Current admin profile/password |
| `attendanceService` | Admin attendance queries |
| `attendanceReportService` | `buildAttendanceReport()` — day cards, OT buckets |
| `payrollCalculation` | **Single source of payroll math** (hourly rate, OT multipliers) |
| `salaryReportService` | `buildSalaryReport()` |
| `projectCostReportService` | Project pivot + reconciliation summary |
| `payrollReportDeliveryService` | Saved emails + WhatsApp + send helpers |
| `reportService` | Leave report fetch |
| `remindersService` | `attendance_reminder_*` tables |
| `officeReportService` | `office_report_*` tables |

---

## 11. Migrations index

Run in Supabase SQL Editor unless using CLI `db push`. See `docs/OFFICE_SCHEMA_RUN_ORDER.md` for office bootstrap order.

| File | Adds / changes |
|------|----------------|
| `office_schema_bootstrap_from_biotime.sql` | Full office schema + realtime (new DB) |
| `add_office_attendance_module.sql` | Office tables (CLI path) |
| `add_office_admin_policies.sql` | Admin RLS read on office tables |
| `add_office_tables_to_realtime_publication.sql` | Realtime publication |
| `add_office_attendance_logs_to_realtime.sql` | Logs realtime |
| `add_office_daily_report.sql` | Office dept report settings |
| `add_office_employee_auto_report_settings.sql` | Per-employee auto email schedule |
| `add_office_employee_management_columns.sql` | Office employee admin fields |
| `add_office_employee_personal_email.sql` | Personal email column |
| `add_office_employee_overrides.sql` | Report overrides |
| `rename_office_departments_to_biotime_names.sql` | Dept name alignment |
| `update_office_reconcile_punch_rules.sql` | Friday half-day, 11am rules |
| `20260402120000_office_reconcile_attendance_from_logs.sql` | Reconcile from logs RPC |
| `add_employee_salary.sql` | Employee salary column |
| `add_employee_salary_and_history.sql` | Salary + `Employee_history` |
| `add_employee_overtime_enabled.sql` | Per-employee OT toggle |
| `add_department_theme_id.sql` | Dept UI themes |
| `add_department_allow_future_attendance.sql` | Future date submit flag |
| `add_department_overtime_type_toggles.sql` | Dept-level OT type enable |
| `add_department_weekend_days.sql` | `departments.weekend_days` (0=Sun…6=Sat) for weekend OT default |
| `add_department_holidays.sql` | `department_holidays` table + RLS |
| `add_attendance_projects_overtime_type.sql` | `overtime_type` on project rows |
| `add_payroll_report_delivery.sql` | `payroll_report_emails` + settings |

---

## 12. Payroll business rules (do not duplicate logic)

**Source of truth:** `src/app/admin/services/payrollCalculation.ts` + `attendanceReportService.ts`

| Rule | Value |
|------|-------|
| Hourly rate | `monthly_salary ÷ (calendar_days_in_month × 8)` using report `from` date |
| Base pay | Σ `working_hours × hourly_rate` per day |
| OT multipliers | normal ×1.25, holiday ×1.5, public_holiday ×2.5 (`constants/overtime.ts`) |
| OT bucketing | From `Attendance_projects.overtime_type` + attendance status fallback |
| Payroll period default | 26th prev month → 25th selected month (`lib/payrollPeriod.ts`) |
| Absent codes (no base) | `AWO`, `SL`, `A` |

**Report delivery:** UI opens mailto/WhatsApp; user attaches PDF from Print. Saved emails in `payroll_report_emails`.

---

## 13. Supabase clients (which to use)

| Function | File | When |
|----------|------|------|
| `createSupabbaseFrontendClient()` | `lib/supabase.ts` | Client components |
| `createSupabaseServerClient()` | `lib/supabaseAppRouterClient.ts` | API routes (cookie session) |
| `createSupabaseServerComponentClient()` | same | Server components |
| `createSupabaseReqResClient()` | `lib/supabaseReqResClient.ts` | Middleware only |
| Service role | inline in API routes | Admin edits bypassing RLS (`SUPABASE_SERVICE_ROLE_KEY`) |

---

## 14. Redux state (home page)

**Persisted:** `department` only (`redux/store.ts`).

**Key actions:** `setDepartment`, `setEmployeeData`, `setAttendanceEntry`, `addProjectToEmployee`, `addHours`, `sum_hours`, `overtime_hours`, `setEmployeeProjectsFromServer`.

**Submit flow:** `useHomeSubmit` → inserts `Track_Attendance` (lock) + `Attendance` + `Attendance_projects`.

---

## 15. Edge functions & scripts

| Asset | Purpose |
|-------|---------|
| `supabase/functions/trigger-office-employee-reports-due` | Cron hits `/api/office/send-employee-reports-due` |
| `supabase/functions/send-office-daily-report` | Legacy/alternate daily report trigger |
| `supabase/functions/send-office-employee-report` | Legacy employee report |
| `scripts/office-biotime-sync.js` | Pull BioTime punches → call sync API or direct DB |
| `scripts/office-biotime-sync-employees.js` | Sync employee master from BioTime |
| `scripts/bootstrap-super-admin-password.js` | One-time super admin setup |

Spec: `docs/BIOTIME_TO_SUPABASE_OFFICE_SYNC_SPEC.md`

---

## 16. Changelog (recent git — update when merging features)

| Date (approx) | Commit theme | Area |
|---------------|--------------|------|
| 2026-06-15 | Fix OT reset on loadAttendance + per-project calendar sync hook | `loadAttendanceForDateAndDepartment`, `useProjectOvertimeCalendarSync` |
| 2026-06-15 | OT defaults fixed: holiday → public holiday OT, weekend → weekend OT | `resolveDefaultOvertimeType`, `CalendarOvertimeDefaultsSync` |
| 2026-06-15 | Holiday name shown on attendance home when admin date matches | `HomeCalendarDayBanner`, `holidayNameForDate` in calendar context |
| 2026-06-15 | Weekend/holiday calendar → auto OT defaults + admin holidays | `overtimeCalendar.ts`, `OvertimeCalendarContext`, `department_holidays`, Departments tab |
| 2026-06-15 | AI project index + post-task update rules | `docs/PROJECT_INDEX.md`, `.cursor/rules/`, `AGENTS.md`, `CLAUDE.md` |
| 2026-06 | Email + WhatsApp share for reports | `PayrollReportDeliveryPanel`, payroll APIs |
| 2026-06 | OT overlay / duplicate hours fix | `attendanceReportService`, report UI |
| 2026-06 | PDF name header | `capturePrintAreaPdf` / report PDF |
| 2026-06 | OT calculation fixes | `payrollCalculation`, `bucketOvertimeHours` |
| 2026-06 | Project cost reports | `projectCostReportService`, `SalaryReportSection` |
| 2026-06 | Half-day fixes | attendance report + office reconcile |
| 2026-06 | AWO deduction / vacation | `summarizeAttendanceDays` |
| 2026-06 | Report inline editing | `/api/attendance-report-edit` |
| 2026-05 | Office reconcile: logs-first, out-of-order punches | `biotime/sync`, reconcile RPC |
| 2026-05 | Friday half-day + 11am cutoff | `update_office_reconcile_punch_rules.sql` |
| 2026-05 | Office check-in/out edit in monthly report | `officeEmployeeReport`, attendance-edit API |
| 2026-05 | Service role route for attendance edit (RLS bypass) | `attendance-report-edit` |

---

## 17. Conventions for AI edits

1. **Payroll math:** Never reimplement in UI — extend `payrollCalculation.ts` or `buildAttendanceReport`.
2. **New admin tab:** Add to `VALID_TABS` in `admin/page.tsx`, create hook + service + component.
3. **New API route:** Use `createSupabaseServerClient`; admin routes check `profiles.role === 'admin'`.
4. **New DB column:** Add migration SQL in `supabase/migrations/` + update service types + §6 table entry here.
5. **Office punch logic:** Logs insert first, then reconcile RPC — do not write `worked_hours` manually.
6. **Email:** All features share `GMAIL_USER` / `GMAIL_APP_PASSWORD` — no per-feature mail env vars.
7. **Naming:** Supabase tables use mixed case (`Employee`, `Attendance`) for legacy field module; `office_*` lowercase.
8. **Components:** Prefer `src/app/components/` for new home UI; `src/app/component/` is legacy (still used).

---

## 18. AI agent entry points (auto-loaded by editors)

| File | Tool |
|------|------|
| `.cursor/rules/project-index.mdc` | Cursor (`alwaysApply: true`) — read index before, update after every task |
| `AGENTS.md` | Cursor agents, Codex, generic AI tools |
| `CLAUDE.md` | Claude Code / Claude in VS Code |
| `.github/copilot-instructions.md` | GitHub Copilot in VS Code |

All point here first. Keep this file updated; rules stay short and link to §0–§20.

## 19. Related docs

| Doc | Contents |
|-----|----------|
| `README.md` | User-facing feature guide, env setup, workflows |
| `docs/OFFICE_SCHEMA_RUN_ORDER.md` | Which migrations to run for office module |
| `docs/BIOTIME_TO_SUPABASE_OFFICE_SYNC_SPEC.md` | BioTime field mapping + table columns |
| `docs/OFFICE_EMPLOYEES_SYNC_RULES.md` | Employee sync rules |
| `scripts/README-office-biotime-sync.md` | Running BioTime sync script |
| `supabase/migrations/README.md` | Employee salary/history migration notes |

---

## 20. Maintenance — required after every AI task

**Rule:** Every agent session that edits this repo must end with an index pass.

### Closing checklist

1. List what changed (files, routes, tables, behavior).
2. Update the matching sections (only what changed):

| Change | Section(s) |
|--------|------------|
| API route | §5 + §8 |
| Page / admin tab | §4 + §8 (+ §9 if new hook) |
| DB table / column | §6 + §11 |
| Hook | §9 |
| Service | §10 |
| Env var | §2 |
| Payroll / office rule | §12 or §6 |
| Migration file | §11 |
| Module layout | §7 + §8 |

3. Add one row to **§16 Changelog**.
4. Bump **Last indexed** date at the top of this file.
5. In the final user message: state updated sections or "index unchanged."

### When index can stay unchanged

Typos, comments-only, or pure styling with no new files/routes/tables — note "index unchanged" explicitly; do not skip the check.

**Token tip:** Load this file + 1–3 targets from §0 — avoid reading whole `admin/page.tsx` or `redux/slice.ts` unless editing them.
