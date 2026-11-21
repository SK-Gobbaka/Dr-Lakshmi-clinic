import { afterEach, describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "../src/lib/auth/password";
import { cell, csv } from "../src/lib/csv";
import { env, integrationStatus } from "../src/lib/env";
import { normalizePhoneInput } from "../src/lib/site-info";
import { bookingSchema, cancelSchema, patientDetailsSchema } from "../src/lib/validations";

const saved = { ...process.env };
afterEach(() => {
  for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
  Object.assign(process.env, saved);
});

describe("settings", () => {
  it("treats a blank setting as not set and keeps the other settings", () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "";
    process.env.WHATSAPP_API_VERSION = "   ";
    process.env.ADMIN_USERNAME = "owner1";
    const e = env();
    expect(e.WHATSAPP_PHONE_NUMBER_ID).toBeUndefined();
    expect(e.WHATSAPP_API_VERSION).toBe("v21.0"); // the default, not an empty string
    expect(e.ADMIN_USERNAME).toBe("owner1"); // one blank value must not switch off the others
  });

  it("reports a half-configured connection as missing, without ever exposing a value", () => {
    process.env.RESEND_API_KEY = "secret-value-123";
    delete process.env.EMAIL_FROM;
    const email = integrationStatus().find((i) => i.key === "email")!;
    expect(email.configured).toBe(false);
    expect(email.missing).toContain("EMAIL_FROM");
    expect(JSON.stringify(integrationStatus())).not.toContain("secret-value-123");
  });
});

describe("passwords", () => {
  it("hashes with a random salt and verifies only the right password", async () => {
    const a = await hashPassword("Correct-Horse-9");
    const b = await hashPassword("Correct-Horse-9");
    expect(a).not.toBe(b);
    expect(a).not.toContain("Correct-Horse-9");
    expect(await verifyPassword("Correct-Horse-9", a)).toBe(true);
    expect(await verifyPassword("Correct-Horse-8", a)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("refuses weak passwords with a reason", () => {
    expect(passwordProblem("short1", "bob")).toMatch(/at least 10/);
    expect(passwordProblem("onlyletterslong", "bob")).toMatch(/letters and numbers/);
    expect(passwordProblem("1234567890", "bob")).toMatch(/common/);
    expect(passwordProblem("bobbobbob123", "bobbobbob123")).toMatch(/same as the username/);
    expect(passwordProblem("A-good-pass-2026", "bob")).toBeNull();
  });
});

describe("spreadsheet downloads", () => {
  it("defuses formulas typed into a patient name", () => {
    expect(cell("=HYPERLINK(\"http://evil\")")).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(cell("+91 98765")).toBe("'+91 98765");
    expect(cell("@cmd")).toBe("'@cmd");
  });

  it("quotes commas, quotes and line breaks, and writes empty values as nothing", () => {
    expect(cell("Reddy, Asha")).toBe('"Reddy, Asha"');
    expect(cell('say "hi"')).toBe('"say ""hi"""');
    expect(cell("two\nlines")).toBe('"two\nlines"');
    expect(cell(null)).toBe("");
    expect(cell(7)).toBe("7");
  });

  it("starts with a byte-order mark so Excel reads other scripts correctly", () => {
    const out = csv(["Name"], [["లక్ష్మి"]]);
    expect(out.startsWith("﻿")).toBe(true);
    expect(out).toContain("లక్ష్మి");
  });
});

describe("booking input", () => {
  const ok = { fullName: "Asha Reddy", phone: "9876543210", age: "34", gender: "FEMALE", patientType: "NEW", doctorGroup: "LAKSHMI", slotId: "2030-01-07_09:00", date: "2030-01-07" };

  it("accepts a valid booking, including names in other scripts", () => {
    expect(bookingSchema.safeParse(ok).success).toBe(true);
    expect(bookingSchema.safeParse({ ...ok, fullName: "లక్ష్మి దేవి" }).success).toBe(true);
    expect(bookingSchema.safeParse({ ...ok, fullName: "D'Souza-Rao Jr." }).success).toBe(true);
  });

  it("rejects bad phone numbers, names, ages and a missing doctor choice", () => {
    expect(bookingSchema.safeParse({ ...ok, phone: "1234567890" }).success).toBe(false); // Indian mobiles start with 6 to 9
    expect(bookingSchema.safeParse({ ...ok, phone: "98765" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...ok, phone: "98765 43210" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...ok, fullName: "A" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...ok, fullName: "Asha 123" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...ok, fullName: "<script>" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...ok, age: "0" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...ok, age: "121" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...ok, age: "34.5" }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...ok, doctorGroup: undefined }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...ok, doctorGroup: "SOMEONE" }).success).toBe(false);
  });

  it("limits patient detail fields and cancellation reasons", () => {
    expect(patientDetailsSchema.safeParse({ ...ok, email: "not-an-email" }).success).toBe(false);
    expect(patientDetailsSchema.safeParse({ ...ok, email: "" }).success).toBe(true);
    expect(cancelSchema.safeParse({ token: "t", reason: "x".repeat(301) }).success).toBe(false);
    expect(cancelSchema.safeParse({ token: "t", reason: "  Travelling  " })).toMatchObject({ success: true, data: { reason: "Travelling" } });
  });
});

describe("phone numbers typed into the admin portal", () => {
  it("keeps the country code and strips spaces", () => {
    expect(normalizePhoneInput("+91 98765 43210")).toBe("+919876543210");
    expect(normalizePhoneInput("98765 43210")).toBe("+919876543210");
    expect(normalizePhoneInput("")).toBe("");
    expect(normalizePhoneInput("  ")).toBe("");
  });
});
