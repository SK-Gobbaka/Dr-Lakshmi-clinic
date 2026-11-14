# Admin Portal Functional Specification
Dr. Lakshmi Skin & Hair Clinic (the brief spells it "Lakshishmi"; the code and site use "Lakshmi")

Status legend: **[EXISTS]** in code today · **[PARTIAL]** exists but incomplete or unsafe · **[NEW]** to be built.
Nothing in this document is implemented. Findings come from reading the repository on 2026-11-07; the running database was not inspected.

---

## 1. Existing project analysis and existing features

### 1.1 Technology stack
| Area | Finding |
|---|---|
| Framework | Next.js 16.2.9 (App Router, Turbopack), React 19.2, TypeScript 5. `AGENTS.md` warns this Next.js has breaking changes: read `node_modules/next/dist/docs/` before building. |
| Styling | Tailwind CSS 4, `class-variance-authority`, `tailwind-merge`, Radix Slot, lucide-react, framer-motion |
| Data layer | Prisma 5.22 on PostgreSQL (`DATABASE_URL`) |
| Validation / forms | Zod 3, react-hook-form |
| Messaging | WhatsApp Business (Meta Graph API) via `src/lib/whatsapp.ts` |
| Images | `next/image` with remote patterns for `images.unsplash.com` and `res.cloudinary.com`; `src/lib/cloudinary.ts` only builds delivery URLs (no upload code) |
| Scheduling | Vercel Cron, every 15 min, `vercel.json` |
| Server logic | Server Actions (`src/actions/appointment.ts`) plus one route handler (`/api/cron/reminders`) |

### 1.2 Existing appointment booking [EXISTS, with defects]
Public flow: `/book` (calendar, slot, patient details), `/book/cancel/[token]`, `/book/reschedule/[token]`. Actions: `getAvailableSlots`, `getAvailableDates`, `createAppointment`, `cancelAppointment`, `rescheduleAppointment`, `getAppointmentByToken`.

Behaviour as coded:
- Bookable window: tomorrow to 30 days ahead (`BOOKING_HOURS.maxDaysAhead`); Sundays excluded (hard-coded `isSunday`).
- Slots: fixed eight 1-hour slots (09–12 and 17–22) hard-coded in `slots.ts`. `BOOKING_HOURS.slotDurationMinutes = 30` and `start/end = 9/20` in `constants.ts` are **not used** by the slot generator.
- Slot rows are created lazily per date by `ensureSlotsForDate` (upsert, capacity 2) and also by `prisma/seed.ts` for 30 days.
- Confirmation is immediate (`CONFIRMED`); there is no pending/approval step.
- WhatsApp confirmation is sent on create and reschedule. `sendHospitalCancellation` and `sendNoShowNotification` exist in `whatsapp.ts` but nothing calls them.
- Reminder cron: 2 hours before, WhatsApp, `reminderSent` flag.
- Patient self-service is authorised only by possession of `confirmationToken`.

### 1.3 Database structure [EXISTS]
Only two tables:
- `TimeSlot(id, date, startTime, endTime, capacity=2, bookedCount, isActive, createdAt, updatedAt)`, unique `(date, startTime)`.
- `Appointment(id, slotId, fullName, phone, email?, age, gender, patientType, status, confirmationToken unique, cancelReason?, reminderSent, createdAt, updatedAt)`.
- Enums: `AppointmentStatus {CONFIRMED, CANCELLED, COMPLETED, NO_SHOW, RESCHEDULED}`, `PatientType {NEW, FOLLOW_UP}`, `Gender {MALE, FEMALE, OTHER}`.

There is **no** table for patients, admins, doctors, treatments, gallery, testimonials, settings, holidays, status history or audit log.

### 1.4 Patient information [PARTIAL]
Patient data is denormalised onto every appointment row (name, phone, email, age, gender, self-declared patient type). The same person booking twice produces two unrelated copies. Phone is indexed; email is not. Phone is stored as 10 digits with no country code; WhatsApp helpers expect a number format that must be confirmed.

### 1.5 Image storage [PARTIAL]
Images are URL strings in TypeScript files, mostly Unsplash placeholders. Cloudinary is configured for display only; there is no upload endpoint, no stored asset id, no persistent storage for admin uploads. Logo, hero and watermark art are static files in `public/`.

