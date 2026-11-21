import { expect, test } from "@playwright/test";
import { bookConsultation, submitBooking, alertOf, statusOf } from "./helpers";

test.describe.configure({ mode: "serial" });

test.describe("patient booking", () => {
  test("a patient books, sees the confirmation, and cannot book the same slot twice", async ({ page }) => {
    const patient = { name: "Asha Reddy", phone: "9876500001" };
    const { id } = await bookConsultation(page, patient);
    expect(id).toMatch(/^APT-\d{4}-\d{3}$/);
    // online bookings wait for the clinic's confirmation by default
    await expect(page.getByRole("heading", { name: "Request Received!" })).toBeVisible();
    // WhatsApp is not connected here, so the screen must not claim a message is on its way
    await expect(page.getByText(/WhatsApp message|being sent to your WhatsApp/)).toHaveCount(0);
    await expect(page.getByText(/Save the links below/)).toBeVisible();

    // the same person, same slot again is refused with a clear message
    await submitBooking(page, patient);
    await expect(alertOf(page)).toContainText("already has a booking in this time slot");
  });

  test("the form refuses invalid details before sending anything", async ({ page }) => {
    await submitBooking(page, { name: "X", phone: "12345" });
    await expect(alertOf(page)).toBeVisible();
    await expect(page.getByRole("heading", { name: /Request Received|Appointment Confirmed/ })).toHaveCount(0);
  });

  test("a patient can edit and then cancel with the private link", async ({ page }) => {
    const { token } = await bookConsultation(page, { name: "Ravi Kumar", phone: "9876500002", doctor: "Other Doctors" });

    await page.goto(`/book/edit/${token}`);
    await expect(page.getByRole("heading", { name: "Edit appointment" })).toBeVisible();
    await page.locator('input[name="fullName"]').fill("Ravi K Kumar");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(statusOf(page)).toContainText("updated successfully");

    await page.goto(`/book/cancel/${token}`);
    await expect(page.getByRole("heading", { name: "Cancel appointment" })).toBeVisible();
    await expect(page.getByText("Ravi K Kumar")).toBeVisible(); // the page shows which appointment is being cancelled
    const confirm = page.getByRole("button", { name: "Confirm cancel" });
    await expect(confirm).toBeDisabled(); // a reason is required
    await page.getByLabel(/Reason for cancelling/).fill("Travelling that week");
    await confirm.click();
    await expect(page.getByRole("heading", { name: "Appointment cancelled" })).toBeVisible();

    // the link now says it is already cancelled instead of showing a dead form
    await page.goto(`/book/cancel/${token}`);
    await expect(page.getByRole("heading", { name: "Already cancelled" })).toBeVisible();
  });

  test("an unknown private link shows the not-found page", async ({ page }) => {
    // (the page streams, so the status line is already sent as 200; Next adds a noindex tag and the page says Not Found)
    await page.goto("/book/cancel/00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]').first()).toBeAttached();
  });
});
