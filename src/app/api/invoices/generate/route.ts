import { NextResponse } from "next/server";
import { sendInvoiceEmail } from "@/app/actions/send-invoice";
import { withTenantRls, getTenantCtx } from "@/lib/rls";
import { generateInvoiceNumber } from "@/lib/invoice-utils";
import { getBaseUrl } from "@/lib/utils";

export const POST = withTenantRls(async (request, _ctx, tx) => {
  try {
    const ctx = getTenantCtx()!;
    const orgId = ctx.organizationId;
    const json = await request.json();
    const { projectId } = json;

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const project = await tx.project.findUnique({
      where: { id: projectId, organizationId: orgId },
      include: { client: true, invoices: true, items: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.status !== "DONE") {
      return NextResponse.json(
        { error: "Project is not marked as done yet." },
        { status: 400 },
      );
    }

    const existingInvoice = project.invoices.find(
      (i) => i.type === "FULL_PAYMENT",
    );
    if (existingInvoice) {
      if (existingInvoice.paymentLink) {
        return NextResponse.json(
          { invoice: existingInvoice, emailSent: false },
          { status: 200 },
        );
      }
    }

    let amountToPay = Number(project.totalPrice);
    if (project.dpAmount) {
      amountToPay -= Number(project.dpAmount);
    }

    if (amountToPay <= 0) {
      return NextResponse.json(
        { error: "Cannot generate an invoice for an amount of 0 or less." },
        { status: 400 }
      );
    }

    // --- Subscription Gate Check (self-hosted: bypassed) ---
    const { checkOrgLimit, incrementOrgUsage } = await import("@/lib/billing/subscription");
    const limitCheck = await checkOrgLimit(orgId, "invoicesPerMonth");
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: "Plan limit reached", limitCheck },
        { status: 403 }
      );
    }
    // -------------------------------

    // Payment link generation is fully deferred to the "Pay Now" button.
    const paymentLinkRes = null as { link?: string; id?: string } | null;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);

    const invoiceNumber = await generateInvoiceNumber(orgId);

    const newInvoice = await tx.invoice.create({
      data: {
        organizationId: orgId,
        invoiceNumber,
        projectId: project.id,
        type: "FULL_PAYMENT",
        amount: amountToPay,
        notes: `Full Payment for ${project.title}`,
        status: "UNPAID",
        dueDate,
        paymentLink: paymentLinkRes ? paymentLinkRes.link : null,
        paymentId: paymentLinkRes ? (paymentLinkRes.id || null) : null,
      },
    });

    // --- Subscription Usage Increment (self-hosted: no-op) ---
    await incrementOrgUsage(orgId, "invoicesCreated");
    // ------------------------------------

    const baseUrl = getBaseUrl();
    const invoiceDetailUrl = `${baseUrl}/invoices/${newInvoice.id}`;

    // Soft-fail: Try communicating with Resend, but don't fail the whole block if it errors.
    let emailSent = false;
    let manual = false;
    let mailtoData: { to: string; subject: string; body: string } | undefined;

    if (project.client.email) {
      try {
        const emailRes = await sendInvoiceEmail(newInvoice.id, true);
        if (emailRes.success && !emailRes.manual) {
          emailSent = true;
        }
        if (emailRes.manual) {
          manual = true;
          mailtoData = emailRes.mailtoData;
        }
      } catch (err) {
        console.error("Email delivery failed non-fatally", err);
      }
    }

    return NextResponse.json({
      success: true,
      invoice: newInvoice,
      emailSent,
      manual,
      mailtoData: mailtoData
    },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to generate invoice:", error);
    return NextResponse.json(
      { error: "Failed to generate invoice" },
      { status: 500 },
    );
  }
});