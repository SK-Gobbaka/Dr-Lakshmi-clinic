# Lakshmi Hair & Skin Hospital

Production-ready public website and online appointment booking system for a premium Hair & Skin Hospital.

## Features

- **Public Website**: Home, Doctors, Treatments pages with premium healthcare design
- **Appointment Booking**: Multi-step flow (Date → Time → Details → Review → Confirmation)
- **Slot Management**: Configurable capacity per slot; full slots hidden automatically
- **WhatsApp Notifications**: Booking confirmation, 2-hour reminders, cancellation, no-show
- **SEO**: Dynamic meta tags, Open Graph, Twitter Cards, Schema.org structured data, sitemap
- **Accessibility**: WCAG AA focus states, skip links, semantic HTML, ARIA labels

## Tech Stack

- Next.js 16 (App Router) · TypeScript · Tailwind CSS v4
- Shadcn-style UI components · Framer Motion · React Hook Form · Zod
- JSON file data store · WhatsApp Business API · Cloudinary

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Installation

```bash
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL and API keys
```

### Database Setup

```bash
npm run db:push
npm run db:seed
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm start
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_SITE_URL` | Public site URL for links and SEO |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta WhatsApp Business phone number ID |
| `WHATSAPP_ACCESS_TOKEN` | Meta WhatsApp Business API token |
| `CRON_SECRET` | Secret for reminder cron endpoint |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name (optional) |

## WhatsApp Integration

Configure Meta WhatsApp Business API credentials in `.env`. When not configured, messages are logged to the console in development.

### Cron Reminders

Set up a cron job to call every 15 minutes:

```
GET /api/cron/reminders?secret=YOUR_CRON_SECRET
```

## Project Structure

```
src/
├── app/              # Next.js App Router pages
├── actions/          # Server Actions (appointments)
├── components/       # UI and page components
│   ├── booking/      # Booking wizard
│   ├── home/         # Home page sections
│   ├── layout/       # Header, Footer
│   └── ui/           # Reusable UI primitives
└── lib/              # Utilities, data, validations
```

## License

Private — All rights reserved.

## Appointment management (added)

- **Sessions and capacity**: Admin > Sessions & capacity. Each session (name, start, end, appointments per day) limits bookings; pending and confirmed both count.
- **Appointment types**: Admin > Appointment types. Types are stored in the data store, not in code; patients must pick an active type.
- **Booking policy**: online bookings are Pending until an admin confirms them (confirming notifies patient and admin). A toggle on the Sessions page confirms them automatically instead.
- **Blocking a date**: Admin > Calendar > Block this date shows the affected appointments, proposes new slots, and only applies the plan after approval. Appointments with no alternative are flagged, never cancelled.
- **Patients**: `/my-appointments` lists every appointment booked from the current browser (signed cookie, no accounts), with the notification bell and history.
- **Data**: still the local JSON store (`.local-data/store.json`, override with `LOCAL_STORE_FILE`); writes are serialised with a lock file and rolled back on failure.
- **Optional env**: `ADMIN_WHATSAPP_NUMBER` (admin gets confirmation messages on WhatsApp), `NEXT_PUBLIC_CLINIC_LAT` / `NEXT_PUBLIC_CLINIC_LNG` (exact map pin).
