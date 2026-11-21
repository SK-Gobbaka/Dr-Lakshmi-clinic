"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { endSession, requireAdmin, requireAdminUser, requireOwner, SessionSecretMissingError, startSession } from "@/lib/admin-auth";
import {
  authenticate,
  changeOwnPassword,
  clearLoginFailures,
  createAdminUser,
  getAdminUser,
  loginAllowed,
  recordLoginFailure,
  resetPassword,
  setUserActive,
  setUserRole,
  signOutEverywhere,
} from "@/lib/auth/users";
import * as clinic from "@/lib/clinic";
import * as content from "@/lib/content";
import { isDatabaseDown } from "@/lib/db";
import { deliver } from "@/lib/integrations/deliver";
import { deleteImage, saveImage, type UploadFolder } from "@/lib/integrations/storage";
import { log } from "@/lib/logger";
import { clientKey } from "@/lib/rate-limit";
import { normalizePhoneInput } from "@/lib/site-info";
import { adminCreateSchema, patientDetailsSchema } from "@/lib/validations";

// Every action checks the session itself: hiding a button is not authorisation.
// Staff accounts can run the day-to-day appointment actions; everything that changes the clinic's setup,
// content, accounts or data exports needs an owner account (requireOwner).

const field = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Redirect back to `to` with a one-shot notice or error message. */
function back(to: string, kind: "notice" | "error", message: string): never {
  const sep = to.includes("?") ? "&" : "?";
  redirect(`${to}${sep}${kind}=${encodeURIComponent(message)}`);
}

/** Pages that show doctors, treatments or other content to visitors. */
const publicRefresh = () => {
  for (const p of ["/", "/doctors", "/treatments", "/book", "/book/treatment"]) revalidatePath(p);
  revalidatePath("/admin", "layout");
};

const refresh = () => {
  revalidatePath("/admin", "layout");
  revalidatePath("/book");
};

/** Result of a form submitted through useActionState: keeps the user's input on error. */
export type FormState = { error?: string; notice?: string; at?: number } | null;

// ---------- sign in and out ----------

export async function adminLogin(formData: FormData) {
  const client = await clientKey();
  let failure: string | null = null;
  try {
    if (!(await loginAllowed(client))) {
      failure = "Too many failed attempts. Please try again in 15 minutes.";
    } else {
      const user = await authenticate(field(formData, "username"), String(formData.get("password") ?? ""));
      if (!user) {
        await recordLoginFailure(client);
        failure = "Incorrect username or password";
      } else {
        await clearLoginFailures(client);
        await startSession(user);
      }
    }
  } catch (err) {
    log.error("admin.login", err);
    failure =
      err instanceof SessionSecretMissingError
        ? "Admin sign-in is not set up on this server yet: the SESSION_SECRET setting is missing (see .env.example)."
        : isDatabaseDown(err)
          ? "The database cannot be reached right now, so sign-in is unavailable. Please try again shortly."
          : "Sign-in failed because of a server problem. Please try again.";
  }
  if (failure) back("/admin/login", "error", failure); // redirect() works by throwing, so it stays outside the try
  redirect("/admin");
}

export async function adminLogout() {
  await endSession();
  redirect("/admin/login");
}

// ---------- own account ----------

export async function changePasswordAction(formData: FormData) {
  const user = await requireAdminUser();
  const here = "/admin/account";
  const next = String(formData.get("next") ?? "");
  if (next !== String(formData.get("confirm") ?? "")) back(here, "error", "The new password and its confirmation do not match.");
  const key = `password:${user.id}`;
  if (!(await loginAllowed(key))) back(here, "error", "Too many attempts. Please try again in 15 minutes.");
  const result = await changeOwnPassword(user.id, String(formData.get("current") ?? ""), next);
  if (!result.ok) {
    await recordLoginFailure(key);
    back(here, "error", result.error);
  }
  await clearLoginFailures(key);
  const fresh = await getAdminUser(user.id);
  if (fresh) await startSession(fresh); // this browser stays signed in; every other session was ended
  back(here, "notice", "Password changed. Every other signed-in device was signed out.");
}

export async function signOutEverywhereAction() {
  const user = await requireAdminUser();
  await signOutEverywhere(user.id);
  await endSession();
  redirect("/admin/login");
}

// ---------- accounts (owner) ----------

