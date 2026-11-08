import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/prisma"; // Assumes E2E runs in the same environment or can access DB
import crypto from "crypto";

test.describe("Terms of Service Acceptance Flow", () => {
  let testProject: { id: string; terms: string | null } | null = null;
  let testInvoice: { id: string } | null = null;

  test.beforeAll(async () => {
    // Pastikan ada organisasi untuk mengaitkan data tenant
    const org = await prisma.organization.findFirst()
      ?? await prisma.organization.create({ data: { name: "Seed Org", slug: "seed-org" } });

    // Find the test client (seeded from core-journey.spec.ts or seed-test-user.ts)
    let client = await prisma.client.findFirst({
      where: { email: "e2e@example.com" },
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: "E2E Client",
          email: "e2e@example.com",
          organizationId: org.id,
        },
      });
    }

    // Create a project WITH terms
    testProject = await prisma.project.create({
      data: {
        clientId: client.id,
        title: `E2E Terms Test Project ${crypto.randomBytes(4).toString("hex")}`,
        status: "pending",
        totalPrice: 10000000,
        dpAmount: 5000000,
        currency: "IDR",
        language: "en",
        terms: "1. No revisions.\n2. Payment non-refundable.",
        organizationId: org.id,
        items: {
          create: [{ description: "Terms Test Item 1", price: 10000000, organizationId: org.id }],
        },
      },
    });

    // Create an invoice for this project
    testInvoice = await prisma.invoice.create({
      data: {
        projectId: testProject.id,
        amount: 5000000,
        status: "unpaid",
        type: "dp",
        paymentId: "fake-link-id",
        paymentLink: "https://pay.mayar.id/fake",
        organizationId: org.id,
      },
    });
  });

  test.afterAll(async () => {
    // Cleanup created data
    if (testInvoice)
      await prisma.invoice
        .delete({ where: { id: testInvoice.id } })
        .catch(() => { });
    if (testProject)
      await prisma.project
        .delete({ where: { id: testProject.id } })
        .catch(() => { });
  });

  test("mobile contract fills the viewport and keeps the agreement readable", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/invoices/${testInvoice!.id}`);
    await page.getByRole("button", { name: "Review & Sign Document" }).click();

    const dialog = page.getByRole("dialog");
    await expect.poll(async () => (await dialog.boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(374);
    await expect.poll(async () => (await dialog.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(666);
    const scrollArea = dialog.locator(".overflow-y-auto");
    await expect(scrollArea.getByRole("checkbox")).toBeAttached();
    await scrollArea.evaluate((node) => node.scrollTo(0, node.scrollHeight));
    await expect(dialog.getByRole("checkbox")).toBeEnabled();
    await dialog.getByRole("checkbox").check({ force: true });
    await expect(dialog.getByRole("button", { name: "Sign Agreement" })).toBeEnabled();
  });

  test("Client must accept terms to see the Pay Now button", async ({
    page,
  }) => {
    expect(testInvoice).toBeDefined();
    if (!testInvoice) return;

    // 1. Visit the public invoice URL
    await page.goto(`/invoices/${testInvoice.id}`);

    // 2. Verify "Pay Now" is hiding
    const payment = page.getByRole("button", { name: /Pay Rp/ }).or(page.getByText("Manual Bank Transfer"));
    await expect(payment).not.toBeVisible();

    // 3. Verify the Terms Agreement card is visible and open the dialog
    await expect(page.getByText("Digital Agreement Required")).toBeVisible();

    // Click the trigger button to open the contract modal
    await page.getByRole("button", { name: "Review & Sign Document" }).click();

    // Verify dialog content is visible
    await expect(page.getByText("No revisions.")).toBeVisible();

    // 4. Scroll to the bottom of the terms container
    // We target the scrollable container. Since we are using standard Tailwind utility 'overflow-y-auto', 
    // let's grab the container holding the terms text.
    const termsContainer = page.locator('.overflow-y-auto').first();
    await termsContainer.evaluate((node) => {
      node.scrollTo(0, node.scrollHeight);
    });

    // Wait a brief moment for the scroll event listener to trigger State update
    await page.waitForTimeout(500);

    // 4. Try to click Agree without checking the box (Button should be disabled)
    const acceptButton = page.getByRole("button", {
      name: "Sign Agreement",
    });
    await expect(acceptButton).toBeDisabled();

    // 5. Check the "I agree" box
    // Because it's a visually hidden checkbox covered by custom tailwind <div>, we must force it
    await page.getByRole("checkbox").check({ force: true });
    await expect(acceptButton).toBeEnabled();

    // 6. Click Accept
    await acceptButton.click();

    // 7. Verify the success state appears
    await expect(page.getByText("Valid Digital Contract Formed")).toBeVisible({ timeout: 25000 });
    await expect(page.getByText(/Digitally signed and accepted on/)).toBeVisible();

    // 8. The configured payment method is now visible.
    await expect(payment).toBeVisible();
  });
});
