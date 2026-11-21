# Dr. Lakshmi Skin & Hair Clinic

Public website, online appointment booking and an admin portal for the clinic.

- **Website**: home, doctors, treatments, privacy and terms. Everything shown (contact details, FAQs, gallery, testimonials, figures) comes from what the clinic saves in the admin portal. Sections with no content stay hidden; nothing is made up.
- **Booking**: date, time slot (places left are shown), New or Follow-up, Dr. Lakshmi or Other Doctors, and name, age, gender and phone. A separate treatment form takes the slot and the same four details. Patients cancel, reschedule or edit through the private link in their booking message.
- **Admin portal (`/admin`)**: dashboard, appointments (token numbers, CSV download), calendar (block a date or close for an emergency), time slots and capacity, doctors, treatments, appointment types, patients, statistics, website content, admin accounts, integrations status, message log and audit log.

## Technology

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · **Supabase (PostgreSQL)** for data and photos · **Cloudflare Workers** (OpenNext) for hosting.

> This project uses a newer Next.js than most documentation describes. Before changing framework-level code, read the guide in `node_modules/next/dist/docs/` (see `AGENTS.md`).

## Run it on your computer

You need Node.js 22.9 or newer.

```bash
npm install
npm run db:dev      # terminal 1: a real PostgreSQL server on your computer (data kept in .local-data/, ignored by git)
```

Copy `.env.example` to `.env.local` and fill in at least:

```
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54329/lakshmi
SESSION_SECRET=<a random string of 32 or more characters>
ADMIN_USERNAME=<your username>
ADMIN_PASSWORD=<10+ characters with letters and numbers>
```

```bash
npm run dev         # terminal 2, then open http://localhost:3000 and sign in at /admin
```

The first sign-in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` creates the first **owner** account (the password is stored hashed). After that, manage accounts in **Admin > Admin accounts** and remove those two settings.

## Set up Supabase (production database)

1. Create a project at https://supabase.com.
2. **Create the tables.** Either run `DATABASE_URL=<your connection string> npm run db:migrate`, or paste the files in `supabase/migrations/` (in order) into Supabase > SQL Editor. Running it again is safe: each file is applied once.
3. **Connection string.** Supabase > Connect > *Transaction pooler* (port 6543). Put it in `DATABASE_URL`.
4. **Photos.** Supabase > Storage > create a **public** bucket named `clinic-media`. Put the project URL in `SUPABASE_URL` and the *service role* key in `SUPABASE_SERVICE_ROLE_KEY` (a server secret: never put it in a `NEXT_PUBLIC_` setting).
5. All tables have Row Level Security switched on with no public policies, and the browser never talks to Supabase directly: only the server connects, so the public `anon` key is not used at all.
6. Turn on Supabase's automatic backups (Point-in-Time Recovery on paid plans). The app keeps no other copy of your data.

## Connections (placeholders that switch on when you add settings)

Every connection is optional. With no setting the website still works, the feature is switched off, and **Admin > Integrations** says what is missing. That page never shows a secret.

| Connection | What it does | Settings |
|---|---|---|
| WhatsApp Business (Meta Cloud API) | Booking, confirmation, change, cancellation, reminder and thank-you messages to patients | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, plus a template name per message (below) |
| Staff alerts | New booking, cancellation and blocked-date alerts to the clinic | `ADMIN_WHATSAPP_NUMBER` and/or `ADMIN_NOTIFY_EMAIL` |
| Email (Resend) | Sends the staff email alerts | `RESEND_API_KEY`, `EMAIL_FROM` |
| Photo storage (Supabase Storage) | Doctor, treatment and gallery photos | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` |
| Bot protection (Cloudflare Turnstile) | Stops scripts from filling the booking calendar | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (both) |
| Reminder scheduler | Reminders about two hours before a confirmed appointment | `CRON_SECRET` |

Without storage settings, photo upload saves to `public/uploads/` on your computer and is refused on Cloudflare. Without Turnstile, the booking form is protected only by rate limits.

### WhatsApp templates

WhatsApp delivers a message to someone who has not written to you in the last 24 hours **only if it uses a template approved by Meta**. Create one template per row in Meta Business Manager (category *Utility*), with the variables in this order, then set the setting in the first column to the approved template's name. The same table is shown in **Admin > Integrations**. Until a name is set, the plain text is sent, which WhatsApp may refuse; failures show in **Admin > Message log**.

| Setting | Sent when | `{{1}}`, `{{2}}`, ... |
|---|---|---|
| `WHATSAPP_TEMPLATE_BOOKING_PENDING` | A patient books and the clinic has not confirmed yet | patient name, appointment ID, date, time, doctor or treatment, cancel link, reschedule link |
| `WHATSAPP_TEMPLATE_BOOKING_CONFIRMED` | The booking is confirmed | same seven |
| `WHATSAPP_TEMPLATE_BOOKING_RESCHEDULED` | The appointment is moved | same seven |
| `WHATSAPP_TEMPLATE_BOOKING_CANCELLED` | The clinic cancels, including an emergency closure | patient name, appointment ID, date, time, reason, link to book again |
| `WHATSAPP_TEMPLATE_DATE_UNAVAILABLE` | A date was blocked and the appointment needs a new date | patient name, appointment ID, date, reason, reschedule link |
| `WHATSAPP_TEMPLATE_THANK_YOU` | After a completed visit | patient name, Google review link, link to book again |
| `WHATSAPP_TEMPLATE_REMINDER` | About two hours before a confirmed appointment | patient name, date, time, map link, reschedule link |
| `WHATSAPP_TEMPLATE_ADMIN_ALERT` | Staff alert | title, details |

