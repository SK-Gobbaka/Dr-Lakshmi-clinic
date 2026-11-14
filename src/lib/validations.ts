import { z } from "zod";

export const patientDetailsSchema = z.object({
  fullName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters")
    .regex(/^[a-zA-Z\s.'-]+$/, "Name contains invalid characters"),
  phone: z
    .string()
    .regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
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
  gender: z.enum(["MALE", "FEMALE", "OTHER"], {
    required_error: "Please select a gender",
  }),
  patientType: z.enum(["NEW", "FOLLOW_UP"], {
    required_error: "Please select patient type",
  }),
});

export type PatientDetailsInput = z.infer<typeof patientDetailsSchema>;

export const typeIdSchema = z.string().min(1, "Please select an appointment type");

export const bookingSchema = patientDetailsSchema.extend({
  slotId: z.string().min(1, "Please select a time slot"),
  date: z.string().min(1, "Please select a date"),
  typeId: typeIdSchema,
  doctorId: z.string().min(1, "Please choose the doctor you want to consult"),
});

/** Treatment booking: no doctor, no capacity, so only who, which treatment and when. */
export const treatmentBookingSchema = z.object({
  fullName: patientDetailsSchema.shape.fullName,
  phone: patientDetailsSchema.shape.phone,
  email: patientDetailsSchema.shape.email,
  treatmentId: z.string().min(1, "Please choose a treatment"),
  slotId: z.string().min(1, "Please select a time slot"),
  date: z.string().min(1, "Please select a date"),
  notes: z.string().max(500, "Notes must be 500 characters or fewer").optional(),
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

export type BookingInput = z.infer<typeof bookingSchema>;

export const cancelSchema = z.object({
  token: z.string().min(1),
  reason: z.string().optional(),
});

export const rescheduleSchema = z.object({
  token: z.string().min(1),
  newSlotId: z.string().min(1, "Please select a new time slot"),
});
