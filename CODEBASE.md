# Codebase guide

How the code is organised and how the main flows work. Setup, connections and deployment are in `README.md`.

## Data layer (`src/lib/clinic/`)

All clinic data is in PostgreSQL (Supabase in production). The schema is in `supabase/migrations/`; `scripts/migrate.mjs` applies it.

| File | Role |
|---|---|
| `src/lib/db.ts` | The Postgres connection (`postgres` driver, Supabase transaction pooler). One pool on Node; one client per request on Cloudflare Workers. |
| `clinic/unit.ts` | **Unit of work.** `tx(scope, rule)` runs one business change in one database transaction: lock the dates involved (advisory locks), load the configuration and only the appointments in scope, run the rule (plain TypeScript that edits the loaded objects), write back exactly what changed, commit. A rule that fails rolls everything back. `getData(scope)` is the read-only version. |
| `clinic/rules.ts` | Pure rules: slots, capacity, blocked dates, `planBlock`. They take the loaded data as an argument, so a page reads once and calls them in a loop. |
| `clinic/appointments.ts` | Create, change status, edit, reschedule, delete, block date, emergency close, reminders, searching and exports. |
| `clinic/catalog.ts` | Appointment types, time slots, doctor capacity, doctors, treatments. |
| `clinic/reports.ts` | Dashboard counts, patients, statistics, audit and message log queries. |
| `clinic/messages.ts` | The texts sent to patients and staff, with the template variables for WhatsApp. |
| `content.ts` | Website content edited in the admin: contact details, gallery, testimonials, FAQs. |

Rules that matter, all inside `tx()` so they cannot be bypassed:

- **Capacity.** A booking needs room in its time slot *and* in its doctor group (Dr. Lakshmi or Other Doctors) for that day. Cancelled appointments release their place; completed and no-show visits keep it.
- **No double booking.** Per-date advisory locks serialise bookings for the same day; capacity-wide changes take an exclusive lock. The tests run many bookings in parallel against one real database to prove no slot is oversold.
- **Appointment numbers** (`APT-2026-001`) come from a counter row and are gap-free: a booking that is refused does not use a number.
- **Token numbers.** One counter, bumped only when an appointment moves to Completed. A second completion is rejected, so a token is never issued twice.
- **Time slots.** Each has its own capacity (default 25). Slots may not overlap, last at most 60 minutes, and cannot be deleted or shrunk below existing bookings.
- **Blocked dates.** Booking is refused; "cancel all" cancels every pending or confirmed appointment on the date in one transaction and marks them Cancelled by Admin.
- **Names are snapshots.** Appointments keep the type, doctor and treatment names, so renaming or deleting one never breaks old records.

## Accounts and sign-in (`src/lib/auth/`, `src/lib/admin-auth.ts`)

Accounts live in `admin_users` (OWNER or STAFF, hashed password, `session_version`). The cookie holds the account id, the session version and an expiry, signed with `SESSION_SECRET`; every request looks the account up again, so disabling an account or changing its password signs it out at once. `requireAdminUser()` guards pages, `requireOwner()` guards owner-only pages and actions, `routeAuth()` guards route handlers (401/403). Failed sign-ins are counted per client address in `login_failures`.

## Connections (`src/lib/integrations/`, `src/lib/env.ts`)

Each external service has one small adapter that does nothing until its settings exist:

| File | Service |
|---|---|
| `integrations/whatsapp.ts` | WhatsApp Business Cloud API (templates per event, plain-text fallback) |
| `integrations/email.ts` | Resend |
| `integrations/storage.ts` | Supabase Storage (disk in development) |
| `integrations/turnstile.ts` | Cloudflare Turnstile |
| `integrations/deliver.ts` | Sends the messages a booking change produced, records each attempt in `message_log`, never throws; uses `waitUntil` on Cloudflare |

`env.ts` reads every setting in one place and reports which connections are missing (Admin > Integrations).

## Folders

```
src/app/                       public pages: /, /doctors, /treatments, /book, /book/treatment, private cancel/edit/reschedule links
src/app/admin/(panel)/         admin pages (guarded by the layout and again by each page/action)
src/app/admin/login            sign-in
src/app/api/slots              public slot availability (rate-limited); src/app/admin/api/slots is the admin version
src/app/api/cron/reminders     reminder sender (called by the scheduled trigger in worker.ts)
src/actions/appointment.ts     public server actions: bot check, rate limits, then the booking
src/actions/admin.ts           admin server actions; each one re-checks the account and role
src/components/                booking, home sections, layout, admin shell and forms
src/lib/validations.ts         input rules shared by forms and actions
supabase/migrations/           the database schema and default rows
scripts/                       local database, migration runner, browser-test database and server
tests/                         Vitest (business rules, accounts, validation; real PostgreSQL), tests/e2e (Playwright browser tests), tests/smoke (checks a running site)
worker.ts                      Cloudflare entry point: the site plus the reminder schedule
```

## Booking flow

1. `BookingWizard` loads dates, and for a chosen date the slots and doctor-group availability, from server actions (always fresh). Failed calls show a message with a retry instead of a dead screen.
2. `createAppointment` (action) checks the bot token (when Turnstile is on) and the rate limits, validates the input, then `clinic.createAppointment` re-checks the date, blocked days, slot capacity and doctor-group capacity inside `tx()`.
3. The saved appointment returns a private token used in the cancel, edit and reschedule links. The messages it produced are sent after the save; a messaging failure never undoes a booking.

## Common changes

- **Slot times or capacity:** Admin > Time slots & capacity. No code change.
- **Clinic phone, address, hours, social links, figures:** Admin > Contact & site details.
- **FAQs, gallery, testimonials:** Admin > FAQs / Gallery / Testimonials.
- **A new admin page:** add it under `src/app/admin/(panel)/`, call `requireAdminUser()` or `requireOwner()` first, and add a link in `src/components/admin/AdminShell.tsx` (mark owner-only links `owner: true`).
- **A new database change:** add a numbered file to `supabase/migrations/` (never edit one that has been applied) and run `npm run db:migrate`.
