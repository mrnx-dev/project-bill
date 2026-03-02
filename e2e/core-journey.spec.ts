import { test, expect } from "@playwright/test";
import crypto from "crypto";

// Use a unique suffix to avoid collision with existing data
const uniqueId = crypto.randomBytes(4).toString("hex");
const testUserEmail = "admin@example.com";
const testUserPassword = "password123";

test.describe("Core Business Journey", () => {
  test("Login -> Create Client -> Create Project -> Generate Invoice", async ({
    page,
  }) => {
    // ── Step 1: Login ──────────────────────────────────────
    await page.goto("/login");

    // Handle fresh-DB edge case where /setup is shown instead
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

    // Wait for sidebar nav to appear (indicates successful login)
    await expect(page.getByRole("link", { name: "Clients" })).toBeVisible({
      timeout: 15000,
    });

    // ── Step 2: Create Client ──────────────────────────────
    await page.getByRole("link", { name: "Clients" }).click();
    await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();

    // Open Add Client dialog
    await page.getByRole("button", { name: "Add Client" }).click();

    const clientName = `E2E Client ${uniqueId}`;
    await page.getByLabel("Name").fill(clientName);
    await page.getByLabel("Email").fill(`e2e-${uniqueId}@test.com`);
    await page.getByRole("button", { name: "Save changes" }).click();

    // Wait for dialog to close and verify client appears
    await expect(page.getByRole("cell", { name: clientName })).toBeVisible({
      timeout: 10000,
    });

    // ── Step 3: Create Project ─────────────────────────────
    await page.getByRole("link", { name: "Projects" }).click();
    await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();

    // Open Add Project dialog
    await page.getByRole("button", { name: "Add Project" }).click();

    const projectTitle = `E2E Project ${uniqueId}`;
    await page.getByLabel("Project Title").fill(projectTitle);

    // Select client from Shadcn Select dropdown
    await page
      .getByRole("combobox")
      .filter({ hasText: "Select a client" })
      .click();
    await page.getByRole("option", { name: clientName }).click();

    // Fill total price using the NumericFormat input (target by id)
    await page.locator("#totalPrice").fill("5000000");

    // Submit
    await page.getByRole("button", { name: "Save changes" }).click();

    // Wait for page reload and verify project appears
    await expect(page.getByRole("cell", { name: projectTitle })).toBeVisible({
      timeout: 10000,
    });

    // ── Step 4: Generate Invoice ───────────────────────────
    // Find the project row and click the invoice icon button
    const projectRow = page.getByRole("row").filter({ hasText: projectTitle });
    await projectRow.getByRole("button", { name: "Generate Invoice" }).click();

    // The Generate Invoice dialog should appear
    await expect(
      page.getByRole("heading", { name: "Generate Invoice" }),
    ).toBeVisible();

    // Full Payment radio should be pre-selected, just click Generate
    await page.getByRole("button", { name: "Generate Invoice" }).click();

    // Should redirect to /invoices after success
    await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible({
      timeout: 10000,
    });

    // ── Step 5: Verify Invoice Created ─────────────────────
    await expect(page.getByRole("cell", { name: projectTitle })).toBeVisible();
  });
});
