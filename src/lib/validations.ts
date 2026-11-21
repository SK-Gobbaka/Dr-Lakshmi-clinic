import { z } from "zod";

export const patientDetailsSchema = z.object({
  fullName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    // any-language letters (Telugu, Hindi, ...), not just A-Z
    .regex(/^[\p{L}\p{M}\s.'-]+$/u, "Name contains invalid characters"),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  email: z
    .string()
    .email("Invalid email format")
    .optional()
    .or(z.literal("")),
  age: z.coerce
    .number({ invalid_type_error: "Age must be a number" })
    .int("Age must be a whole number")
    .min(1, "Age must be at least 1")
    .max(120, "Age must be at most 120"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"], { errorMap: () => ({ message: "Please select a gender" }) }),
  patientType: z.enum(["NEW", "FOLLOW_UP"], { errorMap: () => ({ message: "Please choose New or Follow-up" }) }),
});

const turnstileToken = z.string().max(4096).optional();

export const typeIdSchema = z.string().min(1, "Please select an appointment type");

/** Online booking: only name, age, gender, phone, New/Follow-up, Dr. Lakshmi or Other Doctors, and a slot. */
export const bookingSchema = patientDetailsSchema.pick({ fullName: true, phone: true, age: true, gender: true, patientType: true }).extend({
  slotId: z.string().min(1, "Please select a time slot"),
  date: z.string().min(1, "Please select a date"),
  doctorGroup: z.enum(["LAKSHMI", "OTHERS"], { required_error: "Please choose Dr. Lakshmi or Other Doctors" }),
  turnstileToken,
});

const optionalAge = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce.number().int("Age must be a whole number").min(1, "Age must be at least 1").max(120, "Age must be at most 120").nullable()
);
const optionalGender = z.preprocess((v) => (v === "" ? null : v), z.enum(["MALE", "FEMALE", "OTHER"]).nullable());

/** Shared by patient edits and admin edits/manual entry. */
export const appointmentEditSchema = z.object({
  fullName: patientDetailsSchema.shape.fullName,
  phone: patientDetailsSchema.shape.phone,
  email: patientDetailsSchema.shape.email,
  age: optionalAge,
  gender: optionalGender,
  patientType: z.enum(["NEW", "FOLLOW_UP"]),
  typeId: typeIdSchema,
  doctorId: z.string().optional(),
  persons: z.coerce.number().int().min(1, "At least 1 person").max(20, "At most 20 persons"),
  notes: z.string().max(500, "Notes must be 500 characters or fewer").optional(),
  slotId: z.string().min(1, "Please select a date and time slot"),
});

export const adminCreateSchema = appointmentEditSchema.extend({
  status: z.enum(["PENDING", "CONFIRMED"]),
  doctorId: z.string().min(1, "Please choose the doctor"),
});

export const updateMySchema = appointmentEditSchema.extend({ token: z.string().min(1) });


export const cancelSchema = z.object({
  token: z.string().min(1),
  reason: z.string().trim().max(300, "Please keep the reason under 300 characters").optional(),
});

export const rescheduleSchema = z.object({
  token: z.string().min(1),
  newSlotId: z.string().min(1, "Please select a new time slot"),
});

/** The four patient fields on the booking form. */
export const bookingDetailsSchema = patientDetailsSchema.pick({ fullName: true, phone: true, age: true, gender: true });
export type BookingDetailsInput = z.infer<typeof bookingDetailsSchema>;

/** Treatment booking: the same four patient fields and a time slot. No treatment, type or doctor to choose. */
export const treatmentBookingSchema = patientDetailsSchema.pick({ fullName: true, phone: true, age: true, gender: true }).extend({
  slotId: z.string().min(1, "Please select a time slot"),
  date: z.string().min(1, "Please select a date"),
  turnstileToken,
});
