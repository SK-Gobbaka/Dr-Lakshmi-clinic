import { expect, test, type Browser, type Page } from "@playwright/test";
import { ADMIN, bookConsultation, signIn, signInAsOwner, alertOf, statusOf } from "./helpers";

test.describe.configure({ mode: "serial" });

const STAFF = { username: "e2e-staff", password: "Staff-Pass-12345" };

/** A signed-in browser tab with its own cookies, and optionally its own client address (the sign-in lockout counts per address). */
async function session(browser: Browser, who: { username: string; password: string }, ip?: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: "http://localhost:3100", ...(ip ? { extraHTTPHeaders: { "x-forwarded-for": ip } } : {}) });
  const page = await context.newPage();
  await signIn(page, who.username, who.password);
  await expect(page.getByRole("heading", { name: /Dashboard|My account/ })).toBeVisible();
  return page;
}

test.describe("admin portal", () => {
  test("a wrong password is refused", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: "http://localhost:3100", extraHTTPHeaders: { "x-forwarded-for": "198.51.100.10" } });
    const page = await context.newPage();
    await signIn(page, ADMIN.username, "not-the-password-1");
    await expect(alertOf(page)).toContainText("Incorrect username or password");
    await expect(page).toHaveURL(/\/admin\/login/);
    await context.close();
  });

  test("the owner signs in and sees what is still to set up", async ({ page }) => {
    await signInAsOwner(page);
    await expect(page.getByRole("heading", { name: "Still to set up" })).toBeVisible();
    await expect(page.getByRole("link", { name: /WhatsApp Business is not connected yet/ })).toBeVisible();
    await expect(page.getByText(/Signed in as e2e-owner \(owner\)/)).toBeVisible();
  });

  test("contact details are validated, saved, and then shown on the public site", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/admin/site");
    // the browser would stop an invalid email before the server saw it; turn that check off to test the server's own check
    await page.locator("form", { has: page.getByRole("button", { name: "Save details" }) }).evaluate((f) => ((f as HTMLFormElement).noValidate = true));

    await page.locator('input[name="email"]').fill("not-an-email");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(alertOf(page)).toContainText("valid email");

    await page.locator('input[name="email"]').fill("clinic@example.com");
    await page.locator('input[name="googleRating"]').fill("9");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(alertOf(page)).toContainText("between 1 and 5");

    await page.locator('input[name="googleRating"]').fill("");
    await page.locator('input[name="phone"]').fill("+91 98765 43210");
    await page.locator('input[name="phoneDisplay"]').fill("+91 98765 43210");
    await page.locator('input[name="addressLine1"]').fill("12 Test Street");
    await page.locator('input[name="addressLine2"]').fill("Testville, Hyderabad");
    await page.locator('input[name="pincode"]').fill("500049");
    await page.locator('input[name="workingHours"]').fill("Mon-Sat: 9 am - 5 pm");
    await page.locator('input[name="statLabel0"]').fill("Years of service");
    await page.locator('input[name="statValue0"]').fill("12");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect(statusOf(page)).toContainText("Saved");

    await page.goto("/");
    await expect(page.getByRole("link", { name: "Call now" }).first()).toHaveAttribute("href", "tel:+919876543210");
    await expect(page.getByText("12 Test Street, Testville, Hyderabad, 500049")).toBeVisible();
    await expect(page.getByText("Years of service")).toBeVisible();
    await expect(page.getByText("Mon-Sat: 9 am - 5 pm").first()).toBeVisible();
  });

  test("a pending booking is confirmed by the owner and cannot be completed early", async ({ page }) => {
    const { id } = await bookConsultation(page, { name: "Meena Iyer", phone: "9876500101" });
    await signInAsOwner(page);
    await page.goto(`/admin/appointments/${id}`);
    await expect(page.getByRole("heading", { name: new RegExp(id) })).toBeVisible();
    await page.getByRole("button", { name: "Confirm appointment" }).click();
    await expect(statusOf(page)).toContainText("Appointment confirmed");

    // completed and no-show can only be set once the appointment has started
    await page.getByRole("button", { name: "Mark completed" }).click();
    await expect(alertOf(page)).toContainText("once the appointment time has started");
  });

  test("the message log records the patient message as skipped while WhatsApp is not connected", async ({ page }) => {
    await signInAsOwner(page);
    await expect(async () => {
      await page.goto("/admin/messages");
      await expect(page.getByText("skipped").first()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await expect(page.getByText("WhatsApp is not configured").first()).toBeVisible();
  });

  test("owners can download appointments and the download is audited", async ({ page }) => {
    await signInAsOwner(page);
    const res = await page.request.get("/admin/appointments/download?view=all");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(await res.text()).toContain("Meena Iyer");
    await page.goto("/admin/audit");
    await expect(page.getByText(/Downloaded \d+ appointment record/).first()).toBeVisible();
  });

  test("patients can be found by phone number", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/admin/patients?q=9876500101");
    await expect(page.getByRole("heading", { name: /1 appointment\(s\) for 9876500101/ })).toBeVisible();
    await expect(page.getByText("Meena Iyer").first()).toBeVisible();
  });

  test("doctors can be added to and removed from the website", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/admin/doctors");
    const add = page.locator("form", { has: page.getByRole("button", { name: "Add doctor" }) });
    await add.locator('input[name="name"]').fill("Dr. E2E Tester");
    await add.locator('input[name="designation"]').fill("Consultant Dermatologist");
    await add.getByRole("button", { name: "Add doctor" }).click();
    await expect(statusOf(page)).toContainText("added");

    await page.goto("/doctors");
    await expect(page.getByText("Dr. E2E Tester")).toBeVisible();

    await page.goto("/admin/doctors");
    await page.locator("details", { hasText: "Dr. E2E Tester" }).locator("summary").click();
    await page.getByRole("button", { name: "Delete doctor" }).click();
    await expect(statusOf(page)).toContainText("Doctor deleted");
  });

  test("a testimonial cannot be published without the patient's consent", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/admin/testimonials");
    const add = page.locator("form", { has: page.getByRole("button", { name: "Add testimonial" }) });
    await add.locator('input[name="name"]').fill("Latha R");
    await add.locator('textarea[name="quote"]').fill("The doctor explained everything clearly.");
    await add.locator('input[name="published"]').check();
    await add.getByRole("button", { name: "Add testimonial" }).click();
    await expect(alertOf(page)).toContainText("written consent");

    await add.locator('input[name="name"]').fill("Latha R");
    await add.locator('textarea[name="quote"]').fill("The doctor explained everything clearly.");
    await add.locator('input[name="consentConfirmed"]').check();
    await add.locator('input[name="published"]').check();
    await add.getByRole("button", { name: "Add testimonial" }).click();
    await expect(statusOf(page)).toContainText("Testimonial saved");

    await page.goto("/");
    await expect(page.getByText("What patients say")).toBeVisible();
    await expect(page.getByText("The doctor explained everything clearly.")).toBeVisible();
  });

  test("a new FAQ appears on the home page", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/admin/faqs");
    const add = page.locator("form", { has: page.getByRole("button", { name: "Add FAQ" }) });
    await add.locator('input[name="question"]').fill("Is parking available?");
    await add.locator('textarea[name="answer"]').fill("Yes, there is parking near the entrance.");
    await add.getByRole("button", { name: "Add FAQ" }).click();
    await expect(statusOf(page)).toContainText("FAQ saved");
    await page.goto("/");
    await expect(page.getByText("Is parking available?")).toBeVisible();
  });

  test("the integrations page shows what is missing and never a secret", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/admin/integrations");
    await expect(page.getByText("WhatsApp Business")).toBeVisible();
    await expect(page.getByText("Not connected").first()).toBeVisible();
    const text = await page.locator("main").innerText();
    expect(text).not.toContain(ADMIN.password);
    expect(text).not.toContain("e2e-session-secret");
    expect(text).not.toContain("e2e-cron-secret");
    await expect(page.getByText("WHATSAPP_TEMPLATE_BOOKING_CONFIRMED")).toBeVisible();
  });

  test("staff accounts can work with appointments but not change the clinic's setup or export data", async ({ page, browser }) => {
    await signInAsOwner(page);
    await page.goto("/admin/users");
    const create = page.locator("form", { has: page.getByRole("button", { name: "Create", exact: true }) });
    await create.locator('input[name="username"]').fill(STAFF.username);
    await create.locator('input[name="password"]').fill(STAFF.password);
    await create.getByRole("button", { name: "Create", exact: true }).click();
    await expect(statusOf(page)).toContainText(`Account "${STAFF.username}" created`);

    const staff = await session(browser, STAFF, "198.51.100.20");
    await expect(staff.getByRole("link", { name: "Appointments" }).first()).toBeVisible();
    await expect(staff.getByRole("link", { name: "Doctors" })).toHaveCount(0);
    await expect(staff.getByRole("link", { name: "Admin accounts" })).toHaveCount(0);

    await staff.goto("/admin/doctors");
    await expect(staff).toHaveURL(/\/admin\?error=/);
    await expect(alertOf(staff)).toContainText("Only an owner account");

    expect((await staff.request.get("/admin/appointments/download?view=all")).status()).toBe(403);
    expect((await staff.request.get("/admin/statistics/export")).status()).toBe(403);

    await staff.goto("/admin/appointments?view=all");
    await expect(staff.getByRole("heading", { name: "Appointments" })).toBeVisible();
    await expect(staff.getByText("Meena Iyer").first()).toBeVisible();
    await staff.context().close();
  });

  test("the last active owner cannot be disabled", async ({ page }) => {
    await signInAsOwner(page);
    await page.goto("/admin/users");
    const owner = page.getByRole("region", { name: `Account ${ADMIN.username}` });
    await owner.getByRole("button", { name: "Disable" }).click();
    await expect(alertOf(page)).toContainText("at least one active owner");
  });

  test("changing a password signs the account out everywhere else", async ({ browser }) => {
    const first = await session(browser, STAFF, "198.51.100.21");
    const second = await session(browser, STAFF, "198.51.100.22");
    await first.goto("/admin/account");
    await first.locator('input[name="current"]').fill(STAFF.password);
    await first.locator('input[name="next"]').fill("Another-Pass-67890");
    await first.locator('input[name="confirm"]').fill("Another-Pass-67890");
    await first.getByRole("button", { name: "Change password" }).click();
    await expect(statusOf(first)).toContainText("Password changed");
    await first.goto("/admin/account");
    await expect(first.getByRole("heading", { name: "My account" })).toBeVisible(); // this browser stays signed in

    await second.goto("/admin");
    await expect(second).toHaveURL(/\/admin\/login/); // the other one is signed out
    await first.context().close();
    await second.context().close();
  });

  test("five failed sign-ins lock the address out, even for the right password", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: "http://localhost:3100", extraHTTPHeaders: { "x-forwarded-for": "198.51.100.99" } });
    const page = await context.newPage();
    for (let i = 0; i < 5; i++) {
      await signIn(page, ADMIN.username, `wrong-password-${i}`);
      await expect(alertOf(page)).toContainText("Incorrect username or password");
    }
    await signIn(page, ADMIN.username, ADMIN.password);
    await expect(alertOf(page)).toContainText("Too many failed attempts");
    await expect(page).toHaveURL(/\/admin\/login/);
    await context.close();
  });
});
