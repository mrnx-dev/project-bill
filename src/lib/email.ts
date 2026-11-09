import nodemailer from "nodemailer";
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

export interface CompanySettings extends CompanyInfo {
  senderEmail?: string | null;
  smtpHost?: string | null;
  smtpPort?: string | null;
  smtpUser?: string | null;
  smtpPass?: string | null;
}

export async function getCompanySettings(organizationId: string): Promise<CompanySettings> {
  try {
    const settings = await prisma.settings.findFirst({
      where: { organizationId },
    });
    return {
      companyName: settings?.companyName || "Corez",
      companyEmail: settings?.companyEmail || null,
      companyLogoUrl: settings?.companyLogoUrl || null,
      companyAddress: settings?.companyAddress || null,
      senderEmail: settings?.senderEmail || null,
      smtpHost: settings?.smtpHost || null,
      smtpPort: settings?.smtpPort || null,
      smtpUser: settings?.smtpUser || null,
      smtpPass: settings?.smtpPass ? (decrypt(settings.smtpPass) || null) : null,
    };
  } catch {
    return {
      companyName: "Corez",
      companyEmail: null,
      companyLogoUrl: null,
      companyAddress: null,
      senderEmail: null,
      smtpHost: null,
      smtpPort: null,
      smtpUser: null,
      smtpPass: null,
    };
  }
}

function getSenderFrom(companyName: string, senderEmail?: string | null, smtpUser?: string | null): string {
  // shortcut: corez.local is a placeholder, not deliverable; set sender email in Settings if tenants reply to invoices
  const from = senderEmail?.trim() || smtpUser?.trim() || "noreply@corez.local";
  return `${companyName} <${from}>`;
}

async function sendMail(
  settings: CompanySettings,
  mail: { to: string; subject: string; html: string; attachments?: { filename: string; content: Buffer }[] },
): Promise<{ success: boolean; mocked?: boolean; data?: { messageId: string }; error?: string }> {
  if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPass) {
    return { success: true, mocked: true };
  }
  // shortcut: TLS mode derived from port; add an smtpSecure column if a tenant needs implicit TLS off 465.
  const port = Number(settings.smtpPort) || 587;
  // shortcut: a transport per send, no pooling; cache one if SMTP handshake latency ever matters.
  const transport = nodemailer.createTransport({
    host: settings.smtpHost,
    port,
    secure: port === 465,
    auth: { user: settings.smtpUser, pass: settings.smtpPass },
  });
  try {
    const info = await transport.sendMail({
      from: getSenderFrom(settings.companyName, settings.senderEmail, settings.smtpUser),
      to: mail.to,
      subject: mail.subject,
      html: mail.html,
      attachments: mail.attachments,
    });
    return { success: true, data: { messageId: info.messageId } };
  } catch (error) {
    console.error("[SMTP] Send failed:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export interface SendInvoiceEmailParams {
  to: string;
  clientName: string;
  projectTitle: string;
  invoiceId: string;
  dueDate: Date | null;
  amountStr: string;
  invoiceLink: string;
  lang?: Language;
  organizationId?: string;
}

export async function sendInvoiceEmail(params: SendInvoiceEmailParams) {
  if (params.organizationId) {
    const { checkOrgLimit } = await import("@/lib/billing/subscription");
    const limitCheck = await checkOrgLimit(params.organizationId, "emailsPerMonth");
    if (!limitCheck.allowed) {
      console.warn(`[SUBSCRIPTION] Email limit reached for org ${params.organizationId}`);
      return { success: false, quotaExceeded: true };
    }
  }

  const settings = await getCompanySettings(params.organizationId!);

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

    const result = await sendMail(settings, { to: params.to, subject, html });
    if (!result.success) return { success: false, error: result.error };
    if (result.mocked) {
      console.warn("No SMTP configuration found in DB. Mocking email delivery.");
      console.log(`[MOCK EMAIL] To: ${params.to} | Link: ${params.invoiceLink}`);
      return { success: true, mocked: true };
    }
    if (params.organizationId) {
      const { incrementOrgUsage } = await import("@/lib/billing/subscription");
      await incrementOrgUsage(params.organizationId, "emailsSent");
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error("Failed to send email via SMTP:", error);
    return { success: false, error };
  }
}

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
  organizationId?: string;
}

