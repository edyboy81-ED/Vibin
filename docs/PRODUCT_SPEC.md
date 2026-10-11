# Vibin AR — Product Specification

| | |
|---|---|
| **Product** | Vibin AR (Accounts Receivable cash tracking & forecasting) |
| **Current release** | v1.6.0 (production) + unreleased work on `main` (surety tracking, Archived status, redesigned Friday Report) |
| **Platform** | Web app, responsive (iPhone-first), deployed on Vercel |
| **Stack** | Next.js 15 App Router · TypeScript · Tailwind CSS 3.4 · Prisma 5 · PostgreSQL (Neon) |
| **Users** | A single AR / cash-management owner (password-gated), producing reports for a leadership team |
| **Document status** | Living spec. It describes the product as built, plus known gaps and a roadmap |

---

## 1. Executive summary

Vibin AR is a lightweight internal tool for an AR or treasury lead at a construction contracting group. The group has several operating companies split into two divisions, **Legacy** and **AB**. The tool replaces a spreadsheet-and-email process with one system of record that:

1. **Tracks cash received** against every job (the "Cash Receipts" ledger).
2. **Forecasts cash expected** through *projected payments*: one per pay estimate, with an expected payment date, status, notes and a history of date changes.
3. **Reconciles the two.** Posting a payment against a projection closes it in full or reduces its balance, and leaves an audit trail.
4. **Produces the weekly "Friday Report"** for leadership: receipts vs. target, why the variance happened, the surety exposure, and the forward cash forecast. It builds a ready-to-send email in one click.

The core value: *each Friday the owner can tell leadership, accurately and in minutes, how much cash came in, how that compares to plan and why, and what is coming next.*

---

## 2. Problem statement

### 2.1 Context

Contractors bill owners through periodic **pay estimates** (progress billings) per job. Payment timing varies a lot. Owners pay late, pay part of an estimate, or push the payment to a later date. Many jobs are also **bonded** by a surety (Zurich, Berkshire, Markel), and leadership watches cash exposure by surety. Leadership wants a weekly view of cash performance and a short-term forecast, split by division.

### 2.2 Problems in the previous (spreadsheet + email) workflow

| # | Problem | Impact |
|---|---|---|
| P1 | **Receipts and forecasts are in separate spreadsheets.** Nothing links a received payment to the estimate it pays. | Manual cross-checks. Forecasts go stale. Paid estimates stay in the forecast and inflate it. |
| P2 | **No record of why a forecast changed.** When a payment date slips, the old date is overwritten. | Leadership can't see slippage. "Target" figures can't be explained. Accountability is lost. |
| P3 | **Partial payments are hard to handle.** A short payment means hand-editing the balance and losing what happened. | Wrong remaining balances. The forecast double-counts or under-counts. |
| P4 | **The weekly report is rebuilt by hand.** Totals by division, next-week and future buckets, notes and narrative are re-typed every Friday. | Hours of work each week, error-prone, inconsistent format. |
| P5 | **Variance to target is unexplained.** Leadership sees "we collected $X vs. $Y" but not *why*. | Repeated follow-up questions. Low trust in the forecast. |
| P6 | **Collection conversations are lost.** Calls, emails and promises from customers sit in inboxes and memory. | No context when following up. Knowledge is lost when people change. |
| P7 | **Surety exposure isn't visible.** Bond carrier isn't recorded alongside AR. | Leadership can't see receipts and forecast by surety. |
| P8 | **Spreadsheet data is dirty.** Excel turns job numbers like `10-2369` into dates (`Oct-69`). Re-imports create duplicates. Column names vary. | Corrupt keys, duplicate projections, broken matching. |
| P9 | **Edits are silent.** Corrections to payment records leave no trail. | Audit risk, and disputes can't be reconstructed. |
| P10 | **Desktop-only spreadsheets.** | Status can't be checked or updated on the go. |

### 2.3 Goals