export async function createUserAction(formData: FormData) {
  const owner = await requireOwner();
  const username = field(formData, "username");
  const role = field(formData, "role") === "OWNER" ? "OWNER" : "STAFF";
  const result = await createAdminUser({ username, password: String(formData.get("password") ?? ""), role }, owner);
  if (!result.ok) back("/admin/users", "error", result.error);
  back("/admin/users", "notice", `Account "${username}" created. Give them the password privately; they can change it under My account.`);
}

export async function setUserActiveAction(formData: FormData) {
  const owner = await requireOwner();
  const active = field(formData, "active") === "true";
  const result = await setUserActive(field(formData, "id"), active, owner);
  if (!result.ok) back("/admin/users", "error", result.error);
  back("/admin/users", "notice", active ? "Account enabled." : "Account disabled and signed out everywhere.");
}

export async function setUserRoleAction(formData: FormData) {
  const owner = await requireOwner();
  const result = await setUserRole(field(formData, "id"), field(formData, "role") === "OWNER" ? "OWNER" : "STAFF", owner);
  if (!result.ok) back("/admin/users", "error", result.error);
  back("/admin/users", "notice", "Role changed. The person is signed out and must sign in again.");
}

export async function resetUserPasswordAction(formData: FormData) {
  const owner = await requireOwner();
  const result = await resetPassword(field(formData, "id"), String(formData.get("password") ?? ""), owner);
  if (!result.ok) back("/admin/users", "error", result.error);
  back("/admin/users", "notice", "Password reset. The person is signed out everywhere and must sign in with the new password.");
}

// ---------- appointments (staff) ----------

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

  const result = await clinic.setStatus(id, STATUS_BY_ACTION[to], admin, { reason: field(formData, "reason") });
  if (!result.ok) {
    // A repeated click on the same action is harmless: say so instead of showing an error.
    const now = await clinic.getAppointment(id);
    if (now && now.status === STATUS_BY_ACTION[to]) back(here, "notice", `${id} is already ${STATUS_BY_ACTION[to].toLowerCase().replace("_", "-")}${now.tokenNumber ? ` (token ${now.tokenNumber})` : ""}.`);
    back(here, "error", result.error);
  }
  await deliver(result.outbox);
  refresh();
  const token = result.data.tokenNumber;
  back(
    here,
    "notice",
    to === "confirm"
      ? "Appointment confirmed. The patient was messaged where WhatsApp is connected."
      : to === "complete"
        ? `${result.data.id} completed. Token number ${token}.`
        : to === "cancel"
          ? `${result.data.id} cancelled by admin.`
          : "Status updated"
  );
}

/** Deleting a record outright is owner-only; staff cancel instead, which keeps the history. */
export async function deleteAppointmentAction(formData: FormData) {
  const owner = await requireOwner();
  const id = field(formData, "id");
  const result = await clinic.deleteAppointment(id, owner);
  if (!result.ok) back(`/admin/appointments/${id}`, "error", result.error);
  refresh();
  back("/admin/appointments", "notice", `${id} was deleted`);
}

export async function rescheduleByAdmin(formData: FormData) {
  const admin = await requireAdmin();
  const id = field(formData, "id");
  const here = `/admin/appointments/${id}`;
  if (!field(formData, "slotId")) back(here, "error", "Choose a new date and time slot");
  const result = await clinic.reschedule(id, field(formData, "slotId"), admin);
  if (!result.ok) back(here, "error", result.error);
  await deliver(result.outbox); // patient message: new date and time, map, cancel and reschedule links
  refresh();
  back(here, "notice", "Appointment rescheduled. The patient was messaged where WhatsApp is connected.");
}

/** Manual entry / rebook: staff books on behalf of a patient. */
export async function createByAdmin(formData: FormData) {
  const admin = await requireAdmin();
  const keep = new URLSearchParams(["fullName", "phone", "age", "gender", "patientType", "email", "date", "doctorId"].map((k) => [k, field(formData, k)])).toString();
  const here = `/admin/appointments/new?${keep}`;

  const parsed = patientDetailsSchema.safeParse(Object.fromEntries(["fullName", "phone", "email", "age", "gender", "patientType"].map((k) => [k, field(formData, k)])));
  if (!parsed.success) back(here, "error", parsed.error.errors[0]?.message ?? "Invalid details");
  const slotId = field(formData, "slotId");
  if (!slotId) back(here, "error", "Pick a time slot");

  const typeId = field(formData, "typeId") || (await clinic.listTypes({ activeOnly: true }))[0]?.id || "";
  const doctorId = field(formData, "doctorId");
  if (!doctorId) back(here, "error", "Choose the doctor");
  const result = await clinic.createAppointment({ ...parsed.data, email: parsed.data.email || null, slotId, typeId, doctorId }, admin);
  if (!result.ok) back(here, "error", result.error);

  await deliver(result.outbox);
  revalidatePath("/admin", "layout");
  back(`/admin/appointments/${result.data.id}`, "notice", "Appointment booked. The patient was messaged where WhatsApp is connected.");
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
  const result = await clinic.createAppointment({ ...f, email: f.email || null }, admin);
  if (!result.ok) return { error: result.error, at: Date.now() };
  await deliver(result.outbox);
  refresh();
  return { notice: `Appointment ${result.data.id} created for ${result.data.fullName}.`, at: Date.now() };
}

