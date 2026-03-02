"use server";

import { Resend } from "resend";
import { InvoiceEmail } from "@/emails/InvoiceEmail";
import { prisma } from "@/lib/prisma";
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
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");

    const invoiceLink = `${baseUrl}/invoices/${invoice.id}`;

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      // Return success with manual flag so UI can handle it gracefully
      return {
        success: true,
        manual: true,
        invoiceLink,
        message:
          "No Resend API Key configured. Please send this link manually.",
      };
    }

    const resend = new Resend(resendApiKey);

    // Send the email
    const { data, error } = await resend.emails.send({
      from:
        process.env.RESEND_FROM_EMAIL || "ProjectBill <onboarding@resend.dev>",
      to: [invoice.project.client.email],
      subject: `Invoice from ProjectBill for ${invoice.project.title}`,
      react: InvoiceEmail({
        clientName: invoice.project.client.name,
        invoiceId: invoice.id,
        projectName: invoice.project.title,
        amount: amountStr,
        dueDate: invoice.dueDate,
        invoiceLink: invoiceLink,
      }) as React.ReactElement,
    });

    if (error) {
      console.error("Resend error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error("Failed to send email:", error);
    return {
      success: false,
      error: error.message || "An unexpected error occurred",
    };
  }
}