### 1.6 Doctors, treatments, website content [EXISTS as static code]
| Content | Where | Shape |
|---|---|---|
| Doctors | `src/lib/data/doctors.ts` | id, name, qualification, designation, experience (number), specialization[], bio, image, isSenior, message, regNo; the senior consultant is `doctors[0]` |
| Treatments | `src/lib/data/treatments.ts` | id, name, slug, category (`hair`/`skin`/`laser`), shortDescription, description, image, duration, benefits[] |
| Gallery | `src/lib/data/gallery.ts` | id, title, image, category, aspectRatio |
| Testimonials | `src/lib/data/testimonials.ts` | id, name, image, rating, review, treatment, date |
| FAQ | `src/lib/data/faq.ts` | question/answer |
| Hospital facts | `src/lib/constants.ts` `HOSPITAL`, `TRUST_STATS`, `WHY_CHOOSE_US`, `PATIENT_JOURNEY` | name, phone, email, address, hours, rating, social links, map URL |
| Page copy | hard-coded in `src/components/home/*`, footer, header | headline, CTAs, about text, treatment preview list (a separate hard-coded list of six names) |

Changing any of this today needs a code change and redeploy.

### 1.7 Authentication and authorisation [DOES NOT EXIST]
No login, session, middleware/proxy, role model or admin route exists. The only protected endpoint is the cron route, secured by `?secret=` in the query string (and `vercel.json` carries a literal placeholder `CRON_SECRET_PLACEHOLDER`).

### 1.8 Existing-feature summary vs admin needs
| Admin need | Today |
|---|---|
| View/search/filter appointments | none (no admin UI, no read APIs) |
| Change status, history | partial: status field only, no history; patient cancel/reschedule work |
| Slot management | partial: slots exist, capacity field exists, no admin control, holidays hard-coded to Sunday |
| Patient records | none (denormalised) |
| Doctors, gallery, treatments, content, settings | static code, none editable |
| Auth, audit | none |

### 1.9 Defects found in existing code that the admin portal depends on
These must be fixed (or consciously accepted) because the portal's statistics and rules are only as reliable as the booking engine.
1. **Capacity is not enforced.** `createAppointment` increments `bookedCount` without checking `capacity`; `getAvailableSlots` reports at least 1 remaining even when full ("available by default"). Fully booked slots are never hidden.
2. **Fake success when the database fails.** Create, cancel, reschedule and token lookup return success with mock tokens/data on any DB error. Admins would see no record while the patient believes they have a booking.
3. **Reschedule creates a new appointment row** and marks the old one `RESCHEDULED`; there is no link between them, so history per booking is lost.
4. **Race conditions.** Capacity check and increment are not atomic; the 5-minute duplicate check is outside the transaction.
5. **`bookedCount` is a stored counter** that can drift (cancel decrements with no floor; admin edits would add more writers).
6. **Duplicate rule is weak:** same phone within 5 minutes only, status `CONFIRMED` only; no rule for the same patient holding two bookings in one slot or day.
7. **No cancellation/reschedule cut-off or limits;** a patient can cancel an appointment already in the past.
8. **Timezone:** dates are `@db.Date` built from server-local midnight; the cron compares local times with `setHours`. On a UTC host (Vercel) this misfires for IST. All admin time logic must be pinned to `Asia/Kolkata`.
9. **Inconsistent opening hours** across code: footer/constants "9–12 and 5–10", structured data 09:00–20:00 and Sunday 10–14, `BOOKING_HOURS` 9–20.
10. **`createAppointment` ignores the submitted `date`** and trusts `slotId` only; slot date is not cross-checked.
11. **OTP is a stub** (`verifyOTP` always returns verified).
12. Cron secret in URL query string can leak into logs.

---

## 2. Proposed admin features (overview)

| # | Module | Priority | Depends on |
|---|---|---|---|
| 1 | Admin authentication and accounts | Must | none |
| 2 | Audit log | Must | 1 |
| 3 | Patient master record | Must | schema migration |
| 4 | Appointment management | Must | 1, 2, 3, 6 |
| 5 | Slot and availability engine | Must | 1, 2 |
| 6 | Dashboard | Must | 4 |
| 7 | Calendar | Should | 4, 5 |
| 8 | Hospital settings | Must | 1, 2 |
| 9 | Doctors | Should | 1, 2, file storage |
| 10 | Treatments and categories | Should | 1, 2, file storage |
| 11 | Gallery | Should | 1, 2, file storage |
| 12 | Website content (home, about, testimonials, contact) | Could | 1, 2, 8, file storage |

Suggested build order: 1, 2, schema changes, 5 (fix capacity engine), 3, 4, 6, 8, 7, then 9 to 12.

---

## 3. Dashboard

**Purpose.** One screen that shows clinic load and booking health from live data.

**Inputs.** Appointments joined to slots, patients; date range selector (default today); time zone Asia/Kolkata.