export async function sendRecurringInvoiceEmail(params: SendRecurringInvoiceEmailParams) {
  if (params.organizationId) {
    const { checkOrgLimit } = await import("@/lib/billing/subscription");
    const limitCheck = await checkOrgLimit(params.organizationId, "emailsPerMonth");
    if (!limitCheck.allowed) {
      console.warn(`[SUBSCRIPTION] Email limit reached for org ${params.organizationId}`);
      return { success: false, quotaExceeded: true };
    }
  }

  const settings = await getCompanySettings(params.organizationId!);

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

    const result = await sendMail(settings, { to: params.to, subject, html });
    if (!result.success) return { success: false, error: result.error };
    if (result.mocked) {
      console.warn("No SMTP configuration found in DB. Mocking recurring email delivery.");
      console.log(`[MOCK RECURRING EMAIL] To: ${params.to} | Link: ${params.invoiceLink}`);
      return { success: true, mocked: true };
    }
    if (params.organizationId) {
      const { incrementOrgUsage } = await import("@/lib/billing/subscription");
      await incrementOrgUsage(params.organizationId, "emailsSent");
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error("Failed to send recurring email via SMTP:", error);
    return { success: false, error };
  }
}

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
  organizationId?: string;
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
  if (params.organizationId) {
    const { checkOrgLimit } = await import("@/lib/billing/subscription");
    const limitCheck = await checkOrgLimit(params.organizationId, "emailsPerMonth");
    if (!limitCheck.allowed) {
      console.warn(`[SUBSCRIPTION] Email limit reached for org ${params.organizationId}`);
      return { success: false, quotaExceeded: true };
    }
  }

  const lang = params.lang || "id";
  const subject = REMINDER_SUBJECTS[params.reminderType][lang](params.projectTitle);
  const settings = await getCompanySettings(params.organizationId!);

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

    const result = await sendMail(settings, { to: params.to, subject, html });
    if (!result.success) return { success: false, error: result.error };
    if (result.mocked) {
      console.warn("No SMTP configuration found in DB. Mocking reminder email delivery.");
      console.log(`[MOCK REMINDER EMAIL] ${params.reminderType} To: ${params.to} | Subject: ${subject}`);
      return { success: true, mocked: true };
    }
    if (params.organizationId) {
      const { incrementOrgUsage } = await import("@/lib/billing/subscription");
      await incrementOrgUsage(params.organizationId, "emailsSent");
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error("Failed to send reminder email:", error);
    return { success: false, error };
  }
}

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
  organizationId?: string;
}

