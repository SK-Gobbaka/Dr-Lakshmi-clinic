import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as clinic from "../src/lib/clinic";
import { closeDb, sql } from "../src/lib/db";
import { day, insertStarted, resetDb } from "./helpers/db";

const person = (n: number, over: Partial<clinic.NewAppointment> = {}): clinic.NewAppointment => ({
  slotId: `${day(10)}_09:00`,
  fullName: `Patient ${String.fromCharCode(65 + (n % 26))}${String.fromCharCode(65 + Math.floor(n / 26))}`,
  phone: `9${String(100000000 + n).padStart(9, "0")}`,
  age: 30,
  gender: "MALE",
  patientType: "NEW",
  doctorGroup: "OTHERS",
  ...over,
});

const must = <T>(r: clinic.Result<T>): T => {
  if (!r.ok) throw new Error(r.error);
  return r.data;
};
const left = async (date: string, id: string) => (await clinic.bookableSlots(date)).find((s) => s.id === id)?.remaining;
const nineAm = async () => (await clinic.listSessions()).find((s) => s.startTime === "09:00")!;

beforeEach(resetDb);
afterAll(closeDb);

describe("defaults", () => {
  it("starts with eight 25-place slots, four types and only Dr. Lakshmi", async () => {
    const slots = await clinic.listSessions();
    expect(slots).toHaveLength(8);
    expect(slots.every((s) => s.capacity === 25)).toBe(true);
    expect(await clinic.listTypes()).toHaveLength(4);
    expect((await clinic.listDoctors()).map((d) => d.id)).toEqual(["dr-lakshmi-villa"]);
    expect(await clinic.listTreatments()).toHaveLength(0);
  });
});

describe("booking and capacity", () => {
  it("books a slot and lowers the places left", async () => {
    const id = `${day(10)}_09:00`;
    const before = (await left(day(10), id))!;
    const a = must(await clinic.createAppointment(person(1)));
    expect(a.id).toMatch(/^APT-\d{4}-001$/);
    expect(a.status).toBe("PENDING");
    expect(a.typeName).toBe("General Consultation");
    expect(await left(day(10), id)).toBe(before - 1);
  });

  it("maps New and Follow-up to the right appointment type, and the doctor choice to a group", async () => {
    const f = must(await clinic.createAppointment(person(2, { patientType: "FOLLOW_UP", doctorGroup: "LAKSHMI" })));
    expect(f.typeName).toBe("Follow-up Visit");
    expect(f.doctorGroup).toBe("LAKSHMI");
    expect(f.doctorName).toContain("LAKSHMI");
    const o = must(await clinic.createAppointment(person(3)));
    expect(o.doctorGroup).toBe("OTHERS");
    expect(o.doctorName).toBe("Other Doctors");
  });

  it("refuses a full slot and hides it from the booking page", async () => {
    const s = await nineAm();
    must(await clinic.saveSession({ id: s.id, startTime: "09:00", endTime: "10:00", capacity: 2 }, "t"));
    must(await clinic.createAppointment(person(1)));
    must(await clinic.createAppointment(person(2)));
    const third = await clinic.createAppointment(person(3));
    expect(third.ok).toBe(false);
    expect((await clinic.bookableSlots(day(10))).some((x) => x.id === `${day(10)}_09:00`)).toBe(false);
  });

  it("shows an admin capacity change straight away and never lets it drop below existing bookings", async () => {
    const s = await nineAm();
    must(await clinic.saveSession({ id: s.id, startTime: "09:00", endTime: "10:00", capacity: 5 }, "t"));
    must(await clinic.createAppointment(person(1)));
    must(await clinic.createAppointment(person(2)));
    expect(await left(day(10), `${day(10)}_09:00`)).toBe(3);
    expect((await clinic.saveSession({ id: s.id, startTime: "09:00", endTime: "10:00", capacity: 1 }, "t")).ok).toBe(false);
  });

  it("keeps Dr. Lakshmi's capacity separate from Other Doctors", async () => {
    must(await clinic.setDoctorCapacity("LAKSHMI", 2, "t"));
    must(await clinic.createAppointment(person(1, { doctorGroup: "LAKSHMI", slotId: `${day(10)}_09:00` })));
    must(await clinic.createAppointment(person(2, { doctorGroup: "LAKSHMI", slotId: `${day(10)}_10:00` })));
    const third = await clinic.createAppointment(person(3, { doctorGroup: "LAKSHMI", slotId: `${day(10)}_11:00` }));
    expect(third.ok).toBe(false);
    must(await clinic.createAppointment(person(4, { doctorGroup: "OTHERS", slotId: `${day(10)}_11:00` })));
    const rows = await clinic.doctorCapacityFor(day(10));
    expect(rows[0]).toMatchObject({ group: "LAKSHMI", capacity: 2, booked: 2, remaining: 0 });
    expect(rows[1]).toMatchObject({ group: "OTHERS", booked: 1 });
  });

  it("books a treatment with only a slot and takes a place, but no doctor group", async () => {
    const t = must(await clinic.createAppointment({ kind: "TREATMENT", slotId: `${day(10)}_18:00`, fullName: "Treat One", phone: "9101010101", age: 28, gender: "FEMALE" }));
    expect(t.doctorGroup).toBeNull();
    expect(clinic.appointmentLabel(t)).toBe("Treatment");
    expect(await left(day(10), `${day(10)}_18:00`)).toBe(24);
  });

  it("rejects dates outside the window, Sundays, and the same person twice in a slot", async () => {
    expect((await clinic.createAppointment(person(1, { slotId: `${day(60)}_09:00` }))).ok).toBe(false);
    must(await clinic.createAppointment(person(1)));
    const twice = await clinic.createAppointment(person(1));
    expect(twice.ok).toBe(false);
  });
});