// ---------- appointment types, time slots, capacity (owner) ----------

export async function saveTypeAction(formData: FormData) {
  const owner = await requireOwner();
  const id = field(formData, "id") || undefined;
  const result = await clinic.saveType({ id, name: field(formData, "name"), description: field(formData, "description") }, owner);
  refresh();
  if (!result.ok) back("/admin/types", "error", result.error);
  back("/admin/types", "notice", id ? "Appointment type updated" : "Appointment type created");
}

export async function deleteTypeAction(formData: FormData) {
  const owner = await requireOwner();
  const result = await clinic.deleteType(field(formData, "id"), owner);
  refresh();
  if (!result.ok) back("/admin/types", "error", result.error);
  back("/admin/types", "notice", "Appointment type deleted. Existing appointments keep its name.");
}

export async function toggleTypeAction(formData: FormData) {
  const owner = await requireOwner();
  const id = field(formData, "id");
  const t = (await clinic.listTypes()).find((x) => x.id === id);
  if (!t) back("/admin/types", "error", "Appointment type not found");
  const on = field(formData, "active") === "true";
  const result = await clinic.saveType({ id, name: t.name, active: on }, owner);
  refresh();
  if (!result.ok) back("/admin/types", "error", result.error);
  back("/admin/types", "notice", `${t.name} is now ${on ? "active" : "inactive"}`);
}

/** Add a time slot, or change an existing slot's capacity. */
export async function saveSessionAction(formData: FormData) {
  const owner = await requireOwner();
  const id = field(formData, "id") || undefined;
  const cap = field(formData, "capacity");
  const existing = id ? (await clinic.listSessions()).find((x) => x.id === id) : undefined;
  const result = await clinic.saveSession(
    {
      id,
      startTime: field(formData, "startTime") || existing?.startTime || "",
      endTime: field(formData, "endTime") || existing?.endTime || "",
      capacity: cap === "" ? undefined : Number(cap),
    },
    owner
  );
  refresh();
  if (!result.ok) back("/admin/sessions", "error", result.error);
  back("/admin/sessions", "notice", id ? `${result.data.name} capacity saved. The booking page shows it now.` : `Time slot ${result.data.name} added (capacity ${result.data.capacity}).`);
}

export async function toggleSessionAction(formData: FormData) {
  const owner = await requireOwner();
  const s = (await clinic.listSessions()).find((x) => x.id === field(formData, "id"));
  if (!s) back("/admin/sessions", "error", "Time slot not found");
  const on = field(formData, "active") === "true";
  const result = await clinic.saveSession({ id: s.id, startTime: s.startTime, endTime: s.endTime, active: on }, owner);
  refresh();
  if (!result.ok) back("/admin/sessions", "error", result.error);
  back("/admin/sessions", "notice", `${s.name} is now ${on ? "active" : "inactive"}`);
}

export async function deleteSessionAction(formData: FormData) {
  const owner = await requireOwner();
  const result = await clinic.deleteSession(field(formData, "id"), owner);
  refresh();
  if (!result.ok) back("/admin/sessions", "error", result.error);
  back("/admin/sessions", "notice", "Time slot deleted");
}

/** One doctor group's daily capacity. Dr. Lakshmi and Other Doctors are saved separately. */
export async function saveDoctorCapacityAction(formData: FormData) {
  const owner = await requireOwner();
  const date = field(formData, "date");
  const here = DATE_RE.test(date) ? `/admin/sessions?date=${date}` : "/admin/sessions";
  const group = field(formData, "group");
  if (!clinic.DOCTOR_GROUPS.includes(group as clinic.DoctorGroup)) back(here, "error", "Unknown doctor group");
  const result = await clinic.setDoctorCapacity(group as clinic.DoctorGroup, Number(field(formData, "capacity")), owner);
  refresh();
  if (!result.ok) back(here, "error", result.error);
  back(here, "notice", "Doctor capacity saved. The booking page shows it now.");
}