- **G1 — One source of truth** for jobs, payments and projected payments, linked to each other.
- **G2 — Explainable forecasts:** every date move, balance change and payment is recorded.
- **G3 — Friday Report in minutes,** with the variance explained automatically.
- **G4 — Low-friction data entry:** CSV import that tolerates messy spreadsheets, plus quick manual entry on mobile.
- **G5 — Visibility by division and by surety.**

### 2.4 Non-goals (current scope)

- Multi-user roles and permissions (single shared password today).
- Invoicing or billing generation. Pay estimates are created in the ERP; Vibin only tracks them.
- ERP or bank integration (data comes in by CSV or manual entry).
- Sending email from the server. The report is handed to the user's own mail client.

---

## 3. Users & personas

| Persona | Description | Primary needs |
|---|---|---|
| **AR / Cash Manager** (primary, only logged-in user) | Owns collections and the weekly cash report. | Fast payment entry, an accurate forecast, a report generated in one click, notes on each estimate. |
| **Leadership team** (consumers, no login) | CFO, division leads, executives. | A weekly email with receipts vs. target, explained variance, surety exposure and the forward forecast. |

---

## 4. How Vibin solves each problem

| Problem | Solution in Vibin | Where |
|---|---|---|
| P1 Separate receipts & forecasts | **Job** is the hub. **Payments** and **Projected Payments** both link to it. A Payment can also link directly to the **Projection** it pays (the `projectionId` link, shown as the "Est #" column). | Data model, Cash Receipts, Job detail |
| P2 Untracked slippage | **Move Date** action. It requires a new date, takes an optional reason, sets status to *Moved*, and writes a `ProjectionMovement` record (from → to, reason). The Friday Report uses movements to rebuild the original weekly target. | Projection detail, Friday Report |
| P3 Partial payments | **Post Payment** / **Apply Payment** logic: if amount ≥ balance → *Archived* (fully paid); if less → *Partial*, and the balance drops to the remainder. Every action logs a `[System]` note. | Projection detail, Job detail banner |
| P4 Manual report | **Friday Report** builder computes every section from live data and produces a formatted email (HTML or plain text) for Print, Copy or Send (mailto). | `/report`, `lib/reportBuilder.ts` |
| P5 Unexplained variance | **Variance from Target** KPI ($ and %), plus a **Variance Breakdown** in four buckets: Moved to Future Date, Still Expected This Week, Partial Payments Received, Unplanned Receipts. | Friday Report |
| P6 Lost conversations | **Communication log** of time-stamped notes on each projection. The latest note appears in the report's "Key Notes". | Projection detail |
| P7 Surety blind spot | **Surety** field on Jobs and Projections (Zurich / Berkshire / Markel / Unbonded), filters, a grid column, a **Surety Breakdown** report table, and a **bulk surety CSV import** admin tool. | Jobs, Projections, Report, `/admin/surety` |
| P8 Dirty spreadsheet data | **Forgiving CSV import:** header alias matching, detection of Excel-corrupted job numbers with an inline correction step, upsert (no duplicates), auto-logged notes when amounts or dates change, inline job creation for unmatched job numbers, and a review step for Partial projections. | `/import`, `/import/projections` |
| P9 Silent edits | **Payment audit log**: every inline payment edit stores a timestamped description of what changed, shown under the payment. | Job detail → Payment History |
| P10 Desktop-bound | **iPhone-first responsive UI**: hamburger menu, mobile-sized KPI cards, stacked tables. | All pages |

---

## 5. Domain model

All money is stored as **integer cents** and shown as USD. Dates are handled in **UTC** to avoid off-by-one-day bugs.