describe("cancel and reschedule release and take places", () => {
  it("cancelling frees the slot and the doctor group", async () => {
    const a = must(await clinic.createAppointment(person(1, { doctorGroup: "LAKSHMI" })));
    const slot = `${day(10)}_09:00`;
    const during = (await left(day(10), slot))!;
    const c = must(await clinic.setStatus(a.id, "CANCELLED", "admin", { reason: "test" }));
    expect(c.cancelledBy).toBe("ADMIN");
    expect(await left(day(10), slot)).toBe(during + 1);
    expect((await clinic.doctorCapacityFor(day(10)))[0].booked).toBe(0);
  });

  it("rescheduling frees the old slot and uses the new one", async () => {
    const a = must(await clinic.createAppointment(person(1)));
    const oldSlot = `${day(10)}_09:00`;
    const newSlot = `${day(13)}_17:00`;
    const [o, n] = [(await left(day(10), oldSlot))!, (await left(day(13), newSlot))!];
    const moved = must(await clinic.reschedule(a.id, newSlot, "admin"));
    expect(moved.date).toBe(day(13));
    expect(moved.rescheduleCount).toBe(1);
    expect(await left(day(10), oldSlot)).toBe(o + 1);
    expect(await left(day(13), newSlot)).toBe(n - 1);
  });
});

describe("history", () => {
  it("records what changed in the appointment events, as structured data", async () => {
    const a = must(await clinic.createAppointment(person(1)));
    must(await clinic.reschedule(a.id, `${day(13)}_17:00`, "admin"));
    const events = await sql()`select kind, actor, jsonb_typeof(changes) as shape from appointment_events where appointment_id = ${a.id} order by id`;
    expect(events.map((e) => e.kind)).toEqual(["created", "reschedule"]);
    expect(events[1].shape).toBe("array");
  });
});

describe("completion and tokens", () => {
  it("gives sequential tokens from 1 and never a second token for the same appointment", async () => {
    await insertStarted("T-1");
    await insertStarted("T-2", "9000000002");
    const first = must(await clinic.setStatus("T-1", "COMPLETED", "admin"));
    expect(first.tokenNumber).toBe(1);
    expect((await clinic.setStatus("T-1", "COMPLETED", "admin")).ok).toBe(false);
    const second = must(await clinic.setStatus("T-2", "COMPLETED", "admin"));
    expect(second.tokenNumber).toBe(2);
    expect((await clinic.tokenInfo()).last).toBe(2);
  });

  it("hands out distinct tokens when many appointments are completed at the same moment", async () => {
    for (let i = 1; i <= 6; i++) await insertStarted(`C-${i}`, `90000001${i}0`);
    const results = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => clinic.setStatus(`C-${i}`, "COMPLETED", "admin")));
    const tokens = results.map((r) => must(r).tokenNumber).sort((a, b) => a! - b!);
    expect(tokens).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("only allows completion once the appointment has started", async () => {
    const a = must(await clinic.createAppointment(person(1)));
    expect((await clinic.setStatus(a.id, "COMPLETED", "admin")).ok).toBe(false);
  });
});