export async function sendPaymentSuccessEmail(params: SendPaymentSuccessEmailParams) {
  if (params.organizationId) {
    const { checkOrgLimit } = await import("@/lib/billing/subscription");
    const limitCheck = await checkOrgLimit(params.organizationId, "emailsPerMonth");
    if (!limitCheck.allowed) {
      console.warn(`[SUBSCRIPTION] Email limit reached for org ${params.organizationId}`);
      return { success: false, quotaExceeded: true };
    }
  }

  const lang = params.lang || "id";
  const settings = await getCompanySettings(params.organizationId!);

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

    const result = await sendMail(settings, {
      to: params.to,
      subject,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    if (!result.success) return { success: false, error: result.error };
    if (result.mocked) {
      console.warn("No SMTP configuration found in DB. Mocking email delivery.");
      console.log(`[MOCK PAYMENT SUCCESS EMAIL] To: ${params.to} | Subject: Payment Received for ${params.projectTitle}`);
      return { success: true, mocked: true };
    }

    if (params.organizationId) {
      const { incrementOrgUsage } = await import("@/lib/billing/subscription");
      await incrementOrgUsage(params.organizationId, "emailsSent");
    }

    return { success: true, data: result.data };
  } catch (error) {
    console.error("Failed to send payment success email:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function sendInviteEmail(params: { to: string; orgName: string; token: string; role: string; organizationId: string }) {
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const inviteLink = `${baseUrl}/invite/${params.token}`;

  const html = `<div style="font-family:sans-serif;padding:20px">
    <h2>You've been invited to join ${params.orgName}</h2>
    <p>You have been invited to join <strong>${params.orgName}</strong> as <strong>${params.role}</strong>.</p>
    <p><a href="${inviteLink}" style="padding:10px 20px;background:#6366f1;color:white;text-decoration:none;border-radius:6px">Accept Invitation</a></p>
    <p>This invitation will expire in 7 days.</p>
  </div>`;

  const settings = await getCompanySettings(params.organizationId);
  const result = await sendMail(settings, { to: params.to, subject: `You've been invited to join ${params.orgName}`, html });
  if (result.mocked) console.log(`[MOCK INVITE EMAIL] To: ${params.to} | Link: ${inviteLink}`);
  return { success: result.success, error: result.error };
}

export async function sendMagicLinkEmail(params: {
  to: string;
  clientName: string;
  links: { orgName: string; url: string }[];
  organizationId: string; // first matching client's org (v1 single-org: the org; multi-org-managed: first org)
}): Promise<{ success: boolean; mocked?: boolean }> {
  const linkRows = params.links
    .map(
      (l) =>
        `<p style="margin:8px 0"><a href="${l.url}" style="padding:10px 20px;background:#6366f1;color:white;text-decoration:none;border-radius:6px">${l.orgName} — Open Portal</a></p>`,
    )
    .join("");

  const html = `<div style="font-family:sans-serif;padding:20px">
    <h2>Client Portal Login</h2>
    <p>Hi ${params.clientName},</p>
    <p>Use the link below to access your portal. The link expires in 15 minutes and can be used once.</p>
    ${linkRows}
    <p style="color:#666;font-size:12px;margin-top:20px">If you did not request this, you can ignore this email.</p>
  </div>`;

  const settings = await getCompanySettings(params.organizationId);
  const result = await sendMail(settings, {
    to: params.to,
    subject: "Your Client Portal Login Link",
    html,
  });
  if (result.mocked) {
    console.log(`[MOCK MAGIC LINK EMAIL] To: ${params.to} | Links: ${params.links.map((l) => l.url).join(", ")}`);
  }
  return { success: result.success, mocked: result.mocked };
}

export async function sendOrgDeletionEmail(params: { to: string; orgName: string; organizationId: string }) {
  const html = `<div style="font-family:sans-serif;padding:20px">
    <h2>Organization Deletion Notice</h2>
    <p>The organization <strong>${params.orgName}</strong> has been scheduled for deletion by its owner.</p>
    <p>All data will be permanently deleted after 30 days. If you believe this was a mistake, please contact the organization owner immediately.</p>
  </div>`;

  const settings = await getCompanySettings(params.organizationId);
  const result = await sendMail(settings, { to: params.to, subject: `Organization Deletion - ${params.orgName}`, html });
  if (result.mocked) console.log(`[MOCK DELETION EMAIL] To: ${params.to}`);
  return { success: result.success, error: result.error };
}

export async function sendExportReadyEmail(params: { to: string; orgName: string; downloadUrl: string; organizationId: string }) {
  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const link = `${baseUrl}${params.downloadUrl}`;

  const html = `<div style="font-family:sans-serif;padding:20px">
    <h2>Data Export Ready</h2>
    <p>Your data export for <strong>${params.orgName}</strong> is ready.</p>
    <p><a href="${link}" style="padding:10px 20px;background:#6366f1;color:white;text-decoration:none;border-radius:6px">Download Export</a></p>
    <p>This link will be available for 24 hours.</p>
  </div>`;

  const settings = await getCompanySettings(params.organizationId);
  const result = await sendMail(settings, { to: params.to, subject: `Data Export Ready - ${params.orgName}`, html });
  if (result.mocked) console.log(`[MOCK EXPORT EMAIL] To: ${params.to} | Link: ${link}`);
  return { success: result.success, error: result.error };
}