```
┌──────────────┐ 1      * ┌──────────────┐ *      0..1 ┌──────────────────────┐
│     Job      │──────────│   Payment    │──────────────│  ProjectedPayment    │
│ jobNumber ✱  │          │ datePmtRecv  │              │ estimateNumber       │
│ jobName      │          │ amountRecv   │              │ billingPeriod        │
│ company      │          │ paidThruDate │              │ monthYear            │
│ division     │          │ notes        │              │ estimatedAmountOwed  │
│ surety       │          └──────┬───────┘              │ estimatedPaymentDate │
│ jobStatus    │                 │ 1                    │ surety, division     │
│ customer     │                 │ *                    │ isActive             │
│ paid/billed  │          ┌──────┴──────────┐           └───┬──────┬─────┬─────┘
│  thru dates  │          │ PaymentAuditLog │               │ *    │ *   │ *
│ nextAmountDue│          └─────────────────┘               │      │     │
└──────┬───────┘                                 ┌──────────┘      │     └───────────┐
       │ 0..1                     *              │ 1               │                 │
       └─────────────────── ProjectedPayment     ProjectionStatus  ProjectionNote   ProjectionMovement
                                                 (name, color,     (content, ts)    (fromDate, toDate,
                                                  isSystem, sort)                    reason, ts)
```

### 5.1 Entities

**Job** is a contract job.
- `jobNumber` (unique, editable), `jobName`, `customer`
- `company` is one of 8 Legacy companies or `AB`. `division` (`LEGACY` | `AB`) is derived from the company (`lib/companies.ts`).
- `surety`: `ZURICH` | `BERKSHIRE` | `MARKEL` | `UNBONDED` (default)
- `jobStatus`: `IN_PROGRESS` | `CLOSED`
- `paidThruDate`, `billedThruDate`, `nextAmountDue`, `notes`

**Payment** is cash received on a job.
- `datePmtReceived`, `amountReceived`, optional `paidThruDate`, `notes`
- Optional `projectionId` linking it to the estimate it paid
- Cascade-deleted with its Job

**PaymentAuditLog** records each edit to a payment (`changes` text, `changedAt`).

**ProjectedPayment** is an expected payment for one pay estimate.
- Copies of job identity (`jobNumber`, `jobName`, `company`, `division`, `surety`), so a projection can exist before its Job does. `jobId` is nullable.
- `estimateNumber`, `billingPeriod` (e.g. `2/1/26-2/28/26`), `monthYear` (e.g. `04/2026`)
- `estimatedAmountOwed`: the **remaining** balance (reduced by partial payments)
- `estimatedPaymentDate`, `statusId`, `isActive`

**ProjectionStatus** is a configurable status with a color. System statuses (seeded, `isSystem = true`):

| Status | Meaning | Effect |
|---|---|---|
| Projected | Expected on the scheduled date | Counted in forecasts and targets |
| Partial | Some cash received, balance remains | Counted (remaining balance) and listed under "Partial Payments Received" |
| Moved | Date was pushed via Move Date | Counted at the new date. The original week's target still includes it. |
| Received | Legacy "paid" status | Excluded from forecasts. Migrated to Archived. |
| Archived | Fully paid / closed | Excluded from forecasts, KPIs and the default grid |

Users can add custom statuses (name and color) in Settings.

**ProjectionNote** is a free-text communication log entry. System notes start with `[System]`.

**ProjectionMovement** is an immutable record of a date change (`fromDate → toDate`, `reason`).

---

## 6. Functional requirements by area

### 6.1 Authentication

- FR-AUTH-1: A single shared password (`APP_PASSWORD`) gates the app at `/login`.
- FR-AUTH-2: Sessions use an HMAC-SHA256 signed cookie (`vibin_session`, token `v1:<expiry>.<sig>`) with a 7-day lifetime, verified with Web Crypto in Edge middleware.
- FR-AUTH-3: Every route except `/login` and `/api/auth/*` redirects unauthenticated users to `/login`.
- FR-AUTH-4: Logout is in the hamburger menu.

### 6.2 Dashboard (`/`)

Purpose: see the week's position at a glance.

