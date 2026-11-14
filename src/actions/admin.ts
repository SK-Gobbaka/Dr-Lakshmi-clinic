"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkCredentials, endSession, requireAdmin, startSession } from "@/lib/admin-auth";
import * as store from "@/lib/local-store";
import { deliver } from "@/lib/notify";
import { saveImage } from "@/lib/uploads";
import { adminCreateSchema, patientDetailsSchema } from "@/lib/validations";

// Every action re-checks the session itself; hiding a button is not authorisation.

const field = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Redirect back to `to` with a one-shot notice or error message. */
function back(to: string, kind: "notice" | "error", message: string): never {
  const sep = to.includes("?") ? "&" : "?";
  redirect(`${to}${sep}${kind}=${encodeURIComponent(message)}`);
}

/** Pages that show doctors or treatments to visitors. */
const publicRefresh = () => {
  for (const p of ["/", "/doctors", "/treatments", "/book", "/book/treatment"]) revalidatePath(p);
  revalidatePath("/admin", "layout");
};

const refresh = () => {
  revalidatePath("/admin", "layout");
  revalidatePath("/my-appointments");
  revalidatePath("/book");
};

/** Result of a form submitted through useActionState: keeps the user's input on error. */
export type FormState = { error?: string; notice?: string; at?: number } | null;

export async function adminLogin(formData: FormData) {
  if (!checkCredentials(field(formData, "username"), field(formData, "password"))) {
    back("/admin/login", "error", "Incorrect username or password");
  }
  await startSession(field(formData, "username"));
  redirect("/admin");
}

export async function adminLogout() {
  await endSession();
  redirect("/admin/login");
}

const STATUS_BY_ACTION = {
  confirm: "CONFIRMED",
  cancel: "CANCELLED",
  complete: "COMPLETED",
  no_show: "NO_SHOW",
} as const;

export async function changeStatus(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "id");
  const to = field(formData, "action") as keyof typeof STATUS_BY_ACTION;
  const ret = field(formData, "returnTo");
  const here = ret.startsWith("/admin/") ? ret : `/admin/appointments/${id}`;
  if (!(to in STATUS_BY_ACTION)) back(here, "error", "Unknown action");

  const result = store.setStatus(id, STATUS_BY_ACTION[to], admin, { reason: field(formData, "reason") });
  if (!result.ok) back(here, "error", result.error);
  deliver(result.outbox);
  refresh();
  back(here, "notice", to === "confirm" ? "Appointment confirmed. The patient and admin notifications were sent." : "Status updated");
}

export async function deleteAppointmentAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "id");
  const result = store.deleteAppointment(id, admin);
  if (!result.ok) back(`/admin/appointments/${id}`, "error", result.error);
  refresh();
  back("/admin/appointments", "notice", `${id} was deleted`);
}

export async function rescheduleByAdmin(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "id");
  const here = `/admin/appointments/${id}`;
  if (!field(formData, "slotId")) back(here, "error", "Choose a new date and time slot");
  const result = store.reschedule(id, field(formData, "slotId"), admin);
  if (!result.ok) back(here, "error", result.error);
  deliver(result.outbox); // patient message: new date and time, map, cancel and reschedule links
  refresh();
  back(here, "notice", "Appointment rescheduled and the patient was notified");
}

/** Manual entry / rebook: staff books on behalf of a patient. */
export async function createByAdmin(formData: FormData) {
  const admin = await requireAdmin();
  const keep = new URLSearchParams(
    ["fullName", "phone", "age", "gender", "patientType", "email", "date", "doctorId"].map((k) => [k, field(formData, k)])
  ).toString();
  const here = `/admin/appointments/new?${keep}`;

  const parsed = patientDetailsSchema.safeParse(Object.fromEntries(["fullName", "phone", "email", "age", "gender", "patientType"].map((k) => [k, field(formData, k)])));
  if (!parsed.success) back(here, "error", parsed.error.errors[0]?.message ?? "Invalid details");
  const slotId = field(formData, "slotId");
  if (!slotId) back(here, "error", "Pick a time slot");

  const typeId = field(formData, "typeId") || store.listTypes({ activeOnly: true })[0]?.id || "";
  const doctorId = field(formData, "doctorId");
  if (!doctorId) back(here, "error", "Choose the doctor");
  const result = store.createAppointment({ ...parsed.data, slotId, typeId, doctorId }, admin);
  if (!result.ok) back(here, "error", result.error);

  const a = result.data;
  deliver(result.outbox);
  revalidatePath("/admin", "layout");
  back(`/admin/appointments/${a.id}`, "notice", "Appointment booked and the patient was notified");
}

