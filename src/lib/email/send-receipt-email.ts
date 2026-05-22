import { prisma } from "@/lib/prisma"
import { sendPaymentSuccessEmail, loadProviderConfig } from "@/lib/email"
import { getBaseUrl } from "@/lib/utils"
import { generateInvoicePdfBuffer, generateSowPdfBuffer } from "@/lib/pdf-generator"
import { formatMoney } from "@/lib/currency"

export async function sendReceiptEmailUtil({ invoiceId, orgId }: { invoiceId: string; orgId: string }) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: orgId },
    include: {
      project: {
        include: { client: true }
      }
    }
  })

  if (!invoice || !invoice.project.client.email || invoice.status !== "PAID") {
    throw new Error("Invoice not found or not paid")
  }

  const { project } = invoice;
  const { client } = project;

  const amountStr = formatMoney(Number(invoice.amount), project.currency || "IDR");
  const baseUrl = getBaseUrl();
  const invoiceDetailUrl = `${baseUrl}/invoices/${invoice.id}`;

  let sowPdfBuffer: Buffer | undefined;
  const invoicePdfBuffer = await generateInvoicePdfBuffer(invoice.id);

  if (project.termsAcceptedAt) {
      sowPdfBuffer = await generateSowPdfBuffer(invoice.id);
  }

  console.log(`[SEND_RECEIPT] PDF generation complete for invoice: ${invoice.id}. Proceeding to send email...`);

  // Check if an email provider is configured
  const { config: providerConfig } = await loadProviderConfig(orgId);
  const isManual = Object.keys(providerConfig).length === 0;

  if (isManual) {
    // No provider configured — return manual (mailto) result
    const subject = project.language === "en"
        ? `Payment Receipt [${invoice.invoiceNumber}] for ${project.title}`
        : `Kuitansi Pembayaran [${invoice.invoiceNumber}] untuk ${project.title}`;

    const body = project.language === "en"
        ? `Hello ${client.name},\n\nWe have received your payment for the amount of ${amountStr}.\n\nPlease find your official receipt detail here:\n${invoiceDetailUrl}\n\nThank you!`
        : `Halo ${client.name},\n\nKami telah menerima pembayaran Anda sebesar ${amountStr}.\n\nBerikut adalah detail kuitansi resmi Anda:\n${invoiceDetailUrl}\n\nTerima kasih!`;

    const mailtoData = { to: client.email!, subject, body };

    return {
      success: true,
      manual: true,
      message: "Select your preferred email provider...",
      invoiceLink: invoiceDetailUrl,
      mailtoData
    };
  }

  // Provider configured — send via email provider
  try {
      const result = await sendPaymentSuccessEmail({
          to: client.email!,
          clientName: client.name,
          projectTitle: project.title,
          invoiceNumber: invoice.invoiceNumber,
          amountStr,
          invoiceLink: invoiceDetailUrl,
          sowPdfBuffer,
          invoicePdfBuffer,
          lang: project.language as "id" | "en",
          organizationId: orgId,
      });

      console.log(`[SEND_RECEIPT] Email send result:`, result);

      if (!result.success && result.error) {
         throw result.error;
      }

      return {
        success: true,
        manual: false,
      };
  } catch (emailError: any) {
      console.error("Failed to send receipt email via Resend:", emailError);
      return { success: false, error: emailError?.message || "Failed to send receipt email" }
  }
}