- FR-DASH-1: **Cash receipts this week** (Monday → today): Legacy, AB and combined totals, each with a count of jobs paid.
- FR-DASH-2: **Projected payments**: *Next Week* (next Mon–Fri) and *Future* (after next Friday). Totals and counts exclude Received/Archived.
- FR-DASH-3: Status counters: active, *Projected*, *Partial*. Also the total job count.
- FR-DASH-4: Every KPI card is **clickable** and opens the Cash Receipts or Projections page pre-filtered (division, date range) to the rows behind that number. Drill-through totals must equal the KPI.
- FR-DASH-5: Shows the upcoming report Friday.
- FR-DASH-6: Four color themes (Slate & Emerald, White & Indigo, Dark Mode, Warm Neutral), chosen in Settings and stored per browser.

### 6.3 Cash Receipts (`/jobs`)

Purpose: the payment ledger and job registry.

- FR-CR-1: A payment-centric list: one row per payment, with job #, job name, customer, company/division, surety, date received, amount, linked **Est #**.
- FR-CR-2: Search by job #, name or customer. Filters for company, division (quick pills), surety, job status, date range, and a **This Week** quick filter. Filters can be set by URL params from the dashboard.
- FR-CR-3: A **Group by Job** toggle collapses payments into expandable job rows with payment count and total.
- FR-CR-4: Running totals reflect the active filters.
- FR-CR-5: **Add Job** inline form (job #, name, customer, company, surety, status, dates, next amount due).
- FR-CR-6: **CSV export** of all jobs: Job, Job Name, Customer, Job Status, Paid Thru, last Date Pmt Received, Days Last Paid (gap between the last two payments, or days since the last one), Amount Received, Next Amount Due, Billed Thru, Company.

### 6.4 Job detail (`/jobs/[id]`)

- FR-JOB-1: View and edit every job field, including the job number. Delete the job (its payments are deleted with it, and linked projections are unlinked).
- FR-JOB-2: **Record Payment** (date, amount, paid-thru date, notes).
- FR-JOB-3: After a payment is recorded, if the job has active projections, show a **banner** offering to *Apply* the payment to one of them (Apply Payment, §6.6). It can be dismissed.
- FR-JOB-4: **Payment History** with inline **Edit** and **Delete**. Every edit writes a `PaymentAuditLog` entry, shown under the row with a timestamp and a description of the change.
- FR-JOB-5: Lists the job's projections and can create a **follow-up projection** pre-filled from the job.

### 6.5 Projections (`/projections`)

Purpose: the forward cash forecast.

- FR-PRJ-1: A grid of projections with job #, name, division, **surety**, month/year, Est #, billing period, amount owed, **expected payment date**, and status (colored badge).
- FR-PRJ-2: Search. Filters for division (pills), status, company, surety, date range, **This Week**. Toggles for *Show inactive* and *Show archived* (archived hidden by default).
- FR-PRJ-3: **New Projection** (`/projections/new`): job lookup or manual identity entry, estimate fields, amount, date, status, first note. After saving, a success banner offers **Add Another**.

### 6.6 Projection detail (`/projections/[id]`)

- FR-PD-1: **Edit** all fields, including **Link to Job** (search by job # or name). A link is required for Post Payment.
- FR-PD-2: **Move Date**: a modal with a new date and a reason. Sets status to *Moved* and records a `ProjectionMovement`. The movement history is shown.
- FR-PD-3: **Post Payment**: enter date and amount. In one transaction the system:
  - creates a `Payment` on the linked job with `projectionId` set;
  - if amount ≥ balance, sets status to **Archived** (falls back to Received if Archived is missing);
  - otherwise sets status to **Partial** and reduces `estimatedAmountOwed` to the remainder;
  - appends a `[System]` note, e.g. *"Partial payment of $40,000.00 received. Balance reduced from $100,000.00 to $60,000.00."*
- FR-PD-4: **Apply Payment** (used by the Job banner) runs the same status and balance logic for a payment that already exists, without creating a new one.
- FR-PD-5: **Communication log**: add timestamped notes (contacts, email summaries, promises to pay). System notes are labeled.
- FR-PD-6: Delete the projection.

### 6.7 Friday Report (`/report`)

Purpose: the weekly leadership report. **Report date** defaults to the next Friday and can be changed.

**Time windows** (all UTC, relative to report Friday *F*):

| Window | Range |
|---|---|
| This week | Mon (F−4) → Fri F |
| Next week | Mon (F+3) → Fri (F+7) |
| Future | ≥ F+8 |
| Last week | Mon (F−11) → Fri (F−7) |

**Sections** (sticky side navigation on desktop, collapsible, printable):

1. **Performance**
   - Legacy, AB and Combined receipts this week.
   - **Target** = active projections dated this week **plus** projections *moved out* of this week (from movement records). Moving an estimate therefore does not quietly lower the target.
   - **Variance from Target** = Combined − Target, shown in $ and %.
2. **Variance breakdown**: why actual ≠ target.
   - *Moved to a Future Date* (−): original and new date, plus the reason.
   - *Still Expected This Week* (−): projections due this week that are not Received, Partial or Archived. Shows status and latest note.
   - *Partial Payments Received* (−): remaining balance on Partial projections due this week.
   - *Unplanned Receipts* (+): payments this week on jobs that have no active projection.
3. **Surety breakdown**: received this week, next-week projected and future projected per surety. Zero rows are hidden.
4. **Next Week**: projections grouped by date, split into Legacy and AB rows, with subtotals, status and latest note.
5. **Future**: the same layout for later dates.
6. **Last Week**: status of each projection that was due last week (color-coded), with its latest note.

**Email generation** (side drawer):

- FR-RPT-1: A **Standard** HTML email built on the client from the report data (tables, totals, notes).
- FR-RPT-2: An **Enhanced narrative** version: a plain-text leadership email from `POST /api/report` (`generateEmailBody`). It has an opening line, Weekly Cash Receipts, the Variance Breakdown, the Surety Breakdown, a Projected Payments Summary table by week ending (Legacy / AB / Combined, with grand total) and Key Notes. The UI labels it "AI Enhanced", but it is rule-based (no LLM call). The user can switch back to Standard.
- FR-RPT-3: Actions: **Print**, **Send** (opens `mailto:` with subject and body), **Copy HTML**, **Copy Text**. Preview and Source tabs.
- FR-RPT-4: Paid projections (Received or Archived) are excluded from forward totals even when their date is in the future (early payments).

### 6.8 Imports (`/import`, `/import/projections`)

**Jobs and payment history CSV** (`POST /api/import/jobs`)
- Header aliases (e.g. `Job`, `Job #`, `Job Number`). Creates or updates jobs and loads historical payments, including customer.
- Errors clearly when no job-number column is found.

**Projections CSV** (`POST /api/import/projections`)
- FR-IMP-1: Header alias matching for every field, e.g. Billing Period accepts `Billing Period` and `Final Billing Period`, and Amount accepts `Amount Owed`, `Estimated Amount` and similar.
- FR-IMP-2: **Excel date-corruption detection.** Job numbers that Excel turned into dates (e.g. `Oct-69`) pause the import. The user maps each corrupted value to the correct job # (e.g. `10-2369`) and then the import continues.
- FR-IMP-3: **Upsert.** An existing projection (same job and estimate) is updated rather than duplicated. Changes to amount or payment date are logged automatically as notes.
- FR-IMP-4: **Partial review.** If a CSV row matches a projection already in *Partial* status, the import pauses so the user can choose *Keep current balance* (default) or *Update to CSV amount* for each conflict.
- FR-IMP-5: **Unmatched jobs.** Job numbers with no Job record can be created inline (`/api/import/projections/create-jobs`) without leaving the flow.
- FR-IMP-6: The results summary shows Created and Updated counts separately, plus errors.

**Bulk surety assignment** (`/admin/surety`)
- FR-IMP-7: Upload a CSV with job # and surety columns. Leading title rows are skipped (the header is found in the first 10 rows). Values are normalized: anything that isn't Zurich, Berkshire or Markel becomes Unbonded. Updates the job **and all of its active projections**, and reports updated, not-found and projections-updated counts.

### 6.9 Settings (`/settings`)

- FR-SET-1: Manage projection statuses: create, rename, recolor and delete. System statuses can't be deleted (the API returns 403), but they can still be renamed.
- FR-SET-2: Dashboard theme picker.

### 6.10 Global UI

- Top navigation: Dashboard · Cash Receipts · Projections · Friday Report · Settings. A hamburger menu on mobile (includes Logout).
- A **What's New** modal shows the versioned changelog. The footer shows the version.

---

## 7. Key workflows

### 7.1 Weekly cycle

```
Mon–Thu                                   Fri
───────────────────────────────────────── ─────────────────────────────────
Customer pays ─► Post Payment on the       Open Friday Report (defaults to today)
                 projection (or Record     ─► Review Performance & Variance
                 Payment on the job →      ─► Check Last Week statuses
                 Apply from banner)        ─► Open Email Draft → Standard/Enhanced
Customer delays ─► Move Date + reason      ─► Send (mailto) / Copy / Print
Customer call ─► Add note to projection
New pay estimates ─► CSV import (upsert)
```

### 7.2 Payment against a projection (decision logic)

```
amount ≥ remaining balance ? ── yes ─► status = Archived, balance unchanged, note "fully paid and archived"
                              └ no ──► status = Partial,  balance = balance − amount, note "Balance reduced from X to Y"
(Post Payment also creates the Payment row linked by projectionId)
```

### 7.3 Target and variance

```
Target  = Σ active projections dated in [Mon..Fri]
        + Σ projections whose movement.fromDate ∈ [Mon..Fri] and that are no longer in the week
Actual  = Σ payments with datePmtReceived ∈ [Mon..Fri]
Variance = Actual − Target  (explained by Moved, Still Expected, Partial, Unplanned)
```

---

## 8. API surface

| Method & path | Purpose |
|---|---|
| `POST /api/auth/login`, `POST /api/auth/logout` | Session management |
| `GET/POST /api/jobs`, `GET/PATCH/DELETE /api/jobs/[id]` | Job CRUD |
| `GET /api/jobs/search` | Job typeahead (used by Link to Job) |
| `GET /api/jobs/export` | CSV export |
| `POST /api/jobs/[id]/payments` | Record a payment. Returns the job's active projections for the Apply banner. |
| `GET /api/payments`, `PATCH/DELETE /api/payments/[id]` | Payment ledger, edit (with audit log), delete |
| `GET/POST /api/projections`, `GET/PATCH/DELETE /api/projections/[id]` | Projection CRUD (filter `active=true/false`) |
| `POST /api/projections/[id]/move` | Move date + movement record |
| `POST /api/projections/[id]/notes` | Add a note |
| `POST /api/projections/[id]/post-payment` | Create a payment and settle the projection |
| `POST /api/projections/[id]/apply-payment` | Settle the projection using an existing payment |
| `GET/POST /api/projection-statuses`, `PUT/DELETE /api/projection-statuses/[id]` | Status management |
| `GET /api/report?date=` | Report data (JSON) |
| `POST /api/report` | Narrative email body |
| `POST /api/import/jobs`, `POST /api/import/projections`, `POST /api/import/projections/create-jobs` | CSV imports |
| `POST /api/admin/surety-import` | Bulk surety assignment |

---

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| **Correctness** | Money in integer cents. Date math in UTC. Payment + projection updates run in a DB transaction. |
| **Auditability** | Movements, `[System]` notes and payment audit logs are append-only. |
| **Security** | All routes behind signed-session middleware. Constant-time signature comparison. Secrets come from environment variables only. |
| **Performance** | Report built with parallel Prisma queries. Comfortable at hundreds of jobs and thousands of projections. |
| **Responsiveness** | Usable at iPhone widths. No horizontal page scroll. KPI values sized for mobile. |
| **Deployability** | Vercel auto-deploys from `main`. The build runs `prisma generate && prisma migrate deploy && next build`. Migrations use a direct (non-pooled) Neon URL (`DIRECT_URL`) to avoid advisory-lock timeouts. |
| **Environments** | Production uses the Neon `main` branch. Development uses the Neon `development` branch (`.env.local`). |
| **Release process** | Changelog and version are updated only in the release PR to `main` (see `CLAUDE.md`). |

### Configuration

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Pooled Postgres connection |
| `DIRECT_URL` | Direct connection for migrations |
| `APP_PASSWORD` | Login password |
| `SESSION_SECRET` | HMAC key for session cookies |

---

## 10. Success metrics

| Metric | Target |
|---|---|
| Time to produce the Friday Report | < 10 minutes (vs. hours by hand) |
| Variance explained by the breakdown buckets | ≥ 90% of $ variance attributable to a named bucket |
| Projections with a date change but no movement record | 0 (enforced by design) |
| Duplicate projections created by re-import | 0 |
| Payments linked to a projection (`projectionId` set) | Rising share of new payments |
| Leadership follow-up questions per report | Downward trend |

---

## 11. Release history

| Version | Date | Theme |
|---|---|---|
| v1.0.0 | Apr 24, 2026 | Initial release: Dashboard, Cash Receipts, Projections, Friday Report, Settings |
| v1.0.1 | Apr 27, 2026 | Payment-centric receipts, customer field, jobs and payments CSV import, status management |
| v1.1.0 | Apr 28, 2026 | Clickable KPIs, Move Date with history, communication log, Post Payment, report print and email |
| v1.2.0 | May 8, 2026 | Import hardening: Excel corruption fix, upsert, inline job creation, timezone fix |
| v1.3.0 | May 8, 2026 | Early-payment handling. Drill-through totals match KPIs. |
| v1.4.0 | May 11, 2026 | Partial payment tracking, `[System]` notes, Partial import review |
| v1.5.0 | May 19, 2026 | Group by Job, Est # link, Variance from Target and Variance Breakdown |
| v1.6.0 | Jun 19, 2026 | Inline payment editing, payment audit trail, Link to Job |
| *Unreleased* | — | Surety field, Surety Breakdown, bulk surety import, Archived status (with backfill), redesigned Friday Report, iPhone-first responsive pass |

---

## 12. Known gaps & risks

| Item | Notes |
|---|---|
| Stale `README.md` | Describes an older Receipt/Reconciliation model and placeholder companies. It should be rewritten from this spec. |
| Dead `EmailForm` component | Posts to `/api/email`, which doesn't exist. `nodemailer` is a dependency but is unused. The report uses `mailto:` instead. |
| "AI Enhanced" label | The narrative email is template-based, not generated by a model. Rename it, or implement it properly. |
| Status logic keyed on names | Code matches statuses by name (`'Partial'`, `'Archived'`, `'Moved'`). Renaming a system status in Settings would break the logic. Consider stable keys. |
| Unplanned-receipt heuristic | A payment counts as "unplanned" only if its *job* has no active projection, not by estimate. A payment on a job with an unrelated active projection isn't flagged. |
| Single shared password | No per-user identity, so audit entries can't say *who* made a change. |
| No automated tests | The report math and payment-settlement logic would benefit from unit tests. |
| Hard-coded companies | The company list lives in `lib/companies.ts`. Adding a company needs a code change. |

---

## 13. Roadmap candidates

1. **Per-user accounts and an attributed audit trail** (who changed what).
2. **Server-side scheduled email** of the Friday Report to a configured distribution list.
3. **LLM-written narrative** for the variance commentary (making the "AI Enhanced" label true).
4. **Aging and DSO analytics**: days-to-pay per customer and surety, forecast-accuracy trend over time.
5. **Stable status keys** and admin-managed company and surety lists.
6. **ERP or bank feed integration** to replace CSV imports.
7. **Test suite** for `reportBuilder` and payment settlement.