export async function setAutoConfirmAction(formData: FormData) {
  const owner = await requireOwner();
  const result = await clinic.setAutoConfirm(field(formData, "autoConfirm") === "on", owner);
  refresh();
  if (!result.ok) back("/admin/sessions", "error", result.error);
  back("/admin/sessions", "notice", "Booking policy saved");
}

export async function updateSlotAction(formData: FormData) {
  const owner = await requireOwner();
  const slotId = field(formData, "slotId");
  const date = slotId.split("_")[0] ?? "";
  const patch: { capacity?: number | null; disabled?: boolean } = {};
  if (formData.has("capacity")) patch.capacity = field(formData, "capacity") === "" ? null : Number(field(formData, "capacity"));
  if (formData.has("disabled")) patch.disabled = field(formData, "disabled") === "true";

  const result = await clinic.setSlotOverride(slotId, patch, owner);
  refresh();
  const here = DATE_RE.test(date) ? `/admin/sessions?date=${date}` : "/admin/sessions";
  if (!result.ok) back(here, "error", result.error);
  back(here, "notice", "Slot updated");
}

// ---------- calendar (owner) ----------

/** Final step of the block-date workflow: applies exactly the plan the admin approved. */
export async function executeBlockAction(formData: FormData) {
  const owner = await requireOwner();
  const date = field(formData, "date");
  if (!DATE_RE.test(date)) back("/admin/calendar", "error", "Choose a valid date");
  const approved: Record<string, string | null> = {};
  for (const [k, v] of formData.entries()) if (k.startsWith("plan_")) approved[k.slice(5)] = String(v) || null;
  const result = await clinic.blockDate(date, field(formData, "reason"), owner, approved);
  if (!result.ok) back(`/admin/calendar/block?date=${date}&reason=${encodeURIComponent(field(formData, "reason"))}`, "error", result.error);
  await deliver(result.outbox);
  refresh();
  const { moved, flagged } = result.data;
  back(`/admin/calendar?m=${date.slice(0, 7)}&day=${date}`, "notice", `${date} is blocked. ${moved.length} appointment(s) moved${flagged.length ? `; ${flagged.length} flagged for manual handling` : ""}. Patients are messaged where WhatsApp is connected.`);
}

export async function unblockDateAction(formData: FormData) {
  const owner = await requireOwner();
  const date = field(formData, "date");
  if (!DATE_RE.test(date)) back("/admin/calendar", "error", "Choose a valid date");
  const result = await clinic.unblockDate(date, owner);
  refresh();
  if (!result.ok) back(`/admin/calendar?m=${date.slice(0, 7)}&day=${date}`, "error", result.error);
  back(`/admin/calendar?m=${date.slice(0, 7)}&day=${date}`, "notice", `${date} is open again`);
}

/** Emergency: block the date, cancel everything booked on it and message each patient with a rebooking link. */
export async function emergencyCloseAction(formData: FormData) {
  const owner = await requireOwner();
  const date = field(formData, "date");
  const reason = field(formData, "reason");
  if (!DATE_RE.test(date)) back("/admin/calendar", "error", "Choose a valid date");
  const result = await clinic.emergencyClose(date, reason, owner);
  if (!result.ok) back(`/admin/calendar/block?date=${date}&reason=${encodeURIComponent(reason)}`, "error", result.error);
  await deliver(result.outbox);
  refresh();
  back(`/admin/calendar?m=${date.slice(0, 7)}&day=${date}`, "notice", `${date} is closed. ${result.data.cancelled.length} appointment(s) cancelled. Patients are messaged with a link to book again where WhatsApp is connected.`);
}

// ---------- photos ----------

/** Reads an optional photo field; returns the new public address, "" when none was sent, or an error. */
async function photo(formData: FormData, folder: UploadFolder): Promise<{ url: string } | { error: string }> {
  const f = formData.get("photo");
  if (!(f instanceof File) || f.size === 0) return { url: "" };
  const saved = await saveImage(f, folder);
  return saved.ok ? { url: saved.url } : { error: saved.error };
}

