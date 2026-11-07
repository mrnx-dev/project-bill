import { test, expect } from "@playwright/test";

const testUserEmail = "admin@example.com";
const testUserPassword = "password123";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");

  if (page.url().includes("/setup")) {
    await page.getByLabel("Name").fill("Test Admin");
    await page.getByLabel("Email").fill(testUserEmail);
    await page.getByLabel("Password").fill(testUserPassword);
    await page.getByRole("button", { name: "Create Account" }).click();
    await page.waitForTimeout(2000);
    if (page.url().includes("/login")) {
      await page.getByLabel("Email").fill(testUserEmail);
      await page.getByLabel("Password").fill(testUserPassword);
      await page.getByRole("button", { name: "Login" }).click();
    }
  } else {
    await page.getByLabel("Email").fill(testUserEmail);
    await page.getByLabel("Password").fill(testUserPassword);
    await page.getByRole("button", { name: "Login" }).click();
  }

  await expect(page.getByRole("link", { name: "Clients" })).toBeVisible({
    timeout: 15000,
  });
}

// AI assistant is disabled in production: no widget, no nav entry, no API.
test.describe("AI disabled", () => {
  test("no AI widget, no settings/agent page, endpoints 404", async ({ page }) => {
    await login(page);

    // API endpoints respond 404 (checked right after login — before the SSE
    // streams the dashboard opens occupy the browser's connection pool)
    const history = await page.request.get("/api/agent/history");
    expect(history.status()).toBe(404);
    const config = await page.request.get("/api/agent/config");
    expect(config.status()).toBe(404);
    const chat = await page.request.post("/api/agent/chat", { data: { message: "hi" } });
    expect(chat.status()).toBe(404);

    // Floating chat widget is gone from the dashboard
    await expect(page.locator("button.fixed.bottom-5.right-5")).toHaveCount(0);

    // Sidebar has no AI Assistant entry
    await expect(page.getByRole("link", { name: "AI Assistant" })).toHaveCount(0);

    // Direct settings/agent navigation → 404 page
    await page.goto("/settings/agent");
    await expect(page.getByText("404").first()).toBeVisible({ timeout: 10000 });
  });
});
