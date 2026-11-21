import { BOOKING_HOURS, addDaysUTC, formatDateForApi, getBookableDates, isDateBookable, parseApiDate, slotStartsAt, todayIST } from "../slots";
import { formatTime12Hour } from "../utils";
import type { Data } from "./unit";
import {
  DOCTOR_GROUPS,
  done,
  doctorGroupLabel,
  fail,
  fromMin,
  isLive,
  periodOf,
  slotKey,
  slotName,
  TIME_RE,
  toMin,
  usesCapacity,
  type Appointment,
  type DayInfo,
  type Doctor,
  type DoctorCapacityRow,
  type DoctorGroup,
  type PlanItem,
  type PlanTarget,
  type Raw,
  type SessionConfig,
  type SlotView,
} from "./types";

// ---------- time slots ----------

export function sessionSlotTimes(s: SessionConfig): { startTime: string; endTime: string }[] {
  const out: { startTime: string; endTime: string }[] = [];
  const end = toMin(s.endTime);
  for (let t = toMin(s.startTime); t < end; t += 60) out.push({ startTime: fromMin(t), endTime: fromMin(Math.min(t + 60, end)) });
  return out;
}

export function sessionOf(startTime: string, sessions: SessionConfig[]): SessionConfig | undefined {
  const m = toMin(startTime);
  const inWin = (s: SessionConfig) => m >= toMin(s.startTime) && m < toMin(s.endTime);
  return sessions.find((s) => s.active && inWin(s)) ?? sessions.find(inWin);
}

export const sessionLabel = (s: SessionConfig | undefined) => (s ? slotName(s.startTime, s.endTime) : "Outside time slots");

export function blockedReason(date: string, d: Pick<Data, "blockedDates">): string | null {
  return d.blockedDates.find((b) => b.date === date)?.reason ?? null;
}

/** The slots of one date with how many places are used. `d.appointments` must contain that date's appointments. */
export function slotsFor(date: string, d: Data): SlotView[] {
  const day = parseApiDate(date);
  if (Number.isNaN(day.getTime()) || day.getUTCDay() === 0) return [];
  const live = d.appointments.filter((a) => usesCapacity(a) && a.date === date);
  const out: SlotView[] = [];
  for (const s of d.sessions.filter((x) => x.active).sort((a, b) => toMin(a.startTime) - toMin(b.startTime))) {
    const sessionBooked = live.filter((a) => sessionOf(a.startTime, d.sessions)?.id === s.id).length;
    for (const t of sessionSlotTimes(s)) {
      const id = slotKey(date, t.startTime);
      const o = d.slotOverrides[id] ?? {};
      const cap = o.capacity; // optional limit for this date only
      const booked = live.filter((a) => a.startTime === t.startTime).length;
      const room = Math.min(s.capacity - sessionBooked, cap === undefined ? Infinity : cap - booked);
      out.push({
        id,
        date,
        startTime: t.startTime,
        endTime: t.endTime,
        sessionId: s.id,
        sessionName: periodOf(t.startTime),
        sessionCapacity: s.capacity,
        sessionBooked,
        slotCapacity: cap ?? null,
        booked,
        remaining: Math.max(0, room),
        disabled: !!o.disabled,
      });
    }
  }
  return out;
}

/** Slots a patient or admin may book. `ignoreId`: an appointment being edited does not count against itself. */
export function bookableSlotsFrom(date: string, d: Data, ignoreId?: string): SlotView[] {
  if (!isDateBookable(parseApiDate(date)) || blockedReason(date, d)) return [];
  const self = d.appointments.find((a) => a.id === ignoreId && isLive(a));
  return slotsFor(date, d)
    .filter((s) => !s.disabled)
    .map((s) => {
      if (!self || self.date !== date) return s;
      const sameSession = sessionOf(self.startTime, d.sessions)?.id === s.sessionId;
      const sameSlot = self.startTime === s.startTime;
      const room = Math.min(s.sessionCapacity - s.sessionBooked + (sameSession ? 1 : 0), s.slotCapacity === null ? Infinity : s.slotCapacity - s.booked + (sameSlot ? 1 : 0));
      return { ...s, remaining: Math.max(0, room) };
    })
    .filter((s) => s.remaining > 0 || (self && self.date === date && self.startTime === s.startTime));
}

