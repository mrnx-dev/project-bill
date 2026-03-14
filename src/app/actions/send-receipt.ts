"use server";

import { prisma } from "@/lib/prisma"
import { sendPaymentSuccessEmail } from "@/lib/email"
import { getBaseUrl } from "@/lib/utils";
import { generateInvoicePdfBuffer, generateSowPdfBuffer } from "@/lib/pdf-generator";
import { auth } from "@/auth";

export async function sendReceiptEmail(invoiceId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        project: {
          include: {
            client: true
          }
        }
      }
    })

    if (!invoice || !invoice.project.client.email || invoice.status !== "paid") {
      throw new Error("Invoice not found or not paid")
    }

    const { project } = invoice;
    const { client } = project;

    const formatCurrency = new Intl.NumberFormat(
      project.currency === "IDR" ? "id-ID" : "en-US",
      {
        style: "currency",
        currency: project.currency || "IDR",
        minimumFractionDigits: 0,
      }
    )

    const amountStr = formatCurrency.format(Number(invoice.amount));
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
               ? `Hello ${client.name},\n\We have received your payment for the amount of ${amountStr}.\n\nPlease find your official receipt detail here:\n${invoiceDetailUrl}\n\nThank you!`
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
  } catch (error) {
    console.error("Error generating/sending receipt email:", error)
    return { success: false, error: "Failed to send receipt email" }
  }
}