**Metrics (all computed by database queries, never cached counters):**
- Counts by status: total, pending, confirmed, completed, cancelled, no-show.
- Today's appointments, upcoming (slot start in the future, status pending/confirmed), recent bookings (last N by `createdAt`).
- New-patient vs follow-up appointments (see section 6 for how "new" is defined).
- Daily, weekly (ISO week, Monday start), monthly series for a selected range; bucket by **slot date**, not booking date. A second series by booking date is optional.
- Derived: cancellation rate, no-show rate, slot utilisation = booked / capacity for the range.

**Admin actions.** Change range, click a metric to open the appointment list pre-filtered, open a recent booking.

**After an action.** Navigation only; no data changes.

**Rules.**
- "Rescheduled" is not a dashboard status: a rescheduled booking counts once, under its current state (see 14.1). Without this, totals double-count.
- Pending counts only exist if the Pending status is introduced (see 14.1).
- Numbers must reconcile: sum of status counts equals total for the same filter.

**Data.** Read-only over `Appointment`, `TimeSlot`, `Patient`; indexes on `(status)`, slot date, `createdAt`.

---

## 4. Appointment management

### 4.1 List and detail
**What it does.** Lists every appointment with views: all, today, upcoming, previous, pending, confirmed, completed, cancelled, no-show.

**Fields shown.** Appointment ID, patient name, phone, email, age, gender, patient type, appointment date, time, status, booking created timestamp. Detail view adds: slot capacity/booked, cancel reason, reminder-sent flag, rescheduled-from/to link, full status history, linked patient record and their other appointments.

**Pagination.** Server side, default sort by slot date/time ascending for upcoming and descending for previous.

### 4.2 Search
By patient name (case-insensitive contains), phone (normalised: strip spaces, +91, leading 0), email (case-insensitive), appointment ID (exact). One search box may detect the type by pattern; ambiguous input searches all four.

### 4.3 Filters (combinable with AND)
Specific date, date range (of appointment date), status (multi-select), patient type, booking date (or range of `createdAt`). Search and filters compose. Filters are reflected in the URL so views can be shared and survive refresh.

### 4.4 Actions and what happens after each
| Action | Allowed from | Effect | Side effects |
|---|---|---|---|
| Confirm | Pending | status = Confirmed | WhatsApp confirmation to patient; audit entry; status history row |
| Cancel | Pending, Confirmed | status = Cancelled, reason required; capacity released | Optional WhatsApp cancellation (`sendHospitalCancellation` exists, unused); audit; history |
| Reschedule | Pending, Confirmed | same appointment moves to a new slot; old slot released, new reserved in one transaction | WhatsApp with updated details; audit; history keeps old and new slot |
| Complete | Confirmed | status = Completed | audit; history; makes the patient "returning" for future bookings |
| No-show | Confirmed (after slot start time) | status = No-show; capacity not re-released (slot time has passed) | Optional `sendNoShowNotification` (exists, unused); audit; history |

Every action records administrator id, UTC timestamp and, for cancel/no-show/override, a free-text reason.

### 4.5 Rules
- Transitions are validated server-side against section 14.1; illegal moves are rejected with a clear message.
- Terminal states (Cancelled, Completed, No-show) cannot be edited except by a super-admin "reopen", which is audited.
- Admin booking on behalf of a patient (walk-in or phone call) is **[NEW]** and uses the same capacity engine; flagged `source = ADMIN`.

**Data.** `Appointment` gains `source`, `slotId` remains, plus `rescheduledFromId` (optional self-reference), `confirmedAt/By`, `cancelledAt/By`, `completedAt`; new `AppointmentStatusHistory`. See section 16.

---

## 5. Calendar and slot management

### 5.1 Calendar
**What.** Day, week and month views of appointments by slot time, with status colouring in the UI layer, slot capacity indicators (open, nearly full, full, blocked), date navigation and click-through to appointment details.

**Rules.** Uses the same queries as the list so counts match. A slot with `bookedCount >= capacity` shows as full; blocked dates show as closed with their reason.

### 5.2 Availability engine [PARTIAL today]
**Configurable by the administrator:**
- Working days (weekday toggles), opening and closing time per day, and **multiple sessions per day** (the clinic works 09–12 and 17–22, so a day is a list of sessions, not one interval).
- Appointment duration (minutes) and default capacity per slot.
- Generation window (booking horizon, default 30 days).
- Per-slot capacity override, enable/disable a single slot.
- Block a date or a date range (holiday, emergency closure, doctor leave) with a reason.
- View booked and remaining capacity per slot.

**Slot materialisation.** Either generate rows ahead of time (job or on settings save) or compute availability on read from rules. Recommended: store rules in settings, materialise `TimeSlot` rows for the horizon when rules change (never delete a slot that has appointments), and keep the lazy upsert as a safety net.

