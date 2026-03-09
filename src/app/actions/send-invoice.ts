"use server";

import { Resend } from "resend";
import { InvoiceEmail } from "@/emails/InvoiceEmail";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import type { CompanyInfo } from "@/emails/EmailLayout";

export async function sendInvoiceEmail(invoiceId: string) {
  try {
    // Fetch invoice details
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        project: {
          include: {
            client: true,
          },
        },
      },
    });

    if (!invoice) {
      return { success: false, error: "Invoice not found" };
    }

    if (!invoice.project.client.email) {
      return { success: false, error: "Client has no email address" };
    }

    // Fetch company settings
    const settings = await prisma.settings.findUnique({
      where: { id: "global" },
    });

    const company: CompanyInfo = {
      companyName: settings?.companyName || "ProjectBill",
      companyEmail: settings?.companyEmail || null,
      companyLogoUrl: settings?.companyLogoUrl || null,
      companyAddress: settings?.companyAddress || null,
    };

    // Format the amount
    const formatter = new Intl.NumberFormat(
      invoice.project.currency === "IDR" ? "id-ID" : "en-US",
      {
        style: "currency",
        currency: invoice.project.currency,
        minimumFractionDigits: 0,
      },
    );
    const amountStr = formatter.format(Number(invoice.amount));

    // Resolve the BASE_URL from env or default to localhost
    const baseUrl =
      process.env.APP_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    const invoiceLink = `${baseUrl}/invoices/${invoice.id}`;

    const resendApiKey = settings?.resendApiKey ? decrypt(settings.resendApiKey) : null;
    if (!resendApiKey) {
      // Return success with manual flag so UI can handle it gracefully
      return {
        success: true,
        manual: true,
        invoiceLink,
        message:
          "No Resend API Key configured in Settings. Please send this link manually.",
      };
    }

    const resend = new Resend(resendApiKey);

    // Build sender from address
    const senderFrom = `${company.companyName} <noreply@projectbill.mrndev.me>`;

    const lang = invoice.project.language || "id";
    const subject = lang === "id"
      ? `Invoice ${invoice.invoiceNumber} untuk ${invoice.project.title} - Diperlukan Tindakan`
      : `Invoice ${invoice.invoiceNumber} for ${invoice.project.title} - Action Required`;

    // Send the email
    const { data, error } = await resend.emails.send({
      from: senderFrom,
      to: [invoice.project.client.email],
      subject,
      react: InvoiceEmail({
        clientName: invoice.project.client.name,
        invoiceId: invoice.invoiceNumber,
        projectName: invoice.project.title,
        amount: amountStr,
        dueDate: invoice.dueDate,
        invoiceLink: invoiceLink,
        company,
        lang: invoice.project.language as "id" | "en",
      }) as React.ReactElement,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: unknown) {
    console.error("Failed to send email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
