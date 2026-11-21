import { expect, test } from "@playwright/test";

// This file runs first (files run in name order) so it sees the database exactly as a new installation has it.
test("a new installation shows only real content: no stats, reviews, photos or phone number", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Dr. Lakshmi");
  await expect(page.getByRole("link", { name: "Book appointment" }).first()).toBeVisible();

  // a fresh database has no testimonials, gallery photos or figures, and the clinic has not entered a phone number
  await expect(page.getByText("What patients say")).toHaveCount(0);
  await expect(page.getByText("Inside the clinic")).toHaveCount(0);
  await expect(page.getByRole("link", { name: /call/i })).toHaveCount(0);
  await expect(page.getByLabel("Clinic at a glance")).toHaveCount(0);

  // the default FAQs do come from the database
  await expect(page.getByText("Common questions")).toBeVisible();

  // none of the invented figures the old site showed
  await expect(page.getByText(/20,000|1,250|15\+|4\.8/)).toHaveCount(0);
  await expect(page.getByText(/Board-certified|State-of-the-art/)).toHaveCount(0);
});