export function dayInfo(date: string, d: Data): DayInfo {
  const day = parseApiDate(date);
  const blocked = blockedReason(date, d);
  const holiday = day.getUTCDay() === 0;
  const live = d.appointments.filter((a) => isLive(a) && a.date === date).length;
  const slots = slotsFor(date, d);
  let capacity = 0;
  const seen = new Set<string>();
  for (const s of slots) {
    if (seen.has(s.sessionId)) continue;
    seen.add(s.sessionId);
    capacity += s.sessionCapacity;
  }
  // remaining places: per time slot, limited by that slot's enabled hours
  const bySession = new Map<string, number>();
  for (const s of slots) if (!s.disabled) bySession.set(s.sessionId, Math.max(bySession.get(s.sessionId) ?? 0, s.remaining));
  const remaining = [...bySession.values()].reduce((a, b) => a + b, 0);
  const past = day.getTime() <= todayIST().getTime() && !blocked;
  const state: DayInfo["state"] = blocked ? "blocked" : holiday ? "holiday" : past ? "past" : remaining <= 0 ? "full" : "available";
  return { date, blocked, holiday, capacity, booked: live, remaining, appointments: live, state };
}

/** Checks a changed set of time slots. `d.appointments` must contain every upcoming appointment. */
export function validateSessions(d: Data, next: SessionConfig[]): string | null {
  const active = next.filter((s) => s.active);
  for (const s of next) {
    if (!TIME_RE.test(s.startTime) || !TIME_RE.test(s.endTime)) return "Times must be in HH:mm format";
    if (toMin(s.startTime) >= toMin(s.endTime)) return `${s.name}: end time must be after start time`;
    if (toMin(s.endTime) - toMin(s.startTime) > 60) return `${s.name}: a time slot can be at most 60 minutes long`;
    if (!Number.isInteger(s.capacity) || s.capacity < 1 || s.capacity > 500) return `${s.name}: capacity must be a whole number from 1 to 500`;
  }
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      if (toMin(active[i].startTime) < toMin(active[j].endTime) && toMin(active[j].startTime) < toMin(active[i].endTime)) {
        return `${active[i].name} and ${active[j].name} overlap`;
      }
    }
  }
  // existing upcoming bookings must still fit
  const today = formatDateForApi(todayIST());
  const counts = new Map<string, number>();
  for (const a of d.appointments.filter((x) => isLive(x) && x.date >= today)) {
    const s = sessionOf(a.startTime, next.filter((x) => x.active));
    if (!s || !sessionSlotTimes(s).some((t) => t.startTime === a.startTime)) {
      return `Upcoming appointment ${a.id} (${a.date} ${formatTime12Hour(a.startTime)}) would fall outside every active time slot`;
    }
    const k = `${a.date}|${s.id}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
    if (counts.get(k)! > s.capacity) return `${s.name} already has ${counts.get(k)} bookings on ${a.date}; capacity cannot go below that`;
  }
  return null;
}

// ---------- doctor-wise capacity ----------

/** Dr. Lakshmi is the senior consultant profile. */
export function lakshmiDoctor(d: Pick<Data, "doctors">): Doctor | undefined {
  return d.doctors.find((x) => x.published && x.isSenior) ?? d.doctors.find((x) => x.published && x.id === "dr-lakshmi-villa");
}

export const groupBooked = (d: Data, date: string, g: DoctorGroup, ignoreId?: string) =>
  d.appointments.filter((a) => usesCapacity(a) && a.date === date && a.doctorGroup === g && a.id !== ignoreId).length;

/** Capacity and bookings of each doctor group on one date. Dr. Lakshmi is always first. */
export function doctorCapacity(date: string, d: Data): DoctorCapacityRow[] {
  const lakshmi = lakshmiDoctor(d);
  return DOCTOR_GROUPS.map((group) => {
    const booked = groupBooked(d, date, group);
    const capacity = d.doctorCaps[group];
    return {
      group,
      label: doctorGroupLabel(group),
      doctors: group === "LAKSHMI" ? (lakshmi ? [lakshmi.name] : []) : d.doctors.filter((x) => x.published && x.id !== lakshmi?.id).map((x) => x.name),
      capacity,
      booked,
      remaining: Math.max(0, capacity - booked),
    };
  });
}

// ---------- opening a slot for a booking ----------

/** Can this slot take a booking (or a moved appointment `ignoreId`)? Returns the slot or the reason it cannot. */
export function checkSlotOpen(d: Data, slotId: string, ignoreId?: string, admin = false, group?: DoctorGroup | null): Raw<SlotView> {
  const [date, time] = slotId.split("_");
  const day = parseApiDate(date);
  const okDate = admin
    ? day.getTime() >= todayIST().getTime() && day.getTime() <= addDaysUTC(todayIST(), BOOKING_HOURS.maxDaysAhead).getTime() && day.getUTCDay() !== 0
    : isDateBookable(day);
  if (!okDate) return fail("Selected date is not available for booking");
  if (admin && slotStartsAt(parseApiDate(date), time ?? "").getTime() <= Date.now()) return fail("That time has already started; choose a later slot");
  if (blockedReason(date, d)) return fail("The clinic is closed on that date");
  const slot = slotsFor(date, d).find((s) => s.id === slotId);
  if (!slot || slot.disabled) return fail("Selected slot is no longer available");
  const self = d.appointments.find((a) => a.id === ignoreId && isLive(a) && a.date === date);
  let room = slot.remaining;
  if (self && sessionOf(self.startTime, d.sessions)?.id === slot.sessionId) {
    // an appointment being moved does not count against its own time slot
    room = Math.min(slot.sessionCapacity - slot.sessionBooked + 1, slot.slotCapacity === null ? Infinity : slot.slotCapacity - slot.booked + (self.startTime === slot.startTime ? 1 : 0));
  }
  if (room <= 0) return fail("This time slot is fully booked. Please choose another.");
  const grp = group ?? d.appointments.find((a) => a.id === ignoreId)?.doctorGroup;
  if (grp && groupBooked(d, date, grp, ignoreId) >= d.doctorCaps[grp]) return fail(`${doctorGroupLabel(grp)} is fully booked on this date. Please choose another date or doctor.`);
  return done(slot);
}

// ---------- blocking a date ----------

/**
 * Proposes new slots for every live appointment on `date`, as it would be after blocking it.
 * Never proposes a blocked date, a Sunday, a disabled slot or a slot without room;
 * earlier proposals in the same plan use up capacity so two patients never get the last place.
 * `overrides[appointmentId]` is an admin-chosen date (yyyy-MM-dd) or slot id.
 * `d.appointments` must contain `date` and every bookable day.
 */
export function planBlock(date: string, overrides: Record<string, string>, d: Data): PlanItem[] {
  const affected = d.appointments.filter((a) => isLive(a) && a.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime) || a.createdAt.localeCompare(b.createdAt));
  const base = parseApiDate(date).getTime();
  const candidates = getBookableDates()
    .map(formatDateForApi)
    .filter((x) => x !== date && !blockedReason(x, d))
    .sort((x, y) => {
      const dx = Math.abs(parseApiDate(x).getTime() - base);
      const dy = Math.abs(parseApiDate(y).getTime() - base);
      return dx - dy || y.localeCompare(x); // nearer first; on a tie prefer the later date
    });
  const takenSlot = new Map<string, number>();
  const takenSession = new Map<string, number>();
  const takenGroup = new Map<string, number>();
  const room = (s: SlotView) =>
    Math.min(s.sessionCapacity - s.sessionBooked - (takenSession.get(`${s.date}|${s.sessionId}`) ?? 0), s.slotCapacity === null ? Infinity : s.slotCapacity - s.booked - (takenSlot.get(s.id) ?? 0));

  const pick = (a: Appointment, dates: string[], onlySlot?: string): PlanTarget | null => {
    const mySession = sessionOf(a.startTime, d.sessions)?.id;
    for (const day of dates) {
      const g = a.doctorGroup;
      const gKey = `${day}|${g}`;
      // the doctor group's own daily capacity must have room on that day too
      if (g && d.doctorCaps[g] - groupBooked(d, day, g) - (takenGroup.get(gKey) ?? 0) <= 0) continue;
      const slots = slotsFor(day, d).filter((s) => !s.disabled && room(s) > 0 && (!onlySlot || s.id === onlySlot));
      if (slots.length === 0) continue;
      const rank = (s: SlotView) => (s.startTime === a.startTime ? 0 : s.sessionId === mySession ? 1 : 2) * 10_000 + Math.abs(toMin(s.startTime) - toMin(a.startTime));
      const s = [...slots].sort((p, q) => rank(p) - rank(q))[0];
      if (g) takenGroup.set(gKey, (takenGroup.get(gKey) ?? 0) + 1);
      takenSlot.set(s.id, (takenSlot.get(s.id) ?? 0) + 1);
      takenSession.set(`${s.date}|${s.sessionId}`, (takenSession.get(`${s.date}|${s.sessionId}`) ?? 0) + 1);
      return { slotId: s.id, date: s.date, startTime: s.startTime, endTime: s.endTime, sessionName: s.sessionName };
    }
    return null;
  };

  return affected.map((a) => {
    const ov = overrides[a.id];
    if (ov) {
      const slotMode = ov.includes("_");
      const day = slotMode ? ov.split("_")[0] : ov;
      if (day === date || blockedReason(day, d) || !isDateBookable(parseApiDate(day))) {
        return { appointment: a, target: null, manual: true, reason: "The chosen date is blocked or outside the booking window" };
      }
      const t = pick(a, [day], slotMode ? ov : undefined);
      return t ? { appointment: a, target: t, manual: true } : { appointment: a, target: null, manual: true, reason: "No capacity on the chosen date" };
    }
    const t = pick(a, candidates);
    return t ? { appointment: a, target: t, manual: false } : { appointment: a, target: null, manual: false, reason: "No available alternative within the booking window" };
  });
}
