import { expect, test } from "@playwright/test";
import { alertOf, bookConsultation, signIn, statusOf } from "../e2e/helpers";

// Runs against whatever SMOKE_BASE_URL points at (see playwright.smoke.config.ts). Nothing here assumes empty data.

test("the public pages render and the slot list answers", async ({ page, request }) => {
  for (const path of ["/", "/doctors", "/treatments", "/book", "/privacy", "/terms"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
  }
  const next = new Date(Date.now() + 2 * 86_400_000);
  if (next.getUTCDay() === 0) next.setTime(next.getTime() + 86_400_000);
  const slots = await request.get(`/api/slots?date=${next.toISOString().slice(0, 10)}`);
  expect(slots.status()).toBe(200);
  expect((await slots.json()).slots.length).toBeGreaterThan(0);
});

test("signed-out visitors are kept out of the admin portal", async ({ request }) => {
  const res = await request.get("/admin", { maxRedirects: 0, headers: { Accept: "text/html" } });
  expect([302, 307, 308]).toContain(res.status());
  expect((await request.get("/admin/appointments/download?view=all", { maxRedirects: 0 })).status()).toBe(401);
});

test("an owner can sign in; a patient books; the owner confirms and then cancels the test booking", async ({ page }) => {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  test.skip(!username || !password, "set ADMIN_USERNAME and ADMIN_PASSWORD to run the sign-in part");

  // a patient books (unique number so a repeated run never collides with an earlier test booking)
  const phone = `9${String(Date.now()).slice(-9)}`;
  const { id } = await bookConsultation(page, { name: "Smoke Test", phone });

  await signIn(page, username!, password!);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.goto(`/admin/appointments/${id}`);
  await expect(page.getByRole("heading", { name: new RegExp(id) })).toBeVisible();
  await page.getByRole("button", { name: "Confirm appointment" }).click();
  await expect(statusOf(page)).toContainText("Appointment confirmed");

  // cancel the test booking so it does not occupy a place
  await page.getByLabel("Cancellation reason").fill("smoke test");
  await page.getByRole("button", { name: "Cancel appointment" }).click();
  await expect(statusOf(page)).toContainText("cancelled by admin");
  await expect(alertOf(page)).toHaveCount(0);
});
