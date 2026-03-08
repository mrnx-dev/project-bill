import { Resend } from "resend";
import { render } from "@react-email/render";
import { prisma } from "@/lib/prisma";
import { InvoiceEmail } from "@/emails/InvoiceEmail";
import { ReminderEmail } from "@/emails/ReminderEmail";
import { PaymentSuccessEmail } from "@/emails/PaymentSuccessEmail";
import type { ReminderType } from "@/emails/ReminderEmail";
import type { CompanyInfo, Language } from "@/emails/EmailLayout";

export type { ReminderType };

const resend = new Resend(process.env.RESEND_API_KEY || "re_mock");

// ── Fetch Company Settings ────────────────────────────────────

async function getCompanyInfo(): Promise<CompanyInfo> {
  try {
    const settings = await prisma.settings.findUnique({
      where: { id: "global" },
    });
    return {
      companyName: settings?.companyName || "ProjectBill",
      companyEmail: settings?.companyEmail || null,
      companyLogoUrl: settings?.companyLogoUrl || null,
      companyAddress: settings?.companyAddress || null,
    };
  } catch {
    return { companyName: "ProjectBill", companyEmail: null, companyLogoUrl: null, companyAddress: null };
  }
}

function getSenderFrom(companyName: string): string {
  const fromDomain = process.env.RESEND_FROM_EMAIL;
  if (fromDomain) return `${companyName} <noreply@${fromDomain}>`;
  return `${companyName} <noreply@projectbill.mrndev.me>`;
}

// ── Invoice Email ─────────────────────────────────────────────

export interface SendInvoiceEmailParams {
  to: string;
  clientName: string;
  projectTitle: string;
  amountStr: string;
  invoiceLink: string;
  lang?: Language;
}

export async function sendInvoiceEmail(params: SendInvoiceEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("No RESEND_API_KEY found. Mocking email delivery.");
    console.log(`[MOCK EMAIL] To: ${params.to} | Link: ${params.invoiceLink}`);
    return { success: true, mocked: true };
  }

  try {
    const company = await getCompanyInfo();
    const lang = params.lang || "id";

    const html = await render(
      InvoiceEmail({
        clientName: params.clientName,
        invoiceId: "",
        projectName: params.projectTitle,
        amount: params.amountStr,
        dueDate: null,
        invoiceLink: params.invoiceLink,
        company,
        lang,
      })
    );

    const subject = lang === "id"
      ? `Invoice untuk ${params.projectTitle} - Diperlukan Tindakan`
      : `Invoice for ${params.projectTitle} - Action Required`;

    const data = await resend.emails.send({
      from: getSenderFrom(company.companyName),
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

  if (!process.env.RESEND_API_KEY) {
    console.warn("[MOCK REMINDER EMAIL]", params.reminderType);
    console.log(`  To: ${params.to} | Subject: ${subject}`);
    return { success: true, mocked: true };
  }

  try {
    const company = await getCompanyInfo();

    const html = await render(
      ReminderEmail({
        clientName: params.clientName,
        projectName: params.projectTitle,
        invoiceId: params.invoiceId,
        amount: params.amountStr,
        invoiceLink: params.invoiceLink,
        reminderType: params.reminderType,
        lateFeeAmount: params.lateFeeAmountStr,
        company,
        lang,
      })
    );

    const data = await resend.emails.send({
      from: getSenderFrom(company.companyName),
      to: [params.to],
      subject,
      html,
    });

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
  invoiceId: string;
  amountStr: string;
  invoiceLink: string;
  sowPdfBuffer?: Buffer;
  lang?: Language;
}

export async function sendPaymentSuccessEmail(params: SendPaymentSuccessEmailParams) {
  const lang = params.lang || "id";

  if (!process.env.RESEND_API_KEY) {
    console.warn("[MOCK PAYMENT SUCCESS EMAIL]");
    console.log(`  To: ${params.to} | Subject: Payment Received for ${params.projectTitle}`);
    return { success: true, mocked: true };
  }

  try {
    const company = await getCompanyInfo();

    const attachments = [];
    if (params.sowPdfBuffer) {
      attachments.push({
        filename: `Statement_of_Work_${params.projectTitle.replace(/[^a-z0-9]/gi, '_')}.pdf`,
        content: params.sowPdfBuffer,
      });
    }

    const html = await render(
      PaymentSuccessEmail({
        clientName: params.clientName,
        projectName: params.projectTitle,
        invoiceId: params.invoiceId,
        amount: params.amountStr,
        invoiceLink: params.invoiceLink,
        hasSowAttachment: !!params.sowPdfBuffer,
        company,
        lang,
      })
    );

    const subject = lang === "id"
      ? "Pembayaran Diterima - Terima kasih atas kerjasamanya!"
      : "Payment Received - Thank you for your business!";

    const data = await resend.emails.send({
      from: getSenderFrom(company.companyName),
      to: [params.to],
      subject,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    return { success: true, data };
  } catch (error) {
    console.error("Failed to send payment success email:", error);
    return { success: false, error };
  }
}