describe("concurrent bookings", () => {
  it("never overbooks the last places", async () => {
    const s = await nineAm();
    must(await clinic.saveSession({ id: s.id, startTime: "09:00", endTime: "10:00", capacity: 3 }, "t"));
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => clinic.createAppointment(person(i + 1))));
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    const [{ n }] = await sql()`select count(*)::int as n from appointments where date = ${day(10)} and start_time = '09:00'`;
    expect(n).toBe(3);
  });

  it("gives every booking its own appointment number", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => clinic.createAppointment(person(i + 1, { slotId: `${day(10 + (i % 3))}_1${i % 2}:00` }))));
    const ids = results.filter((r) => r.ok).map((r) => (r as { ok: true; data: clinic.Appointment }).data.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(0);
  });

  it("does not use up appointment numbers when a booking is refused", async () => {
    must(await clinic.createAppointment(person(1)));
    await clinic.createAppointment(person(1)); // duplicate: refused
    const next = must(await clinic.createAppointment(person(2)));
    expect(next.id).toMatch(/-002$/);
  });
});

describe("blocking dates", () => {
  it("cancel-all cancels every live appointment on the date and keeps the date closed", async () => {
    const date = day(14);
    for (let i = 1; i <= 4; i++) must(await clinic.createAppointment(person(i, { slotId: `${date}_${i % 2 ? "09:00" : "18:00"}` })));
    must(await clinic.setStatus((await clinic.appointmentsOn(date))[0].id, "CONFIRMED", "admin"));
    const closed = must(await clinic.emergencyClose(date, "Power cut", "admin"));
    expect(closed.cancelled).toHaveLength(4);
    const all = await clinic.appointmentsOn(date);
    expect(all).toHaveLength(4);
    expect(all.every((a) => a.status === "CANCELLED" && a.cancelledBy === "ADMIN" && a.cancelReason?.includes("Power cut"))).toBe(true);
    expect((await clinic.bookableSlots(date)).length).toBe(0);
    expect((await clinic.createAppointment(person(9, { slotId: `${date}_09:00` }))).ok).toBe(false);
    expect((await clinic.emergencyClose(date, "again", "admin")).ok).toBe(true); // safe to repeat
  });

  it("moves appointments to the planned slots and flags the ones with no plan", async () => {
    const date = day(14);
    const a = must(await clinic.createAppointment(person(1, { slotId: `${date}_09:00` })));
    const b = must(await clinic.createAppointment(person(2, { slotId: `${date}_10:00` })));
    const target = `${day(15)}_09:00`;
    const out = must(await clinic.blockDate(date, "Holiday", "admin", { [a.id]: target, [b.id]: null }));
    expect(out.moved).toEqual([{ id: a.id, to: `${day(15)} 09:00` }]);
    expect(out.flagged).toEqual([b.id]);
    expect((await clinic.getAppointment(a.id))!.date).toBe(day(15));
    expect((await clinic.getAppointment(b.id))!.needsAttention).toBe(true);
  });
});

