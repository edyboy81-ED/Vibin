# Vibin

Single-user job tracking and payment reconciliation app. Built with Next.js 15 (App Router), Prisma, PostgreSQL, and Tailwind CSS. Deploy to Vercel in minutes.

## Features

- **Jobs** — record expected payments per job number + company
- **Receipts** — log payments received
- **Reconciliation** — automatic match by `jobNumber + company`; surfaces pending jobs and unmatched receipts
- **Email report** — one-click HTML summary via Gmail
- **Auth** — simple password-gated session (no full auth library)

## Setup

### 1. Clone

```bash
git clone https://github.com/edyboy81-ed/vibin.git
cd vibin
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Neon / Supabase / Vercel Postgres) |
| `APP_PASSWORD` | Password to log in to the app |
| `SESSION_SECRET` | Random 32+ char string for signing session cookies |
| `GMAIL_USER` | Gmail address used to send email |
| `GMAIL_APP_PASSWORD` | Gmail [App Password](https://myaccount.google.com/apppasswords) (not your account password) |

### 3. Run the initial database migration

```bash
npx prisma migrate deploy
```

### 4. Start locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with `APP_PASSWORD`.

---

## Customising companies

Companies are stored as a PostgreSQL enum. The defaults are:

| Enum value | Display label |
|---|---|
| `PRESTIGE` | Prestige Productions |
| `HARMONY` | Harmony Events |
| `RHYTHM` | Rhythm Records |
| `MELODY` | Melody Media |
| `ENCORE` | Encore Entertainment |

To change them:

1. Edit `prisma/schema.prisma` — update the `Company` enum values.
2. Update `COMPANY_LABELS` in `lib/emailTemplate.ts` and the `COMPANIES` arrays in `app/jobs/page.tsx`, `app/receipts/page.tsx`, and `app/reconciliation/page.tsx`.
3. Run `npx prisma migrate dev --name rename-companies`.

---

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import the project at [vercel.com/new](https://vercel.com/new).
3. Add all environment variables from `.env.example` in the **Environment Variables** section.
4. Vercel will use the `buildCommand` in `vercel.json` (`prisma generate && next build`).
5. After the first deploy, run the migration once:

```bash
# Using Vercel CLI
vercel env pull .env.local   # pull production env locally
npx prisma migrate deploy    # apply migration to production DB
```

Or run `npx prisma migrate deploy` from your CI pipeline / Vercel build step.

---

## Data model

```
Job        { id, jobNumber, company, name?, date?, amount (cents), notes? }
Receipt    { id, jobNumber, company, amount (cents), date, description? }
```

All monetary values are stored as **integers (cents)** in the database and displayed as dollars throughout the UI.

Reconciliation matches `Job ↔ Receipt` on exact `jobNumber + company`. If a job has no `name`, the `jobNumber` is used as the display label.

## Project structure

```
app/
  page.tsx                  Dashboard
  login/page.tsx            Login
  jobs/page.tsx             Job list + add form
  receipts/page.tsx         Receipt list + add form
  reconciliation/page.tsx   Reconciliation view + email
  api/
    auth/login/route.ts
    auth/logout/route.ts
    jobs/route.ts + [id]/route.ts
    receipts/route.ts + [id]/route.ts
    email/route.ts
lib/
  db.ts           Prisma client singleton
  auth.ts         Session token (Web Crypto HMAC)
  reconcile.ts    Pure reconciliation logic
  emailTemplate.ts  HTML + plain-text email generators
  sendEmail.ts    Gmail send via nodemailer
middleware.ts     Auth guard (redirects to /login)
prisma/
  schema.prisma
  migrations/
  seed.ts         Example data shape (commented out)
```
