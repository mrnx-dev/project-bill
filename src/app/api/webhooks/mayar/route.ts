import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMayarWebhook } from "@/lib/mayar";
import { generateSowPdfBuffer, generateInvoicePdfBuffer } from "@/lib/pdf-generator";
import { sendPaymentSuccessEmail } from "@/lib/email";
import { RateLimiter } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications";
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
      data.status === "paid" ||
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
        // Atomic Update: Only update if status is still 'unpaid'.
        // If two webhooks fire instantly, only one transaction matches "unpaid".
        const updateResult = await prisma.invoice.updateMany({
          where: {
            id: invoiceId,
            status: "unpaid",
          },
          data: {
            status: "paid",
            paidAt: new Date(),
            paymentId: data.data?.id || data.transaction_id || data.id,
          },
        });

        if (updateResult.count === 0) {
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

        // --- Trigger Notification ---
        await createNotification({
          title: "Payment Received",
          message: `Invoice ${updatedInvoice.invoiceNumber} for project "${updatedInvoice.project.title}" was marked as paid.`,
          type: "payment",
          linkUrl: `/invoices/${updatedInvoice.id}`,
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

            const formatCurrency = new Intl.NumberFormat(
              project.currency === "IDR" ? "id-ID" : "en-US",
              {
                style: "currency",
                currency: project.currency || "IDR",
                minimumFractionDigits: 0,
              },
            ).format(grandTotal);

            const baseUrl = getBaseUrl();
            const invoiceDetailUrl = `${baseUrl}/invoices/${updatedInvoice.id}`;

            await sendPaymentSuccessEmail({
              to: project.client.email!,
              clientName: project.client.name,
              projectTitle: project.title,
              invoiceNumber: updatedInvoice.invoiceNumber,
              amountStr: formatCurrency,
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
