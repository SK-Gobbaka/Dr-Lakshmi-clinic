import { expect, type Page } from "@playwright/test";

/** Test-only values for the throw-away database started by scripts/e2e-server.mjs. */
export const ADMIN = { username: "e2e-owner", password: "E2e-Owner-Pass-123" };
export const CRON_SECRET = "e2e-cron-secret";

export async function signIn(page: Page, username = ADMIN.username, password = ADMIN.password) {
  await page.goto("/admin/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function signInAsOwner(page: Page) {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

const anyDay = (page: Page) => page.getByRole("button", { name: /^\w+day \d{1,2} \w+ \d{4}/ });

/** Clicks the first date the booking calendar offers (at the end of a month that is in the next month). */
async function pickFirstAvailableDate(page: Page) {
  await anyDay(page).first().waitFor();
  let open = page.getByRole("button", { name: /, available$/ });
  if ((await open.count()) === 0) {
    await page.getByRole("button", { name: "Next month" }).click();
    await anyDay(page).first().waitFor();
    open = page.getByRole("button", { name: /, available$/ });
  }
  await open.first().click();
}

export interface Patient {
  name: string;
  phone: string;
  age?: string;
  gender?: "MALE" | "FEMALE" | "OTHER";
  doctor?: "Dr. Lakshmi" | "Other Doctors";
}

/** Fills the public booking form and submits it. Returns after the form has been sent. */
export async function submitBooking(page: Page, p: Patient) {
  await page.goto("/book");
  await pickFirstAvailableDate(page);
  await page.getByRole("radiogroup", { name: "Time slot" }).getByRole("radio").first().click();
  await page.getByRole("radio", { name: /^New/ }).click();
  await page.getByRole("radio", { name: new RegExp(`^${p.doctor ?? "Dr. Lakshmi"}`.replace(".", "\\.")) }).click();
  await page.getByPlaceholder("Enter your name").fill(p.name);
  await page.getByPlaceholder("Enter your age").fill(p.age ?? "34");
  await page.locator("#gender").selectOption(p.gender ?? "FEMALE");
  await page.getByPlaceholder(/10-digit/).fill(p.phone);
  await page.getByRole("button", { name: "Book Appointment" }).click();
}

/** Books through the form and returns the appointment ID and the private link token from the confirmation screen. */
export async function bookConsultation(page: Page, p: Patient): Promise<{ id: string; token: string }> {
  await submitBooking(page, p);
  await expect(page.getByRole("heading", { name: /Request Received|Appointment Confirmed/ })).toBeVisible();
  const id = (await page.getByText(/Appointment ID:/).first().innerText()).match(/APT-\d{4}-\d{3}/)?.[0];
  const href = await page.getByRole("link", { name: "Cancel Appointment" }).getAttribute("href");
  const token = href?.split("/").pop();
  if (!id || !token) throw new Error("The confirmation screen did not show an appointment ID and link");
  return { id, token };
}

/** The page's own alert. Next.js also adds an empty role="alert" route announcer outside <main>, so a bare getByRole("alert") is ambiguous. */
export const alertOf = (page: Page) => page.locator("#main-content").getByRole("alert");
export const statusOf = (page: Page) => page.locator("#main-content").getByRole("status");