**Regeneration safety.** Changing duration or hours must not touch slots that already have non-cancelled appointments; those are listed as conflicts for the admin to resolve (move or keep).

**Booking-side rules (public site):**
1. Only active slots on open, unblocked dates, within horizon and cut-off, with remaining capacity > 0, are offered.
2. A full slot disappears from the public picker.
3. Cancel releases one unit of capacity.
4. Reschedule releases the old slot and reserves the new one atomically.
5. Capacity is enforced inside the transaction (see 14.3); two concurrent requests for the last unit cannot both succeed.
6. Admin override of capacity (overbook one slot) requires a permission, a reason, an explicit confirmation, writes an audit entry, and is recorded on the appointment (`overrideReason`).

**Data.** New `Holiday/BlockedDate`, `WorkingSession` (or JSON in settings), and settings values; `TimeSlot` keeps `capacity`, `isActive`; `bookedCount` either becomes derived (count of active appointments) or stays but is updated only inside the transaction and reconciled nightly.

---

## 6. Patient management

**What.** A patient master record, one row per real person, linked to many appointments.

**List and search.** Name, phone, email; sort by last visit; show total appointments, upcoming, completed, cancelled, no-show counts and first/last visit.

**Detail.** Demographics, contact, appointment history, notes (admin-only, short), link to the next upcoming appointment.

**Identification rules (duplicate prevention).**
- Primary key for matching: normalised phone number (10 digits, country code stripped). Booking finds-or-creates a patient by phone.
- If the same phone arrives with a different name, keep the existing patient, record the new name as an alias in the appointment's snapshot, and flag for admin review rather than overwriting.
- Email is secondary: warn on a match with a different phone, do not auto-merge.
- Families sharing one phone are a real case (age/gender differ). Provide a manual merge and "split" operation, both audited.
- Appointment rows keep a snapshot of name/age/gender at booking time so history is accurate if the patient record is later edited.

**New vs returning.** Derived, not self-declared: a patient is **New** until they have a Completed appointment; thereafter **Follow-up**. The patient's own selection at booking is stored as `declaredPatientType` and shown if it disagrees.

**Actions.** Edit contact details, add notes, merge duplicates, (optional) anonymise on request. No hard delete of a patient who has appointments.

**Data.** New `Patient(id, fullName, phone unique, email, age/dateOfBirth, gender, notes, createdAt, updatedAt)`; `Appointment.patientId` foreign key; back-fill migration groups existing rows by phone.

**Privacy.** Health-adjacent personal data; restrict to authenticated admins, log views of patient detail optionally, and define a retention policy.

---

## 7. Doctors management [NEW]

**What.** Replace `doctors.ts` with a database-backed list that drives `/doctors`, the home "Our doctors" section and the senior consultant block.

**Fields.** Name, qualification, designation, registration number, experience (years), specializations (list), biography, optional personal message (senior consultant), photograph, published flag, display order, senior-consultant flag (at most one).

**Actions.** Create, edit, delete or unpublish, upload/replace photograph, publish/unpublish, drag to reorder, mark as senior consultant.

**After an action.** Public pages show the change after publish (revalidate the affected routes/tags, or read at request time).

**Rules.**
- Name and designation required; experience 0 to 60; photograph limited to JPG/PNG/WebP, max size defined in section 8, with enforced aspect ratio or crop.
- Exactly one published senior consultant (or none); setting a new one unsets the old.
- **Deletion with references:** appointments do not currently reference doctors. If doctor assignment to appointments is added later, a doctor with appointments can only be unpublished or archived (soft delete), never hard-deleted.
- Unpublished doctors are hidden publicly but remain editable.

**Data.** `Doctor(id, slug, name, qualification, designation, regNo, experienceYears, specializations[], bio, message, imageAssetId, isSenior, published, sortOrder, createdAt, updatedAt, deletedAt)`.

**Open question.** Do appointments need a doctor? The current model has none; this spec treats slots as clinic-wide.

---

## 8. Gallery management [NEW]

**What.** Admin-managed image gallery replacing `gallery.ts`.

**Fields.** Title, description, category, image, upload date (system), published flag, display order, alt text (required for accessibility).

**Actions.** Upload one or many, preview, replace (keeps id and position), delete, edit metadata, categorise, reorder, publish/unpublish.

**Validation (server side, not just client).** Allowed types by content sniffing (JPG, PNG, WebP), max size per file (suggest 5 MB), max pixel dimensions, max files per batch (suggest 20), filename sanitisation, reject SVG or scriptable formats unless sanitised.

