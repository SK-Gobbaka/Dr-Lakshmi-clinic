import { expect, test } from "@playwright/test";
import { CRON_SECRET } from "./helpers";

test.describe("public site", () => {
  test("privacy and terms pages open", async ({ page }) => {
    for (const path of ["/privacy", "/terms", "/doctors", "/treatments"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
    }
  });

  test("security headers are sent", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBeTruthy();
  });

  test("robots and sitemap use the site address", async ({ request }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Sitemap: http://localhost:3100/sitemap.xml");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("<loc>http://localhost:3100/doctors</loc>");
  });

  test("unknown API paths answer with JSON, not a web page", async ({ request }) => {
    const res = await request.get("/api/does-not-exist");
    expect(res.status()).toBe(404);
    expect(res.headers()["content-type"]).toContain("application/json");
  });

  test("an unknown page shows the 404 page", async ({ page }) => {
    const res = await page.goto("/no-such-page");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "Page Not Found" })).toBeVisible();
  });

  test("signed-out visitors cannot reach the admin portal or its data", async ({ request }) => {
    // a browser (it asks for HTML) is sent to the sign-in page with a real redirect
    const admin = await request.get("/admin", { maxRedirects: 0, headers: { Accept: "text/html" } });
    expect([302, 303, 307, 308]).toContain(admin.status());
    expect(admin.headers()["location"]).toContain("/admin/login");
    for (const path of ["/admin/appointments/download?view=all", "/admin/patients/download?phone=9000000000", "/admin/statistics/export", "/admin/api/slots?date=2030-01-01"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(401);
    }
  });

  test("the reminder job refuses calls without its secret", async ({ request }) => {
    expect((await request.get("/api/cron/reminders")).status()).toBe(401);
    expect((await request.get("/api/cron/reminders", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
    const ok = await request.get("/api/cron/reminders", { headers: { Authorization: `Bearer ${CRON_SECRET}` } });
    expect(ok.status()).toBe(200);
    // WhatsApp is not connected in the test setup, so nothing is claimed or sent
    expect(await ok.json()).toMatchObject({ success: true, remindersSent: 0 });
  });
});
