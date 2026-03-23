This is a [Next.js](https://nextjs.org/) project bootstrapped with [`create-next-app`](https://github.com/vercel/next.js/tree/canary/packages/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/basic-features/font-optimization) to automatically optimize and load Inter, a custom Google Font.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js/) - your feedback and contributions are welcome!

## Attendance reminders (Supabase)

- **Admin page:** `/admin/attendance-reminders` — enable/disable reminders per department (Construction, Maintenance) and manage recipient emails.
- **Main page:** When the selected date is today, a banner shows whether attendance is already submitted or not.
- **Edge Function:** `send-attendance-reminder` — invoked by CRON; sends email only if reminders are enabled, attendance is missing for the day, and there are recipients.

### CRON (UTC)

- Construction: daily at **15:00 UTC** (3:00 PM).
- Maintenance: daily at **8:00 PM UTC** (20:00).

To use local time, change the cron schedule in the Database (e.g. SQL Editor or Cron integration). Example for GMT+3: Construction `0 12 * * *`, Maintenance `0 17 * * *`.

### Office Daily Report (10 AM)

- **Departments:** Office Baitalshaar, Alsaqia Showroom (office employees with these departments).
- **Admin page:** Office Report Settings tab — enable/disable per department, set report time (default 10:00), add recipient emails.
- **Pipeline:** Supabase Edge Function `send-office-daily-report` (same pipeline style as `send-attendance-reminder`).
- **Test button:** “Send test report now” calls `send-office-daily-report`.
- **JWT setting:** in `supabase/config.toml`, keep `verify_jwt = false` for office functions if called from browser admin pages.
- **CRON:** Run this function daily at your required time.

### Office Employee Email Report

- **Admin page:** Office Employees tab → “Email report”.
- **Primary function:** `send-office-employee-report`.
- **Compatibility fallback:** if your deployed project still uses legacy name `send-employee-report`, the app now falls back automatically.
- **Required deploy:** deploy at least one of these two function names in the target Supabase project.
- **Manual send:** per employee via **Email report** button.
- **Auto daily/month-end send:** configure each employee in **Edit employee** modal:
  - `Enable daily automatic report` + `Daily report time`
  - `Enable month-end automatic report` + `Month-end report time`
  - all times are interpreted as **UAE** (`Asia/Dubai`)
- **Scheduler endpoint:** `POST /api/office/send-employee-reports-due`
  - call every 5-10 minutes from cron/scheduler
  - if `CRON_SECRET` is set, send it in `X-Cron-Secret` or `Authorization: Bearer <CRON_SECRET>`

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
