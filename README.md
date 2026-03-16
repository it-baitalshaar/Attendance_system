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

### Gmail (reminders + office reports)

**Same Gmail config for construction/maintenance reminders and office reports.**

In your **Next.js** `.env` (or Vercel/host env), set:

- `GMAIL_USER` — Gmail address used to send emails (e.g. `itbaitalshaar@gmail.com`).
- `GMAIL_APP_PASSWORD` — [Google App Password](https://support.google.com/accounts/answer/185833) (16-character). Requires 2-Step Verification.

Office daily report and “Email report” to each employee use this same Gmail config (no Resend). If your construction/maintenance reminders already send via Gmail, use the same `GMAIL_USER` and `GMAIL_APP_PASSWORD` in this app’s environment.

### CRON (UTC)

- Construction: daily at **15:00 UTC** (3:00 PM).
- Maintenance: daily at **8:00 PM UTC** (20:00).

To use local time, change the cron schedule in the Database (e.g. SQL Editor or Cron integration). Example for GMT+3: Construction `0 12 * * *`, Maintenance `0 17 * * *`.

### Office Daily Report (10 AM)

- **Departments:** Office Baitalshaar, Alsaqia Showroom (office employees with these departments).
- **Admin page:** Office Report Settings tab — enable/disable per department, set report time (default 10:00), add recipient emails. “Send test report now” uses the same email config as reminders (Resend or Gmail).
- **Sending:** Next.js API `POST /api/office/send-daily-report` uses **Gmail** (same as construction/maintenance reminders).
- **CRON:** To run daily at 10:00 AM, call `POST /api/office/send-daily-report` with no body. If `CRON_SECRET` is set, send it in header `X-Cron-Secret` or `Authorization: Bearer <CRON_SECRET>`.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/deployment) for more details.