describe("appointment types, doctors and treatments", () => {
  it("keeps the type name on old appointments after a rename or a delete, and keeps one active type", async () => {
    const a = must(await clinic.createAppointment(person(1, { typeId: "type-hair" })));
    must(await clinic.saveType({ id: "type-hair", name: "Hair Care" }, "t"));
    expect(clinic.appointmentLabel((await clinic.getAppointment(a.id))!)).toBe("Hair Care");
    must(await clinic.deleteType("type-hair", "t"));
    expect(clinic.appointmentLabel((await clinic.getAppointment(a.id))!)).toBe("Hair Care");
    for (const t of (await clinic.listTypes()).slice(1)) must(await clinic.deleteType(t.id, "t"));
    expect((await clinic.deleteType((await clinic.listTypes())[0].id, "t")).ok).toBe(false);
  });

  it("will not delete Dr. Lakshmi, and will not delete a doctor with upcoming appointments", async () => {
    expect((await clinic.deleteDoctor("dr-lakshmi-villa", "t")).ok).toBe(false);
    const doc = must(await clinic.saveDoctor({ name: "Dr. Test Doctor", qualification: "MD", designation: "Consultant", regNo: "", experience: 5, specialization: [], bio: "", message: "", isSenior: false, published: true }, "t"));
    must(await clinic.createAppointment(person(1, { doctorId: doc.id, doctorGroup: undefined })));
    expect((await clinic.deleteDoctor(doc.id, "t")).ok).toBe(false);
    must(await clinic.setStatus((await clinic.appointmentsOn(day(10)))[0].id, "CANCELLED", "admin", { reason: "x" }));
    must(await clinic.deleteDoctor(doc.id, "t"));
  });

  it("changes the senior consultant without ever having two", async () => {
    const doc = must(await clinic.saveDoctor({ name: "Dr. New Senior", qualification: "", designation: "Senior", regNo: "", experience: 1, specialization: [], bio: "", message: "", isSenior: true, published: true }, "t"));
    expect((await clinic.getSeniorDoctor())?.id).toBe(doc.id);
    expect((await clinic.listDoctors()).filter((d) => d.isSenior)).toHaveLength(1);
  });

  it("saves a treatment with subcategories and rejects a duplicate title", async () => {
    const t = must(await clinic.saveTreatment({ name: "Hair Care", image: "https://example.com/x.png", subcategories: ["PRP", "Mesotherapy", "Transplant"], published: true }, "t"));
    expect(t.subcategories).toHaveLength(3);
    expect((await clinic.listTreatments({ publishedOnly: true }))[0].slug).toBe("hair-care");
    expect((await clinic.saveTreatment({ name: "hair care", subcategories: [], published: true }, "t")).ok).toBe(false);
  });
});

describe("time slots", () => {
  it("adds a slot with the default capacity, refuses overlaps, and will not delete a slot that has bookings", async () => {
    const added = must(await clinic.saveSession({ startTime: "12:00", endTime: "12:30" }, "t"));
    expect(added.capacity).toBe(25);
    expect((await clinic.saveSession({ startTime: "12:15", endTime: "12:45" }, "t")).ok).toBe(false);
    must(await clinic.deleteSession(added.id, "t"));
    must(await clinic.createAppointment(person(1)));
    expect((await clinic.deleteSession((await nineAm()).id, "t")).ok).toBe(false);
  });
});

describe("reports", () => {
  it("counts the dashboard statistics from the records", async () => {
    await insertStarted("R-1");
    must(await clinic.setStatus("R-1", "COMPLETED", "admin"));
    const a = must(await clinic.createAppointment(person(1)));
    must(await clinic.reschedule(a.id, `${day(13)}_17:00`, "admin"));
    const b = must(await clinic.createAppointment(person(2)));
    must(await clinic.setStatus(b.id, "CANCELLED", "admin", { reason: "x" }));
    const { overall } = await clinic.dashboardStats();
    expect(overall).toEqual({ appointments: 3, completed: 1, rescheduled: 1, cancelled: 1 });
  });

  it("lists patients by phone with their appointments and finds them by name or number", async () => {
    must(await clinic.createAppointment(person(1, { phone: "9876543210", fullName: "Ravi Kumar" })));
    must(await clinic.createAppointment(person(2, { phone: "9876543210", fullName: "Ravi Kumar", slotId: `${day(10)}_10:00` })));
    const byPhone = await clinic.listPatients({ q: "98765" });
    expect(byPhone.total).toBe(1);
    expect(byPhone.rows[0]).toMatchObject({ phone: "9876543210", name: "Ravi Kumar", total: 2 });
    expect(byPhone.rows[0].appointments).toHaveLength(2);
    expect((await clinic.listPatients({ q: "ravi" })).total).toBe(1);
    expect((await clinic.listPatients({ q: "nobody" })).total).toBe(0);
  });

  it("searches appointments by date, phone and status with paging", async () => {
    for (let i = 1; i <= 5; i++) must(await clinic.createAppointment(person(i)));
    expect((await clinic.searchAppointments({ date: day(10) }, 1, 2)).rows).toHaveLength(2);
    expect((await clinic.searchAppointments({ date: day(10) }, 1, 2)).total).toBe(5);
    expect((await clinic.searchAppointments({ phone: person(3).phone })).total).toBe(1);
    expect((await clinic.searchAppointments({ status: "CANCELLED" })).total).toBe(0);
  });

  it("builds the statistics page numbers", async () => {
    must(await clinic.createAppointment(person(1)));
    const a = await clinic.analysis(30);
    expect(a.booked).toBe(1);
    expect(a.byDoctor[0]).toEqual({ label: "Other Doctors", value: 1 });
    expect(a.daily.labels).toHaveLength(14);
  });
});