**Storage.** Persistent object storage, not the server filesystem (the Vercel filesystem is ephemeral). Cloudinary is already a dependency choice (`res.cloudinary.com` is allow-listed, env keys exist) and is the natural default. Store provider public id, URL, width, height, bytes, mime type. Delete the stored object when the gallery record is deleted, and tolerate a failed remote delete (retry queue or logged orphan).

**Rules.** An image used elsewhere (hero, doctor, treatment) is managed in its own module but may reference the same asset record; deleting an asset that is referenced is blocked and lists its usages.

**Data.** `MediaAsset(id, provider, publicId, url, width, height, bytes, mime, createdBy, createdAt)`, `GalleryItem(id, assetId, title, description, alt, category, published, sortOrder, createdAt)`.

---

## 9. Treatments and services management [NEW]

**What.** Database-backed treatments and categories replacing `treatments.ts` and the separate hard-coded six-item home preview.

**Categories.** Create, rename, reorder, publish/unpublish. Existing categories: hair, skin, laser. Brief asks for skin and hair treatment management; laser exists today as a third category and should remain configurable.

**Treatment fields.** Name, slug (unique, URL-safe, auto from name), category, short description, full description, image, duration text, benefits list, published, display order, show-on-home flag (drives the home preview so it cannot drift from the full list).

**Actions.** Add, edit, delete, publish/unpublish, reorder (within category), upload/replace image.

**Rules.**
- Changing a slug must keep the old URL working (redirect) or warn, because the slug appears in public URLs and sitemap.
- A category with treatments cannot be deleted; move or unpublish them first.
- Treatments are not linked to appointments today. If "reason for visit" is added to booking, deleting a treatment that appointments reference must be a soft delete.
- Published changes reflect on `/treatments`, home preview and `sitemap.ts`.

**Data.** `TreatmentCategory(id, key, label, sortOrder, published)`, `Treatment(id, slug, categoryId, name, shortDescription, description, imageAssetId, duration, benefits[], showOnHome, published, sortOrder, createdAt, updatedAt, deletedAt)`.

---

## 10. Website content management

Single content store with draft and publish. **Publish** copies draft to live; public pages read live values only.

| Area | Editable fields | Today |
|---|---|---|
| Homepage | hero heading, hero description, hero image(s), banners, CTA headline, CTA body, CTA button labels, trust statistics, "why choose us" items | hard-coded in `HeroSection`, `FinalCTA`, `constants.ts` |
| About | introduction text, hospital information, hospital images | hard-coded in `AboutSection` |
| Testimonials | add, edit, delete, publish/unpublish, rating 1-5, name, treatment, photo (optional), review text, date | `testimonials.ts` |
| FAQ (not in brief, recommended) | question, answer, order, publish | `faq.ts` |
| Contact | phone, email, address, Google Maps embed URL, social links, working hours text | `HOSPITAL` constant, footer, `.env` map URL |

**Rules.**
- Text length limits per field; plain text or a restricted rich-text subset. No raw HTML, to avoid stored XSS.
- Map URL accepted only if it is a `google.com/maps/embed` URL (the footer currently embeds a fixed iframe to an unrelated place, "KS Bakers, Miyapur", which should be corrected when this is built).
- Phone and email validated; the phone also feeds `tel:` links, structured data (JSON-LD) and WhatsApp, so one value is the source of truth.
- A change to contact details updates structured data and metadata too.
- Unpublished content falls back to the last published version.

**Data.** `SiteContent(key unique, value JSON, draftValue JSON, publishedAt, updatedBy)`, `Testimonial` table, optional `Faq` table.

---

## 11. Hospital settings

One settings record, editable by super-admin, all changes audited with before/after values.

| Setting | Notes |
|---|---|
| Hospital name, logo | logo via media asset; also used in emails/WhatsApp text |
| Contact: phone, email, address | single source for site, footer, JSON-LD |
| Working days, opening/closing times, sessions | feeds slot engine (section 5.2) |
| Appointment duration, default slot capacity | applies to newly generated slots |
| Booking on/off | master switch; when off the public page shows a message and create is rejected server-side |
| Booking horizon | days ahead (today 30) |
| Booking cut-off | minimum lead time before slot start (e.g. 2 hours; today booking starts tomorrow) |
| Cancellation rule | patient may cancel up to N hours before the slot |
| Rescheduling rule | up to N hours before, maximum reschedules per appointment |
| Reminder lead time | today fixed at 2 hours |
| Time zone | fixed `Asia/Kolkata` |

**Rules.** Rule changes apply to future bookings only; they never alter existing appointments. Public cancel/reschedule enforce the rules; admin can bypass with a reason (audited).

---

## 12. Admin authentication and accounts [NEW]