/** After a save: drop the replaced photo, or the new one when the save failed, so no file is left unused. */
async function tidyPhotos(opts: { saved: boolean; uploaded: string; previous?: string }) {
  if (!opts.saved) {
    if (opts.uploaded) await deleteImage(opts.uploaded);
  } else if (opts.uploaded && opts.previous && opts.previous !== opts.uploaded) {
    await deleteImage(opts.previous);
  }
}

// ---------- doctors and treatments (owner) ----------

const list = (v: string, sep: RegExp) => v.split(sep).map((x) => x.trim()).filter(Boolean);

export async function saveDoctorAction(formData: FormData) {
  const owner = await requireOwner();
  const id = field(formData, "id") || undefined;
  const img = await photo(formData, "doctors");
  if ("error" in img) back("/admin/doctors", "error", img.error);
  const previous = id ? (await clinic.listDoctors()).find((d) => d.id === id)?.image : undefined;
  const result = await clinic.saveDoctor(
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
    owner
  );
  await tidyPhotos({ saved: result.ok, uploaded: img.url, previous });
  if (!result.ok) back("/admin/doctors", "error", result.error);
  publicRefresh();
  back("/admin/doctors", "notice", id ? `${result.data.name} updated. The website and booking form show the change now.` : `${result.data.name} added. The website and booking form show the new doctor now.`);
}

export async function deleteDoctorAction(formData: FormData) {
  const owner = await requireOwner();
  const id = field(formData, "id");
  const previous = (await clinic.listDoctors()).find((d) => d.id === id)?.image;
  const result = await clinic.deleteDoctor(id, owner);
  if (!result.ok) back("/admin/doctors", "error", result.error);
  if (previous) await deleteImage(previous);
  publicRefresh();
  back("/admin/doctors", "notice", "Doctor deleted");
}

export async function saveTreatmentAction(formData: FormData) {
  const owner = await requireOwner();
  const id = field(formData, "id") || undefined;
  const img = await photo(formData, "treatments");
  if ("error" in img) back("/admin/treatments", "error", img.error);
  const previous = id ? (await clinic.listTreatments()).find((t) => t.id === id)?.image : undefined;
  const result = await clinic.saveTreatment(
    {
      id,
      name: field(formData, "name"),
      image: img.url || undefined,
      subcategories: formData.getAll("subcategory").map((v) => String(v).trim()).filter(Boolean),
      published: formData.get("published") === "on",
    },
    owner
  );
  await tidyPhotos({ saved: result.ok, uploaded: img.url, previous });
  if (!result.ok) back("/admin/treatments", "error", result.error);
  publicRefresh();
  back("/admin/treatments", "notice", id ? `${result.data.name} updated. The Treatments page shows the change now.` : `${result.data.name} added. The Treatments page shows it now.`);
}

export async function deleteTreatmentAction(formData: FormData) {
  const owner = await requireOwner();
  const id = field(formData, "id");
  const previous = (await clinic.listTreatments()).find((t) => t.id === id)?.image;
  const result = await clinic.deleteTreatment(id, owner);
  if (!result.ok) back("/admin/treatments", "error", result.error);
  if (previous) await deleteImage(previous);
  publicRefresh();
  back("/admin/treatments", "notice", "Treatment deleted");
}

// ---------- website content (owner): contact details, gallery, testimonials, FAQs ----------

const httpsUrl = z
  .string()
  .trim()
  .max(300, "Links must be 300 characters or fewer")
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), "Links must start with https://");

const phoneField = (what: string) =>
  z
    .string()
    .trim()
    .transform(normalizePhoneInput)
    .refine((v) => v === "" || (v.replace(/\D/g, "").length >= 10 && v.replace(/\D/g, "").length <= 15), `${what} must have 10 to 15 digits`);

const siteSchema = z.object({
  phone: phoneField("The phone number"),
  phoneDisplay: z.string().trim().max(30),
  whatsappNumber: phoneField("The WhatsApp number"),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address"),
  addressLine1: z.string().trim().max(160),
  addressLine2: z.string().trim().max(160),
  pincode: z.string().trim().regex(/^(\d{6})?$/, "The PIN code must be 6 digits"),
  workingHours: z.string().trim().max(200),
  closedDay: z.string().trim().max(40),
  facebookUrl: httpsUrl,
  instagramUrl: httpsUrl,
  xUrl: httpsUrl,
  youtubeUrl: httpsUrl,
  googleMapsUrl: httpsUrl,
  googleReviewUrl: httpsUrl,
  googleRating: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().min(1, "The rating must be between 1 and 5").max(5, "The rating must be between 1 and 5").nullable()),
  googleReviewCount: z.preprocess((v) => (v === "" ? null : v), z.coerce.number().int("The review count must be a whole number").min(0).max(10_000_000).nullable()),
  trustStats: z.array(z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(20) })).max(6),
});

