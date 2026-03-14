import { Resend } from "resend";
import { render } from "@react-email/render";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { InvoiceEmail } from "@/emails/InvoiceEmail";
import { RecurringInvoiceEmail } from "@/emails/RecurringInvoiceEmail";
import { ReminderEmail } from "@/emails/ReminderEmail";
import { PaymentSuccessEmail } from "@/emails/PaymentSuccessEmail";
import type { ReminderType } from "@/emails/ReminderEmail";
import type { CompanyInfo, Language } from "@/emails/EmailLayout";

export type { ReminderType };

// ── Fetch Company Settings ────────────────────────────────────

export interface CompanySettings extends CompanyInfo {
  resendApiKey?: string;
  senderEmail?: string | null;
}

export async function getCompanySettings(): Promise<CompanySettings> {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: "global" },
    });
    return {
      companyName: settings?.companyName || "ProjectBill",
      companyEmail: settings?.companyEmail || null,
      companyLogoUrl: settings?.companyLogoUrl || null,
      companyAddress: settings?.companyAddress || null,
      senderEmail: settings?.senderEmail || null,
      resendApiKey: settings?.resendApiKey ? (decrypt(settings.resendApiKey) || undefined) : undefined,
    };
  } catch {
    return {
      companyName: "ProjectBill",
      companyEmail: null,
      companyLogoUrl: null,
      companyAddress: null,
      senderEmail: null,
      resendApiKey: undefined,
    };
  }
}

function getSenderFrom(companyName: string, senderEmail?: string | null): string {
  if (senderEmail && senderEmail.trim() !== "") {
    return `${companyName} <${senderEmail.trim()}>`;
  }
  return `${companyName} <noreply@projectbill.mrndev.me>`; // Custom domain email
}

// ── Invoice Email ─────────────────────────────────────────────

export interface SendInvoiceEmailParams {
  to: string;
  clientName: string;
  projectTitle: string;
  invoiceId: string;
  dueDate: Date | null;
  amountStr: string;
  invoiceLink: string;
  lang?: Language;
}

export async function sendInvoiceEmail(params: SendInvoiceEmailParams) {
  const settings = await getCompanySettings();

  if (!settings.resendApiKey) {
    console.warn("No RESEND_API_KEY found in DB. Mocking email delivery.");
    console.log(`[MOCK EMAIL] To: ${params.to} | Link: ${params.invoiceLink}`);
    return { success: true, mocked: true };
  }

  const resend = new Resend(settings.resendApiKey);

  try {
    const lang = params.lang || "id";

    const html = await render(
      InvoiceEmail({
        clientName: params.clientName,
        invoiceId: params.invoiceId,
        projectName: params.projectTitle,
        amount: params.amountStr,
        dueDate: params.dueDate,
        invoiceLink: params.invoiceLink,
        company: settings,
        lang,
      })
    );

    const subject = lang === "id"
      ? `Invoice untuk ${params.projectTitle} - Diperlukan Tindakan`
      : `Invoice for ${params.projectTitle} - Action Required`;

    const data = await resend.emails.send({
      from: getSenderFrom(settings.companyName, settings.senderEmail),
      to: [params.to],
      subject,
      html,
    });

    return { success: true, data };
  } catch (error) {
    console.error("Failed to send email via Resend:", error);
    return { success: false, error };
  }
}

// ── Recurring Invoice Email ───────────────────────────────────

export interface SendRecurringInvoiceEmailParams {
  to: string;
  clientName: string;
  projectTitle: string;
  invoiceId: string;
  dueDate: Date | null;
  amountStr: string;
  invoiceLink: string;
  description?: string | null;
  lang?: Language;
}