**Features.** Email + password login, logout, change password, update own name/email, session expiry and revocation, protected `/admin` routes and APIs, unauthorised access returns 401/403 and a redirect to login.

**Roles (recommended minimum).**
| Role | Can |
|---|---|
| Super admin | everything, including settings, admin accounts, audit log, override capacity, reopen terminal states, delete content |
| Admin / receptionist | appointments, patients, calendar, slot blocking |
| Content editor (optional) | doctors, treatments, gallery, website content |

If only one admin is needed, ship Super admin only but keep the role column.

**Security requirements.**
- Passwords hashed with Argon2id or bcrypt; never stored or logged in plain text.
- Login rate limiting and lockout/backoff; generic error messages.
- HTTP-only, secure, same-site session cookie; idle and absolute timeouts; logout invalidates the server session.
- Authorisation checked in every server action and route handler, not only in the UI or a middleware layer.
- CSRF protection for state-changing requests (Server Actions have built-in origin checks; custom route handlers need their own).
- Admin pages excluded from `robots.ts` and `sitemap.ts`, `noindex`.
- First-admin bootstrap by seed command or one-time environment secret; no public sign-up.
- Optional later: TOTP two-factor, password reset by email.

**Data.** `AdminUser(id, name, email unique, passwordHash, role, isActive, lastLoginAt, failedAttempts, lockedUntil, createdAt)`, `AdminSession(id, userId, tokenHash, expiresAt, ip, userAgent, createdAt)` (if not using a library).

---

## 13. Audit logs and activity history

**What.** Append-only record of administrative actions. Separate from the per-appointment status history, which patients' records need and is a domain table.

**Events to record.** Appointment confirm, cancel, reschedule, complete, no-show, any status change; admin-created bookings; capacity overrides; slot enable/disable, date blocks, settings changes; doctor, treatment, gallery and content create/update/delete/publish/unpublish; patient merge/edit; admin account creation, role change, password change, failed-login bursts, logins.

**Record fields.** Action code, actor admin id (and name snapshot), UTC timestamp, entity type, entity id, short summary, before/after values (JSON, secrets redacted), reason (when required), IP address.

**Viewing.** Filter by actor, action, entity, date range; show on the appointment and patient detail pages.

**Rules.** No update or delete API for audit rows; written in the same database transaction as the change they describe so an action cannot succeed without its log; retention period defined by the clinic.

**Data.** `AuditLog(id, actorId, action, entityType, entityId, summary, before, after, reason, ip, createdAt)` with indexes on `(entityType, entityId)`, `(actorId, createdAt)`, `(createdAt)`. `AppointmentStatusHistory(id, appointmentId, fromStatus, toStatus, actorId?, actorType {PATIENT, ADMIN, SYSTEM}, reason, createdAt)`.

---

## 14. Business rules

### 14.1 Status model
Proposed statuses: **Pending, Confirmed, Completed, Cancelled, No-show** (matches the brief). The current enum has no Pending and has a Rescheduled status; decide:
- **Pending:** use it only if the clinic wants approval before a booking is final. Today bookings are instantly Confirmed. Options: (a) keep instant confirmation and show 0 pending, (b) new bookings start Pending until an admin confirms. This is a business decision and changes patient messaging.
- **Rescheduled:** stop using it as a status. A reschedule changes the slot of the same appointment and is recorded in history (and `rescheduledFromId` if a new row is kept). The existing enum value and old rows need a migration.

Allowed transitions:
```
Pending   -> Confirmed | Cancelled
Confirmed -> Completed | Cancelled | No-show   (Completed and No-show only on/after slot start)
Completed, Cancelled, No-show -> (terminal; super-admin reopen only, audited)
```

### 14.2 Duplicate appointment prevention
- Reject a second active (Pending/Confirmed) appointment for the same patient in the same slot.
- Warn (admin) or reject (public) a second active appointment for the same patient on the same day.
- Keep the existing 5-minute double-submit guard but run it inside the transaction and make it work for all active statuses, not only Confirmed.
- Add an idempotency key per booking attempt so a retried request returns the original result.

### 14.3 Capacity and concurrency
- Reserve capacity with a single conditional update inside a transaction (e.g. `UPDATE ... SET booked = booked + 1 WHERE id = ? AND booked < capacity AND is_active`) and treat zero rows updated as "slot full". Alternative: lock the slot row (`SELECT ... FOR UPDATE`) then count.
- Release happens in the same transaction as cancel/reschedule, with a floor at zero.
- Keep a reconciliation job that compares counter to the count of active appointments and reports drift.
- Remove the "available by default, at least 1" fallback in `getAvailableSlots`.