/** Manual appointment entry; same rules and capacity checks as an online booking. */
export async function createAppointmentAdmin(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = adminCreateSchema.safeParse({
    fullName: field(formData, "fullName"),
    phone: field(formData, "phone"),
    email: field(formData, "email"),
    age: field(formData, "age"),
    gender: field(formData, "gender"),
    patientType: field(formData, "patientType") || "NEW",
    typeId: field(formData, "typeId"),
    doctorId: field(formData, "doctorId"),
    persons: field(formData, "persons") || "1",
    notes: field(formData, "notes"),
    slotId: field(formData, "slotId"),
    status: field(formData, "status") || "CONFIRMED",
  });
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
  const f = parsed.data;
  const result = store.createAppointment({ ...f, email: f.email || null }, admin);
  if (!result.ok) return { error: result.error, at: Date.now() };
  deliver(result.outbox);
  refresh();
  return { notice: `Appointment ${result.data.id} created for ${result.data.fullName}.`, at: Date.now() };
}

export async function saveTypeAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "id") || undefined;
  const result = store.saveType({ id, name: field(formData, "name"), description: field(formData, "description") }, admin);
  refresh();
  if (!result.ok) back("/admin/types", "error", result.error);
  back("/admin/types", "notice", id ? "Appointment type updated" : "Appointment type created");
}

export async function toggleTypeAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "id");
  const t = store.listTypes().find((x) => x.id === id);
  if (!t) back("/admin/types", "error", "Appointment type not found");
  const result = store.saveType({ id, name: t.name, active: field(formData, "active") === "true" }, admin);
  refresh();
  if (!result.ok) back("/admin/types", "error", result.error);
  back("/admin/types", "notice", `${t.name} is now ${field(formData, "active") === "true" ? "active" : "inactive"}`);
}

export async function saveSessionAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "id") || undefined;
  const result = store.saveSession(
    {
      id,
      name: field(formData, "name"),
      startTime: field(formData, "startTime"),
      endTime: field(formData, "endTime"),
      capacity: Number(field(formData, "capacity")),
    },
    admin
  );
  refresh();
  if (!result.ok) back("/admin/sessions", "error", result.error);
  back("/admin/sessions", "notice", id ? "Session saved. Availability is updated everywhere." : "Session created");
}

export async function toggleSessionAction(formData: FormData) {
  const admin = await requireAdmin();
  const s = store.listSessions().find((x) => x.id === field(formData, "id"));
  if (!s) back("/admin/sessions", "error", "Session not found");
  const result = store.saveSession({ ...s, active: field(formData, "active") === "true" }, admin);
  refresh();
  if (!result.ok) back("/admin/sessions", "error", result.error);
  back("/admin/sessions", "notice", `${s.name} is now ${field(formData, "active") === "true" ? "active" : "inactive"}`);
}

export async function setAutoConfirmAction(formData: FormData) {
  const admin = await requireAdmin();
  store.setAutoConfirm(field(formData, "autoConfirm") === "on", admin);
  refresh();
  back("/admin/sessions", "notice", "Booking policy saved");
}

/** Final step of the block-date workflow: applies exactly the plan the admin approved. */
export async function executeBlockAction(formData: FormData) {
  const admin = await requireAdmin();
  const date = field(formData, "date");
  const approved: Record<string, string | null> = {};
  for (const [k, v] of formData.entries()) if (k.startsWith("plan_")) approved[k.slice(5)] = String(v) || null;
  const result = store.blockDate(date, field(formData, "reason"), admin, approved);
  if (!result.ok) back(`/admin/calendar/block?date=${date}&reason=${encodeURIComponent(field(formData, "reason"))}`, "error", result.error);
  deliver(result.outbox);
  refresh();
  const { moved, flagged } = result.data;
  back(
    `/admin/calendar?m=${date.slice(0, 7)}&day=${date}`,
    "notice",
    `${date} is blocked. ${moved.length} appointment(s) moved and the patients notified${flagged.length ? `; ${flagged.length} flagged for manual handling` : ""}.`
  );
}

export async function unblockDateAction(formData: FormData) {
  const admin = await requireAdmin();
  const date = field(formData, "date");
  store.unblockDate(date, admin);
  refresh();
  back(`/admin/calendar?m=${date.slice(0, 7)}&day=${date}`, "notice", `${date} is open again`);
}

export async function updateSlotAction(formData: FormData) {
  const admin = await requireAdmin();
  const slotId = field(formData, "slotId");
  const date = slotId.split("_")[0];
  const patch: { capacity?: number | null; disabled?: boolean } = {};
  if (formData.has("capacity")) patch.capacity = field(formData, "capacity") === "" ? null : Number(field(formData, "capacity"));
  if (formData.has("disabled")) patch.disabled = field(formData, "disabled") === "true";

  const result = store.setSlotOverride(slotId, patch, admin);
  refresh();
  if (!result.ok) back(`/admin/slots?date=${date}`, "error", result.error);
  back(`/admin/slots?date=${date}`, "notice", "Slot updated");
}

