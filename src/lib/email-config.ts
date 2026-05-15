import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { providerRegistry } from "./providers/registry";

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
    config[row.key] = (row.isEncrypted ? decrypt(row.value) : row.value) ?? "";
  }

  // Fallback: if no rows in new table but old resendApiKey exists
  if (Object.keys(config).length === 0 && settings?.resendApiKey) {
    config.apiKey = decrypt(settings.resendApiKey) ?? "";
  }

  return { providerId, config };
}

export interface CompanySettings {
  companyName: string;
  companyEmail: string | null;
  companyLogoUrl: string | null;
  companyAddress: string | null;
  senderEmail: string | null;
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

export function getSenderFrom(companyName: string, senderEmail?: string | null): string {
  if (senderEmail && senderEmail.trim() !== "") {
    return `${companyName} <${senderEmail.trim()}>`;
  }
  return `${companyName} <noreply@projectbill.mrndev.me>`;
}