### 14.4 Cancellation and rescheduling
- Patient (token link): allowed until the configured cut-off before slot start; limited reschedule count; reason optional.
- Admin: allowed any time before the slot ends; after that only Completed or No-show apply.
- Cancelled appointments cannot be rescheduled; completed ones cannot be cancelled.
- Cancel/reschedule tokens should expire after the appointment and be unguessable (cuid is acceptable; consider a longer random token).

### 14.5 Booking cut-off, holidays, unavailable dates
- Cut-off and horizon from settings; reject server-side even if the UI offered the slot.
- Blocked dates override working days and existing slot rows.
- Blocking a date that already has appointments requires a decision: list affected appointments, offer bulk cancel with notification or bulk reschedule; never silently cancel.

### 14.6 Data consistency
- All multi-row changes (status + capacity + history + audit) in one transaction.
- Appointment rows keep a snapshot of patient fields; patient edits do not rewrite history.
- Time stored as slot date plus start time in IST; convert once at the edge.

### 14.7 Authorisation
Every admin mutation checks role and active session; no admin data is readable without a session; public pages never expose admin fields (cancel reason, notes, audit data).

### 14.8 Failure behaviour
The booking engine must **fail loudly**: remove the mock/fallback success paths for create, cancel, reschedule and token lookup. A patient should see "service unavailable, please call" rather than a confirmation that was never saved.

---

## 15. Edge cases

| Scenario | Expected behaviour |
|---|---|
| Two patients book the last slot at once | One succeeds; the other gets "slot just filled" and is shown fresh slots |
| Patient double-clicks submit / network retry | Idempotency key returns the same appointment; no duplicate |
| Same phone, different names (family) | Same patient record, snapshot per appointment, review flag; never overwrite name silently |
| Same person, different phones | Treated as two patients; admin can merge manually |
| Phone with +91, spaces or leading 0 | Normalised to 10 digits before lookup and storage |
| Missing/invalid email | Allowed (optional); invalid format rejected; admin list shows empty |
| Invalid or incomplete patient data from admin edit | Same Zod rules as public booking; name, phone, age, gender required |
| Admin cancels an appointment whose patient has already cancelled | Rejected (already cancelled) |
| Admin confirms an appointment whose slot is full or now blocked | Block with explanation, or override with permission and reason |
| Slot disabled or date blocked after bookings exist | Existing bookings remain; admin sees conflict list and chooses move or cancel |
| Reducing slot capacity below current bookings | Reject, or accept with warning that the slot is over capacity (no auto-cancel) |
| Changing slot duration with future bookings | Only unbooked slots regenerate; conflicts listed |
| Marking Completed/No-show before the slot time | Rejected |
| Reschedule to a slot in the past, blocked, full or inactive | Rejected with reason |
| Holiday falls on a weekday with bookings | Same as blocked-date flow in 14.5 |
| Delete doctor or treatment that is referenced | Soft delete only (archive); hard delete blocked and usages shown |
| Delete gallery image still used by another module | Blocked, usages listed |
| Upload wrong type, oversized, corrupt, or renamed `.exe` as `.jpg` | Rejected by content sniffing and limits |
| Upload succeeds but database write fails (or the reverse) | Delete the orphan remote file, or record it for cleanup |
| Two admins edit the same record | Optimistic concurrency (`updatedAt`/version check); second save shows a conflict |
| Admin session expires mid-edit | Save is refused with 401 and the draft is preserved client-side |
| Admin disabled while logged in | Next request is rejected (session checked server-side every time) |
| Daylight/time-zone mismatch on server | All calculations in `Asia/Kolkata`; a test fixture covers midnight boundaries |
| Reminder cron runs twice or overlaps | `reminderSent` update is conditional so a patient is messaged once |
| WhatsApp send fails | Booking stands; failure recorded on the appointment with a retry option |
| Database unavailable | Admin and public show an error; no fake success |
| Existing data migration | Old `RESCHEDULED` rows, un-linked duplicate patients and counters that drifted are repaired by a one-off, reviewable script |

---

## 16. Required database changes

Existing tables kept: `TimeSlot`, `Appointment` (with changes below).

**Changes to `Appointment`:** add `patientId` (FK), `declaredPatientType`, `source` (`ONLINE`/`ADMIN`), `rescheduledFromId` (nullable self-FK), `rescheduleCount`, `confirmedAt`, `confirmedById`, `cancelledAt`, `cancelledBy` (patient or admin id), `completedAt`, `overrideReason`, `idempotencyKey` (unique, nullable), `version` for optimistic locking; add `PENDING` to the status enum and retire `RESCHEDULED`; keep the snapshot columns (`fullName`, `phone`, `email`, `age`, `gender`); add indexes on `(createdAt)`, `(patientId)`, `(email)`.