Every attempt is recorded in the message log with a masked phone number (message text is not stored). A messaging failure never undoes or blocks a booking.

## Deploy to Cloudflare

Deploying changes the live site: do it only when you mean to.

1. Set each secret once (each command asks for the value): `npx wrangler secret put DATABASE_URL`, then `SESSION_SECRET`, `CRON_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and any connection from the table above. Public values can go in `wrangler.jsonc` under `"vars"`.
2. `npm run deploy`

`wrangler.jsonc` sets the `nodejs_compat` flag (needed by the Postgres driver) and a cron trigger every 15 minutes. `worker.ts` turns that trigger into a call to `/api/cron/reminders` with `Authorization: Bearer <CRON_SECRET>`. Without `CRON_SECRET` reminders are simply not sent.

**Rehearse locally in the Workers runtime first** (nothing is deployed and no production resource is used): put the settings you want in `.dev.vars` (a git-ignored file; use a test database, not the live one), run `npm run preview` (builds the Worker and serves it at http://localhost:8787), then in another terminal run the smoke test:

```bash
SMOKE_BASE_URL=http://localhost:8787 ADMIN_USERNAME=<owner> ADMIN_PASSWORD=<password> npm run test:smoke
```

It opens the public pages, checks that signed-out visitors are kept out of the admin portal, signs in, books a test appointment, confirms it and cancels it. Do not add `--remote` to the preview command: that would use real Cloudflare resources.

## Who can do what

| | Staff | Owner |
|---|---|---|
| Dashboard, appointments (confirm, cancel, complete, reschedule, new), patients, own password | yes | yes |
| Delete an appointment, calendar blocks, slots and capacity, appointment types, doctors, treatments | | yes |
| Website content (contact details, gallery, testimonials, FAQs) | | yes |
| Statistics, **all downloads**, message log, audit log, admin accounts, integrations | | yes |

Every action re-checks the signed-in account on the server (hiding a menu item is not the protection). Downloads are recorded in the audit log.

## Tests and checks

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm test            # business rules, accounts, validation and settings against a real PostgreSQL (capacity, tokens, blocking, races)
npm run test:e2e    # 27 browser tests (the Chrome that is already installed) against a throw-away database and a production build of the site
npm run test:smoke  # a short check of a site that is already running, such as the local Workers preview (see above)
```

The automated tests never touch your real database. They do **not** call WhatsApp, email, Turnstile or Supabase Storage: those need real credentials, so only their "not connected" behaviour is tested. Before you rely on a connection, test it once by hand with your own number and look at **Admin > Message log**.

## Security notes

- Passwords are hashed (PBKDF2-SHA512, 100,000 rounds: the most Cloudflare Workers allow). Five wrong sign-ins lock an address out for 15 minutes. Sessions are signed, `HttpOnly`, limited to `/admin`, and end at once when an account is disabled or its password changes.
- Public booking is rate-limited per device and per phone number, and uses Turnstile when configured.
- Appointment data is reached only through server code. Private booking links are random 122-bit tokens and are not indexed by search engines.
- Uploads are checked by their real file signature (JPG, PNG, WebP, 2 MB) and stored under generated names. CSV exports neutralise spreadsheet formulas.
- Security headers, including a Content-Security-Policy, are set in `next.config.ts`.
- Logs are JSON lines with phone numbers masked and no names or message text.

## Before you go live

- Fill in **Admin > Contact & site details** (phone, address, hours) and add real FAQs. Add gallery photos and testimonials only with the patient's written consent.
- Have the Privacy Policy and Terms (`src/app/privacy`, `src/app/terms`) reviewed for your legal obligations (for example India's Digital Personal Data Protection Act). They describe what the software does; they are not legal advice.
- Register and get the WhatsApp templates approved, then test each message with your own number.
- Set `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET`, and Turnstile.
- Change the first owner's password, remove `ADMIN_USERNAME` / `ADMIN_PASSWORD`, and give each staff member their own account.
- Social-preview image: none is set. Add one (1200x630) and point `openGraph.images` in `src/app/layout.tsx` at it.

## Known limits

- `npm audit` reports advisories that were reviewed and not fixed: `zod` 3 (memory use on oversized arrays; no array whose size a visitor controls is validated, so it is not reachable) and `glob`/`minimatch` inside `@opennextjs/cloudflare` (build-time tooling only). Move to zod 4 when convenient.
- Passwords use 100,000 PBKDF2 rounds because that is the Workers limit. Long passwords and the sign-in lockout make up for it; use Argon2 if you ever host on plain Node.
- A reminder is marked sent before it is delivered and released again if delivery fails. If the Worker is stopped between those two steps, that one reminder is lost.
- Photos are served as uploaded (no resizing). The 2 MB limit keeps pages light; resize large photos first.
- Online booking cannot be limited to patients already registered with the clinic, and any visitor can book (rate limits and Turnstile reduce abuse; the clinic confirms each booking by default).

See `CODEBASE.md` for how the code is organised.