export async function saveSiteSettingsAction(formData: FormData) {
  const owner = await requireOwner();
  const here = "/admin/site";
  const stats: { label: string; value: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const label = field(formData, `statLabel${i}`);
    const value = field(formData, `statValue${i}`);
    if (label || value) stats.push({ label, value });
  }
  const parsed = siteSchema.safeParse({
    ...Object.fromEntries(
      ["phone", "phoneDisplay", "whatsappNumber", "email", "addressLine1", "addressLine2", "pincode", "workingHours", "closedDay", "facebookUrl", "instagramUrl", "xUrl", "youtubeUrl", "googleMapsUrl", "googleReviewUrl", "googleRating", "googleReviewCount"].map((k) => [k, field(formData, k)])
    ),
    trustStats: stats,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    back(here, "error", issue?.path[0] === "trustStats" ? "Each statistic needs both a label and a value." : (issue?.message ?? "Check the details and try again."));
  }
  const result = await content.saveSiteSettings(parsed.data, owner);
  if (!result.ok) back(here, "error", result.error);
  publicRefresh();
  back(here, "notice", "Saved. The website and the booking messages use these details now.");
}

export async function saveGalleryAction(formData: FormData) {
  const owner = await requireOwner();
  const id = field(formData, "id") || undefined;
  const img = await photo(formData, "gallery");
  if ("error" in img) back("/admin/gallery", "error", img.error);
  const previous = id ? (await content.listGallery()).find((g) => g.id === id)?.image : undefined;
  const result = await content.saveGalleryItem({ id, title: field(formData, "title"), category: field(formData, "category"), image: img.url || undefined, published: formData.get("published") === "on" }, owner);
  await tidyPhotos({ saved: result.ok, uploaded: img.url, previous });
  if (!result.ok) back("/admin/gallery", "error", result.error);
  publicRefresh();
  back("/admin/gallery", "notice", id ? "Photo updated." : "Photo added to the gallery.");
}

export async function deleteGalleryAction(formData: FormData) {
  const owner = await requireOwner();
  const result = await content.deleteGalleryItem(field(formData, "id"), owner);
  if (!result.ok) back("/admin/gallery", "error", result.error);
  await deleteImage(result.data);
  publicRefresh();
  back("/admin/gallery", "notice", "Photo deleted.");
}

export async function saveTestimonialAction(formData: FormData) {
  const owner = await requireOwner();
  const rating = field(formData, "rating");
  const result = await content.saveTestimonial(
    {
      id: field(formData, "id") || undefined,
      name: field(formData, "name"),
      treatment: field(formData, "treatment"),
      quote: field(formData, "quote"),
      rating: rating === "" ? null : Math.min(5, Math.max(1, Math.round(Number(rating)))) || null,
      consentConfirmed: formData.get("consentConfirmed") === "on",
      published: formData.get("published") === "on",
    },
    owner
  );
  if (!result.ok) back("/admin/testimonials", "error", result.error);
  publicRefresh();
  back("/admin/testimonials", "notice", "Testimonial saved.");
}

export async function deleteTestimonialAction(formData: FormData) {
  const owner = await requireOwner();
  const result = await content.deleteTestimonial(field(formData, "id"), owner);
  if (!result.ok) back("/admin/testimonials", "error", result.error);
  publicRefresh();
  back("/admin/testimonials", "notice", "Testimonial deleted.");
}

export async function saveFaqAction(formData: FormData) {
  const owner = await requireOwner();
  const result = await content.saveFaq({ id: field(formData, "id") || undefined, question: field(formData, "question"), answer: field(formData, "answer"), published: formData.get("published") === "on" }, owner);
  if (!result.ok) back("/admin/faqs", "error", result.error);
  publicRefresh();
  back("/admin/faqs", "notice", "FAQ saved.");
}

export async function deleteFaqAction(formData: FormData) {
  const owner = await requireOwner();
  const result = await content.deleteFaq(field(formData, "id"), owner);
  if (!result.ok) back("/admin/faqs", "error", result.error);
  publicRefresh();
  back("/admin/faqs", "notice", "FAQ deleted.");
}