/** Capacity for each hour of the day (applies every day). Empty box = no limit beyond the session total. */
export async function saveSlotCapsAction(formData: FormData) {
  const admin = await requireAdmin();
  const caps: Record<string, number | null> = {};
  for (const [k, v] of formData.entries()) {
    if (!k.startsWith("cap_")) continue;
    const raw = String(v).trim();
    caps[k.slice(4)] = raw === "" ? null : Number(raw);
  }
  const result = store.setSlotCaps(caps, admin);
  refresh();
  if (!result.ok) back("/admin/sessions", "error", result.error);
  back("/admin/sessions", "notice", "Time slot capacity saved. Availability is updated everywhere.");
}

/** Emergency: block the date, cancel everything booked on it and message each patient with a rebooking link. */
export async function emergencyCloseAction(formData: FormData) {
  const admin = await requireAdmin();
  const date = field(formData, "date");
  const reason = field(formData, "reason");
  const result = store.emergencyClose(date, reason, admin);
  if (!result.ok) back(`/admin/calendar/block?date=${date}&reason=${encodeURIComponent(reason)}`, "error", result.error);
  deliver(result.outbox);
  refresh();
  const n = result.data.cancelled.length;
  back(`/admin/calendar?m=${date.slice(0, 7)}&day=${date}`, "notice", `${date} is closed. ${n} appointment(s) cancelled and each patient was sent a message with a link to book again.`);
}

// ---------- doctors and treatments (content management) ----------

const list = (v: string, sep: RegExp) => v.split(sep).map((x) => x.trim()).filter(Boolean);

/** Reads an optional photo field; returns the new public path, "" when none was sent, or an error. */
async function photo(formData: FormData, folder: "doctors" | "treatments"): Promise<{ url: string } | { error: string }> {
  const f = formData.get("photo");
  if (!(f instanceof File) || f.size === 0) return { url: "" };
  const saved = await saveImage(f, folder);
  return saved.ok ? { url: saved.url } : { error: saved.error };
}

export async function saveDoctorAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "id") || undefined;
  const img = await photo(formData, "doctors");
  if ("error" in img) back("/admin/doctors", "error", img.error);
  const result = store.saveDoctor(
    {
      id,
      name: field(formData, "name"),
      qualification: field(formData, "qualification"),
      designation: field(formData, "designation"),
      regNo: field(formData, "regNo"),
      experience: Number(field(formData, "experience") || 0),
      specialization: list(field(formData, "specialization"), /,|\n/),
      bio: field(formData, "bio"),
      message: field(formData, "message"),
      image: img.url || undefined,
      isSenior: formData.get("isSenior") === "on",
      published: formData.get("published") === "on",
      sortOrder: field(formData, "sortOrder") === "" ? undefined : Number(field(formData, "sortOrder")),
    },
    admin
  );
  if (!result.ok) back("/admin/doctors", "error", result.error);
  publicRefresh();
  back("/admin/doctors", "notice", id ? `${result.data.name} updated. The website and booking form show the change now.` : `${result.data.name} added. The website and booking form show the new doctor now.`);
}

export async function deleteDoctorAction(formData: FormData) {
  const admin = await requireAdmin();
  const result = store.deleteDoctor(field(formData, "id"), admin);
  if (!result.ok) back("/admin/doctors", "error", result.error);
  publicRefresh();
  back("/admin/doctors", "notice", "Doctor deleted");
}

export async function saveTreatmentAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "id") || undefined;
  const img = await photo(formData, "treatments");
  if ("error" in img) back("/admin/treatments", "error", img.error);
  const result = store.saveTreatment(
    {
      id,
      name: field(formData, "name"),
      category: field(formData, "category") as "hair" | "skin" | "laser",
      shortDescription: field(formData, "shortDescription"),
      description: field(formData, "description"),
      image: img.url || undefined,
      duration: field(formData, "duration"),
      sessions: field(formData, "sessions"),
      benefits: list(field(formData, "benefits"), /\n/),
      suitableFor: field(formData, "suitableFor"),
      procedure: field(formData, "procedure"),
      aftercare: field(formData, "aftercare"),
      published: formData.get("published") === "on",
      sortOrder: field(formData, "sortOrder") === "" ? undefined : Number(field(formData, "sortOrder")),
    },
    admin
  );
  if (!result.ok) back("/admin/treatments", "error", result.error);
  publicRefresh();
  back("/admin/treatments", "notice", id ? `${result.data.name} updated. The website shows the change now.` : `${result.data.name} added. The website shows it now.`);
}

export async function deleteTreatmentAction(formData: FormData) {
  const admin = await requireAdmin();
  const result = store.deleteTreatment(field(formData, "id"), admin);
  if (!result.ok) back("/admin/treatments", "error", result.error);
  publicRefresh();
  back("/admin/treatments", "notice", "Treatment deleted");
}

export async function markAdminNotificationsRead(formData: FormData) {
  await requireAdmin();
  store.markNotificationsRead({ audience: "ADMIN" }, field(formData, "id") || undefined);
  revalidatePath("/admin", "layout");
  redirect("/admin/notifications");
}
