import { render } from "@react-email/render";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { providerRegistry } from "./email/providers/registry";
import { InvoiceEmail } from "@/emails/InvoiceEmail";
import { RecurringInvoiceEmail } from "@/emails/RecurringInvoiceEmail";
import { ReminderEmail } from "@/emails/ReminderEmail";
import { PaymentSuccessEmail } from "@/emails/PaymentSuccessEmail";
import type { ReminderType } from "@/emails/ReminderEmail";
import type { CompanyInfo, Language } from "@/emails/EmailLayout";

export type { ReminderType };

export interface CompanySettings extends CompanyInfo {
  senderEmail?: string | null;
}

export async function getCompanySettings(organizationId: string): Promise<CompanySettings> {
  try {
    const settings = await prisma.settings.findFirst({
      where: { organizationId },
    });
    return {
      companyName: settings?.companyName || "ProjectBill",
      companyEmail: settings?.companyEmail || null,
      companyLogoUrl: settings?.companyLogoUrl || null,
      companyAddress: settings?.companyAddress || null,
      senderEmail: settings?.senderEmail || null,
    };
  } catch {
    return {
      companyName: "ProjectBill",
      companyEmail: null,
      companyLogoUrl: null,
      companyAddress: null,
      senderEmail: null,
    };
  }
}

export async function loadProviderConfig(
  organizationId: string
): Promise<{ providerId: string; config: Record<string, string> }> {
  const settings = await prisma.settings.findFirst({
    where: { organizationId },
  });

  const providerId = settings?.emailProvider || "resend";

  const rows = await prisma.emailProviderConfig.findMany({
    where: { organizationId, providerId },
  });

  const config: Record<string, string> = {};
  for (const row of rows) {
    config[row.key] = row.isEncrypted ? decrypt(row.value) : row.value;
  }

  // Fallback: if no rows in new table but old resendApiKey exists
  if (Object.keys(config).length === 0 && settings?.resendApiKey) {
    config.apiKey = decrypt(settings.resendApiKey);
  }

  return { providerId, config };
}

function getSenderFrom(companyName: string, senderEmail?: string | null): string {
  if (senderEmail && senderEmail.trim() !== "") {
    return `${companyName} <${senderEmail.trim()}>`;
  }
  return `${companyName} <noreply@projectbill.mrndev.me>`;
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

  const { providerId, config } = await loadProviderConfig(params.organizationId!);
  const provider = providerRegistry.createProvider(providerId, config);

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

    const result = await provider.send({
      from: getSenderFrom(settings.companyName, settings.senderEmail),
      to: [params.to],
      subject,
      html,
    });

    if (!result.success) {
      console.error(`[EMAIL] ${provider.name} error:`, result.error);
      return { success: false, error: result.error };
    }

    if (params.organizationId) {
      const { incrementOrgUsage } = await import("@/lib/billing/subscription");
      await incrementOrgUsage(params.organizationId, "emailsSent");
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("[EMAIL] Provider error:", error);
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

  const { providerId, config } = await loadProviderConfig(params.organizationId!);
  const provider = providerRegistry.createProvider(providerId, config);

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

    const result = await provider.send({
      from: getSenderFrom(settings.companyName, settings.senderEmail),
      to: [params.to],
      subject,
      html,
    });

    if (!result.success) {
      console.error(`[EMAIL] ${provider.name} error:`, result.error);
      return { success: false, error: result.error };
    }

    if (params.organizationId) {
      const { incrementOrgUsage } = await import("@/lib/billing/subscription");
      await incrementOrgUsage(params.organizationId, "emailsSent");
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("[EMAIL] Provider error:", error);
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

  const { providerId, config } = await loadProviderConfig(params.organizationId!);
  const provider = providerRegistry.createProvider(providerId, config);

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

    const result = await provider.send({
      from: getSenderFrom(settings.companyName, settings.senderEmail),
      to: [params.to],
      subject,
      html,
    });

    if (!result.success) {
      console.error(`[EMAIL] ${provider.name} error:`, result.error);
      return { success: false, error: result.error };
    }

    if (params.organizationId) {
      const { incrementOrgUsage } = await import("@/lib/billing/subscription");
      await incrementOrgUsage(params.organizationId, "emailsSent");
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("[EMAIL] Provider error:", error);
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

  const { providerId, config } = await loadProviderConfig(params.organizationId!);
  const provider = providerRegistry.createProvider(providerId, config);

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
    console.log(`[EMAIL] Attempting to send payment success email from: ${from} to: ${params.to}`);

    const result = await provider.send({
      from,
      to: [params.to],
      subject,
      html,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (!result.success) {
      console.error(`[EMAIL] ${provider.name} error:`, result.error);
      return { success: false, error: result.error };
    }

    if (params.organizationId) {
      const { incrementOrgUsage } = await import("@/lib/billing/subscription");
      await incrementOrgUsage(params.organizationId, "emailsSent");
    }

    return { success: true, data: result };
  } catch (error) {
    console.error("[EMAIL] Provider error:", error);
    return { success: false, error };
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
  const { providerId, config } = await loadProviderConfig(params.organizationId);
  const provider = providerRegistry.createProvider(providerId, config);

  try {
    const result = await provider.send({
      from: getSenderFrom(settings.companyName, settings.senderEmail),
      to: [params.to],
      subject: `You've been invited to join ${params.orgName}`,
      html,
    });
    if (!result.success) {
      console.error(`[EMAIL] ${provider.name} error:`, result.error);
      return { success: false, error: result.error };
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to send invite email:", error);
    return { success: false, error };
  }
}

export async function sendOrgDeletionEmail(params: { to: string; orgName: string; organizationId: string }) {
  const html = `<div style="font-family:sans-serif;padding:20px">
    <h2>Organization Deletion Notice</h2>
    <p>The organization <strong>${params.orgName}</strong> has been scheduled for deletion by its owner.</p>
    <p>All data will be permanently deleted after 30 days. If you believe this was a mistake, please contact the organization owner immediately.</p>
  </div>`;

  const settings = await getCompanySettings(params.organizationId);
  const { providerId, config } = await loadProviderConfig(params.organizationId);
  const provider = providerRegistry.createProvider(providerId, config);

  try {
    const result = await provider.send({
      from: getSenderFrom(settings.companyName, settings.senderEmail),
      to: [params.to],
      subject: `Organization Deletion - ${params.orgName}`,
      html,
    });
    if (!result.success) {
      console.error(`[EMAIL] ${provider.name} error:`, result.error);
      return { success: false, error: result.error };
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to send deletion email:", error);
    return { success: false, error };
  }
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
  const { providerId, config } = await loadProviderConfig(params.organizationId);
  const provider = providerRegistry.createProvider(providerId, config);

  try {
    const result = await provider.send({
      from: getSenderFrom(settings.companyName, settings.senderEmail),
      to: [params.to],
      subject: `Data Export Ready - ${params.orgName}`,
      html,
    });
    if (!result.success) {
      console.error(`[EMAIL] ${provider.name} error:`, result.error);
      return { success: false, error: result.error };
    }
    return { success: true };
  } catch (error) {
    console.error("Failed to send export email:", error);
    return { success: false, error };
  }
}
