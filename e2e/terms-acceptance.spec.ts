import { test, expect } from "@playwright/test";
import { prisma } from "../src/lib/prisma"; // Assumes E2E runs in the same environment or can access DB
import crypto from "crypto";

test.describe("Terms of Service Acceptance Flow", () => {
  let testProject: any;
  let testInvoice: any;

  test.beforeAll(async () => {
    // Find the test client (seeded from core-journey.spec.ts or seed-test-user.ts)
    let client = await prisma.client.findFirst({
      where: { email: "e2e@example.com" },
    });

    if (!client) {
      client = await prisma.client.create({
        data: {
          name: "E2E Client",
          email: "e2e@example.com",
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
        terms: "1. No revisions.\n2. Payment non-refundable.",
        items: {
          create: [{ description: "Terms Test Item 1", price: 10000000 }],
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
      },
    });
  });

  test.afterAll(async () => {
    // Cleanup created data
    if (testInvoice)
      await prisma.invoice
        .delete({ where: { id: testInvoice.id } })
        .catch(() => {});
    if (testProject)
      await prisma.project
        .delete({ where: { id: testProject.id } })
        .catch(() => {});
  });

  test("Client must accept terms to see the Pay Now button", async ({
    page,
  }) => {
    // 1. Visit the public invoice URL
    await page.goto(`/invoices/${testInvoice.id}`);

    // 2. Verify "Pay Now" is hiding
    const payButton = page.getByRole("button", { name: /Pay Rp/ });
    await expect(payButton).not.toBeVisible();

    // 3. Verify the Terms Agreement card is visible
    await expect(page.getByText("Digital Agreement Required")).toBeVisible();
    await expect(page.getByText("1. No revisions.")).toBeVisible();

    // 4. Try to click Agree without checking the box (Button should be disabled)
    const acceptButton = page.getByRole("button", {
      name: "Accept Terms & Proceed to Payment",
    });
    await expect(acceptButton).toBeDisabled();

    // 5. Check the "I agree" box
    await page.getByRole("checkbox").check();
    await expect(acceptButton).toBeEnabled();

    // 6. Click Accept
    await acceptButton.click();

    // 7. Verify the success state appears
    await expect(page.getByText("Terms & Conditions Accepted")).toBeVisible();
    await expect(page.getByText(/Digitally signed on/)).toBeVisible();

    // 8. Verify the Pay Now button is now visible
    await expect(payButton).toBeVisible();
    await expect(payButton).toBeEnabled();
  });
});