**Changes to `TimeSlot`:** keep columns; add check constraint `bookedCount >= 0` and `bookedCount <= capacity` (admin override tracked separately); optional `blockedReason`.

**New tables:** `Patient`, `AdminUser`, `AdminSession`, `AppointmentStatusHistory`, `AuditLog`, `Holiday` (date or range, reason), `WorkingSession` (weekday, start, end) or settings JSON, `Setting` / `HospitalSettings`, `Doctor`, `Treatment`, `TreatmentCategory`, `GalleryItem`, `MediaAsset`, `SiteContent`, `Testimonial`, `Faq`.

**Conventions.** `createdAt`, `updatedAt`, soft-delete `deletedAt` on content tables; `published` and `sortOrder` on every public-facing list; UTC timestamps; slot date as a date plus IST interpretation.

**Migration order.** 1) add new nullable columns and tables; 2) back-fill patients by normalised phone; 3) convert `RESCHEDULED` rows into history entries; 4) seed doctors, treatments, gallery, testimonials, FAQ, constants into the new tables from the current TypeScript files; 5) tighten constraints; 6) switch public pages to read from the database. Take a database backup before step 2.

---

## 17. Required API endpoints

Prefer Server Actions for forms consistent with the codebase; expose route handlers only where a non-form client, file upload or cron needs them. All admin endpoints require a session and a role check, return a typed error shape, validate with Zod, and write audit entries. The list is logical, not final routing.

| Group | Operations |
|---|---|
| Auth | login, logout, current admin, change password, update profile, list/create/disable admins (super-admin) |
| Dashboard | summary counts, time series (day/week/month), recent bookings |
| Appointments | list (search, filters, pagination), get detail, create (admin booking), confirm, cancel, reschedule, complete, mark no-show, reopen, status history |
| Calendar | appointments in range (day/week/month), slot occupancy in range |
| Slots | list slots for date range, generate slots, update capacity, enable/disable slot, create/delete blocked date or range, preview conflicts for a change |
| Patients | list/search, get detail with history, update, add note, find duplicates, merge |
| Doctors | list, get, create, update, delete (archive), publish, unpublish, reorder, upload photo |
| Gallery | list, upload (multi), update metadata, replace image, delete, publish, unpublish, reorder |
| Treatments | list, get, create, update, delete (archive), publish, unpublish, reorder; category CRUD and reorder |
| Content | get/save draft per section, publish, discard draft; testimonial CRUD and publish; FAQ CRUD |
| Settings | get, update (with before/after audit) |
| Audit | list with filters, get entry |
| Media | signed upload, register asset, delete asset |
| System | existing `/api/cron/reminders` (move secret to an `Authorization: Bearer` header, which Vercel Cron supports), a reconciliation job for slot counters |

**Public-site changes needed:** read doctors, treatments, gallery, testimonials, FAQ, contact and settings from the database; slot listing honours capacity, blocked dates and cut-off; cancel/reschedule enforce the rules in section 11.

---

## 18. Dependencies between modules

```
Auth ──> Audit ──> everything that mutates data
Settings ──> Slot engine ──> Public booking ──> Appointments ──> Dashboard, Calendar
Patient master ──> Appointments ──> Patient history, New/Returning logic
Media storage ──> Doctors, Gallery, Treatments, Website content
Treatments/Doctors ──> (future) Appointment fields if visit reason or doctor assignment is added
Website content / Settings ──> Footer, JSON-LD, metadata, WhatsApp text
```

Key couplings to respect:
- The slot engine and capacity transaction must be correct before the dashboard (otherwise utilisation figures mislead).
- Patient back-fill must precede the patient module and the new/returning dashboard split.
- Auth and audit must exist before any other admin mutation ships.
- Contact settings are one source of truth for several public surfaces.

---

## 19. Open decisions for the clinic

1. Does a booking need admin approval (Pending), or stay instantly confirmed?
2. Is capacity 2 per hour correct, and should admins be allowed to overbook (with reason)?
3. Do appointments need a doctor or treatment attached? (Current model has neither.)
4. How many admin accounts, and which roles?
5. Authoritative working hours: the code disagrees with itself (section 1.9, item 9).
6. Cancellation and reschedule cut-off hours, and reschedule limit.
7. Should patients be notified on admin cancel, no-show and reschedule, and in which language?
8. Image storage provider (Cloudinary assumed) and per-file size limit.
9. Data retention period for patient and audit records.
10. Whether to keep the stubbed OTP step or implement real phone verification before the admin portal launches.
