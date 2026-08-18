import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMayarWebhook } from "@/lib/billing/mayar";
import { generateSowPdfBuffer, generateInvoicePdfBuffer } from "@/lib/pdf-generator";
import { sendPaymentSuccessEmail } from "@/lib/email";
import { formatMoney } from "@/lib/currency";
import { RateLimiter } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
import { createAuditLog } from "@/lib/audit-logger";
import { getBaseUrl } from "@/lib/utils";

// Allow 20 webhook requests per minute per IP to prevent spam/abuse
const webhookRateLimiter = new RateLimiter({ limit: 20, windowMs: 60 * 1000 });

export async function POST(request: Request) {
  try {
    // 0. Rate Limiting Check
    const ip = request.headers.get("x-forwarded-for") || "unknown-ip";
    const rateLimitResult = webhookRateLimiter.check(ip);
    if (!rateLimitResult.success) {
      console.warn(`[Webhook Rate Limit] Exceeded for IP: ${ip}`);
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const payload = await request.text();
    const signature = request.headers.get("x-callback-token") || request.headers.get("x-mayar-signature") || request.headers.get("authorization");

    const isValidSignature = await verifyMayarWebhook(payload, signature || "");
    if (!signature || !isValidSignature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const data = JSON.parse(payload);

    // Handling Event: payment.received
    const eventType = data.event || data["event.received"];
    const isPaid =
      eventType === "payment.received" ||
      eventType === "payment.success" ||
      data.status === "PAID" ||
      data.data?.status === true;

    if (isPaid) {
      // In our pay route payload, we send the Invoice ID as the `referenceId`.
      // Mayar webhooks return this as `data.reference_id` or similar depending on event.
      let invoiceId = data.data?.reference_id || data.reference_id;

      if (!invoiceId) {
        // Fallback: extract from productDescription (e.g., "Invoice for Project. ID: uuid")
        const desc = data.data?.productDescription || data.productDescription || "";
        const idMatch = desc.match(/ID:\s*([a-f0-9\-]{36})/i);
        if (idMatch && idMatch[1]) {
          invoiceId = idMatch[1];
        }
      }

      if (invoiceId) {
        // Atomic: invoice PAID + milestone PAID commit together (no drift). The
        // milestone updateMany is a no-op for non-milestone invoices (0 rows match).
        // Audit is created AFTER the tx (see note below) — AuditLog.organizationId
        // has a FK to Organization, so it cannot be "" (unknown inside the tx).
        const paymentId = data.data?.id || data.transaction_id || data.id;
        const count = await prisma.$transaction(async (tx) => {
          const r = await tx.invoice.updateMany({
            where: { id: invoiceId, status: "UNPAID" },
            data: { status: "PAID", paidAt: new Date(), paymentId },
          });
          if (r.count > 0) {
            await tx.paymentMilestone.updateMany({
              where: { invoiceId, status: "INVOICED" },
              data: { status: "PAID" },
            });
          }
          return r.count;
        });

        if (count === 0) {
          console.log(`[Webhook] Invoice ${invoiceId} is already paid or doesn't exist. Ignoring webhook deduplication.`);
          return NextResponse.json({ received: true, ignored: true }, { status: 200 });
        }

        // Fetch the updated invoice to trigger emails & PDF
        const updatedInvoice = await prisma.invoice.findUnique({
          where: { id: invoiceId },
          include: {
            project: {
              include: {
                client: true,
              }
            }
          }
        });

        if (!updatedInvoice) {
          return NextResponse.json({ error: "Invoice not found post-update" }, { status: 500 });
        }

        // Audit after the fetch: organizationId must be the real org id (FK to
        // Organization). userId "system" is safe — AuditLog.userId has no FK.
        await createAuditLog({
          userId: "system",
          organizationId: updatedInvoice.organizationId,
          action: updatedInvoice.type === "MILESTONE" ? "milestone_paid" : "invoice_paid",
          entityType: "Invoice",
          entityId: invoiceId,
        });

        // --- Trigger Notification ---
        await createNotification({
          title: "Payment Received",
          message: `Invoice ${updatedInvoice.invoiceNumber} for project "${updatedInvoice.project.title}" was marked as paid.`,
          type: "payment",
          linkUrl: `/invoices/${updatedInvoice.id}`,
          organizationId: updatedInvoice.organizationId,
        });

        // Generate PDF and send Email in the background
        (async () => {
          try {
            const project = updatedInvoice.project;
            let sowPdfBuffer: Buffer | undefined;
            const invoicePdfBuffer = await generateInvoicePdfBuffer(updatedInvoice.id);

            if (project.termsAcceptedAt) {
              sowPdfBuffer = await generateSowPdfBuffer(updatedInvoice.id);
            }

            const invoiceAmount = Number(updatedInvoice.amount);
            const taxRate = project.taxRate ? Number(project.taxRate) : 0;
            const taxAmount = invoiceAmount * (taxRate / 100);
            const grandTotal = invoiceAmount + taxAmount;

            const amountStr = formatMoney(grandTotal, project.currency || "IDR");

            const baseUrl = getBaseUrl();
            const invoiceDetailUrl = `${baseUrl}/invoices/${updatedInvoice.id}`;

            await sendPaymentSuccessEmail({
              to: project.client.email!,
              clientName: project.client.name,
              projectTitle: project.title,
              invoiceNumber: updatedInvoice.invoiceNumber,
              amountStr,
              invoiceLink: invoiceDetailUrl,
              sowPdfBuffer,
              invoicePdfBuffer,
              lang: project.language as "id" | "en",
            });
            console.log(`[Webhook] Payment success email sent for Invoice ${updatedInvoice.id}`);
          } catch (err) {
            console.error("[Webhook] Failed to generate PDF or send email:", err);
          }
        })();

        // Trigger cache revalidation so other pages updates immediately
        const { revalidatePath } = await import("next/cache");
        revalidatePath(`/invoices/${invoiceId}`);
        revalidatePath("/invoices");
        revalidatePath("/board");

      } else {
        console.warn("[Webhook Warn] Payment successful, but no reference_id found to link to Invoice.");
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}
