import { prisma } from "@/lib/prisma"
import { sendPaymentSuccessEmail } from "@/lib/email"
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

      let mailtoData = undefined;
      if (result.mocked) {
         const subject = project.language === "en"
             ? `Payment Receipt [${invoice.invoiceNumber}] for ${project.title}`
             : `Kuitansi Pembayaran [${invoice.invoiceNumber}] untuk ${project.title}`;

         const body = project.language === "en"
             ? `Hello ${client.name},\n\nWe have received your payment for the amount of ${amountStr}.\n\nPlease find your official receipt detail here:\n${invoiceDetailUrl}\n\nThank you!`
             : `Halo ${client.name},\n\nKami telah menerima pembayaran Anda sebesar ${amountStr}.\n\nBerikut adalah detail kuitansi resmi Anda:\n${invoiceDetailUrl}\n\nTerima kasih!`;

         mailtoData = { to: client.email!, subject, body };
      }

      return {
        success: true,
        manual: result.mocked,
        message: result.mocked ? "Select your preferred email provider..." : undefined,
        invoiceLink: result.mocked ? invoiceDetailUrl : undefined,
        mailtoData
      }
  } catch (emailError: any) {
      console.error("Failed to send receipt email via Resend:", emailError);
      return { success: false, error: emailError?.message || "Failed to send receipt email" }
  }
}