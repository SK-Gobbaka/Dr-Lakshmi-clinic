import { BOOKING_HOURS } from "./constants";

// All dates are calendar dates in India held as UTC midnight, which is how
// Postgres @db.Date round-trips them. Never use server-local startOfDay here:
// on an IST machine it shifts stored dates back by one day.
const DAY_MS = 86_400_000;
const IST_OFFSET_MIN = 330;

export function generateTimeSlotsForDay(): { startTime: string; endTime: string }[] {
  return [
    { startTime: "09:00", endTime: "10:00" },
    { startTime: "10:00", endTime: "11:00" },
    { startTime: "11:00", endTime: "12:00" },
    { startTime: "17:00", endTime: "18:00" },
    { startTime: "18:00", endTime: "19:00" },
    { startTime: "19:00", endTime: "20:00" },
    { startTime: "20:00", endTime: "21:00" },
    { startTime: "21:00", endTime: "22:00" },
  ];
}

/** Today's date in India, as UTC midnight. */
export function todayIST(): Date {
  const s = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return new Date(`${s}T00:00:00Z`);
}

export function addDaysUTC(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** The real instant a slot starts, given its date (UTC midnight) and "HH:mm" in IST. */
export function slotStartsAt(date: Date, startTime: string): Date {
  const [h, m] = startTime.split(":").map(Number);
  return new Date(date.getTime() + (h * 60 + m - IST_OFFSET_MIN) * 60_000);
}

export function getBookableDates(): Date[] {
  const today = todayIST();
  const dates: Date[] = [];
  for (let i = 1; i <= BOOKING_HOURS.maxDaysAhead; i++) {
    const date = addDaysUTC(today, i);
    if (date.getUTCDay() !== 0) dates.push(date);
  }
  return dates;
}

export function formatDateForApi(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseApiDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

export function isDateBookable(date: Date): boolean {
  const today = todayIST();
  // NaN (invalid date string) makes every comparison false
  return (
    date.getTime() > today.getTime() &&
    date.getTime() <= addDaysUTC(today, BOOKING_HOURS.maxDaysAhead).getTime() &&
    date.getUTCDay() !== 0
  );
}

/** Sunday is holiday - returns empty slots */
export function getSlotsForDate(date: Date): { startTime: string; endTime: string }[] {
  return date.getUTCDay() === 0 ? [] : generateTimeSlotsForDay();
}