export async function sendRecurringInvoiceEmail(params: SendRecurringInvoiceEmailParams) {
  const settings = await getCompanySettings();

  if (!settings.resendApiKey) {
    console.warn("No RESEND_API_KEY found in DB. Mocking recurring email delivery.");
    console.log(`[MOCK RECURRING EMAIL] To: ${params.to} | Link: ${params.invoiceLink}`);
    return { success: true, mocked: true };
  }

  const resend = new Resend(settings.resendApiKey);

  try {
    const lang = params.lang || "id";

    const html = await render(
      RecurringInvoiceEmail({
        clientName: params.clientName,
        invoiceId: params.invoiceId,
        projectName: params.projectTitle,
        amount: params.amountStr,
        dueDate: params.dueDate,
        invoiceLink: params.invoiceLink,
        description: params.description,
        company: settings,
        lang,
      })
    );

    const subject = lang === "id"
      ? `Tagihan Rutin untuk ${params.projectTitle} - Diperlukan Tindakan`
      : `Recurring Invoice for ${params.projectTitle} - Action Required`;

    const { data, error } = await resend.emails.send({
      from: getSenderFrom(settings.companyName, settings.senderEmail),
      to: [params.to],
      subject,
      html,
    });

    if (error) {
      console.error("[RESEND] API Error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Failed to send recurring email via Resend:", error);
    return { success: false, error };
  }
}

// ── Reminder Email ────────────────────────────────────────────

export interface SendReminderEmailParams {
  to: string;
  clientName: string;
  projectTitle: string;
  invoiceId: string;
  amountStr: string;
  invoiceLink: string;
  reminderType: ReminderType;
  lateFeeAmountStr?: string;
  lang?: Language;
}

const REMINDER_SUBJECTS: Record<ReminderType, Record<Language, (title: string) => string>> = {
  pre_due: {
    id: (t) => `Pengingat: Invoice untuk "${t}" jatuh tempo dalam 3 hari`,
    en: (t) => `Reminder: Invoice for "${t}" is due in 3 days`,
  },
  overdue_d1: {
    id: (t) => `Terlambat: Invoice untuk "${t}" telah melewati jatuh tempo`,
    en: (t) => `Overdue: Invoice for "${t}" is now past due`,
  },
  overdue_d3: {
    id: (t) => `Follow-up: Invoice untuk "${t}" terlambat 3 hari`,
    en: (t) => `Follow-up: Invoice for "${t}" is 3 days overdue`,
  },
  late_fee: {
    id: (t) => `Pemberitahuan: Denda keterlambatan berlaku untuk invoice "${t}"`,
    en: (t) => `Notice: Late fee applied to invoice for "${t}"`,
  },
};

export async function sendReminderEmail(params: SendReminderEmailParams) {
  const lang = params.lang || "id";
  const subject = REMINDER_SUBJECTS[params.reminderType][lang](params.projectTitle);
  const settings = await getCompanySettings();

  if (!settings.resendApiKey) {
    console.warn("[MOCK REMINDER EMAIL]", params.reminderType);
    console.log(`  To: ${params.to} | Subject: ${subject}`);
    return { success: true, mocked: true };
  }

  const resend = new Resend(settings.resendApiKey);

  try {
    const html = await render(
      ReminderEmail({
        clientName: params.clientName,
        projectName: params.projectTitle,
        invoiceId: params.invoiceId,
        amount: params.amountStr,
        invoiceLink: params.invoiceLink,
        reminderType: params.reminderType,
        lateFeeAmount: params.lateFeeAmountStr,
        company: settings,
        lang,
      })
    );

    const { data, error } = await resend.emails.send({
      from: getSenderFrom(settings.companyName, settings.senderEmail),
      to: [params.to],
      subject,
      html,
    });

    if (error) {
      console.error("[RESEND] API Error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Failed to send reminder email:", error);
    return { success: false, error };
  }
}

// ── Payment Success Email ─────────────────────────────────────

export interface SendPaymentSuccessEmailParams {
  to: string;
  clientName: string;
  projectTitle: string;
  invoiceNumber: string;
  amountStr: string;
  invoiceLink: string;
  sowPdfBuffer?: Buffer;
  invoicePdfBuffer?: Buffer;
  lang?: Language;
}

export async function sendPaymentSuccessEmail(params: SendPaymentSuccessEmailParams) {
  const lang = params.lang || "id";
  const settings = await getCompanySettings();

  if (!settings.resendApiKey) {
    console.warn("[MOCK PAYMENT SUCCESS EMAIL]");
    console.log(`  To: ${params.to} | Subject: Payment Received for ${params.projectTitle}`);
    return { success: true, mocked: true };
  }

  const resend = new Resend(settings.resendApiKey);

  try {
    const attachments = [];
    if (params.sowPdfBuffer) {
      attachments.push({
        filename: `Statement_of_Work_${params.projectTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`,
        content: params.sowPdfBuffer,
      });
    }
    if (params.invoicePdfBuffer) {
      attachments.push({
        filename: `Invoice_${params.invoiceNumber.replace(/[^a-z0-9]/gi, '_')}.pdf`,
        content: params.invoicePdfBuffer,
      });
    }

    const html = await render(
      PaymentSuccessEmail({
        clientName: params.clientName,
        projectName: params.projectTitle,
        invoiceNumber: params.invoiceNumber,
        amount: params.amountStr,
        invoiceLink: params.invoiceLink,
        hasSowAttachment: !!params.sowPdfBuffer,
        company: settings,
        lang,
      })
    );

    const subject = lang === "id"
      ? "Pembayaran Diterima - Terima kasih atas kerjasamanya!"
      : "Payment Received - Thank you for your business!";

    const from = getSenderFrom(settings.companyName, settings.senderEmail);
    console.log(`[RESEND] Attempting to send payment success email from: ${from} to: ${params.to}`);

    const { data, error } = await resend.emails.send({
      from,
      to: [params.to],
      subject,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (error) {
      console.error("[RESEND] API Error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Failed to send payment success email:", error);
    return { success: false, error };
  }
}
