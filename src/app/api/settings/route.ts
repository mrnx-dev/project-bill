import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";
import { encrypt, decrypt, maskSecret, isMaskedValue } from "@/lib/crypto";
import { providerRegistry } from "@/lib/email/providers/registry";
import { getSenderFrom, loadProviderConfig } from "@/lib/email-config";

const SENSITIVE_FIELDS = ["resendApiKey", "mayarApiKey", "mayarWebhookSecret"] as const;

export async function GET() {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    if (session.user.activeOrganizationRole !== "OWNER") return new NextResponse("Forbidden", { status: 403 });

    const orgId = session.user.activeOrganizationId!;

    let settings = await prisma.settings.findFirst({
      where: { organizationId: orgId },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: { companyName: "ProjectBill", organizationId: orgId },
      });
    }

    const providerConfigs = await prisma.emailProviderConfig.findMany({
      where: { organizationId: orgId },
    });

    const providerConfig: Record<string, Record<string, string>> = {};
    for (const row of providerConfigs) {
      if (!providerConfig[row.providerId]) providerConfig[row.providerId] = {};
      const manifest = providerRegistry.getById(row.providerId);
      const field = manifest?.fields.find((f) => f.id === row.key);
      const isSensitive =
        field?.type === "password" || /password|secret|key/i.test(row.key);
      providerConfig[row.providerId][row.key] = isSensitive
        ? maskSecret(row.isEncrypted ? decrypt(row.value) : row.value)
        : row.value;
    }

    const response = {
      ...settings,
      emailProvider: settings.emailProvider,
      providerConfig,
      // Legacy flat fields. TODO v1.4: remove once clients use nested providerConfig
      resendApiKey: maskSecret(settings.resendApiKey ? decrypt(settings.resendApiKey) : null),
      mayarApiKey: maskSecret(settings.mayarApiKey ? decrypt(settings.mayarApiKey) : null),
      mayarWebhookSecret: maskSecret(settings.mayarWebhookSecret ? decrypt(settings.mayarWebhookSecret) : null),
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    if (session.user.activeOrganizationRole !== "OWNER") return new NextResponse("Forbidden", { status: 403 });

    const orgId = session.user.activeOrganizationId!;
    const body = await req.json();

    const currentSettings = await prisma.settings.findFirst({
      where: { organizationId: orgId },
    });

    const dataToUpdate: Record<string, string | null | undefined> = {
      companyName: body.companyName,
      companyAddress: body.companyAddress,
      companyEmail: body.companyEmail,
      senderEmail: body.senderEmail,
      companyLogoUrl: body.companyLogoUrl,
      companyWhatsApp: body.companyWhatsApp,
      bankName: body.bankName,
      bankAccountName: body.bankAccountName,
      bankAccountNumber: body.bankAccountNumber,
    };

    const auditEntries: { field: string; oldValue: string | null; newValue: string | null }[] = [];

    // Handle emailProvider change with audit log
    if (body.emailProvider !== undefined && body.emailProvider !== currentSettings?.emailProvider) {
      await createAuditLog({
        userId: session.user?.id || session.user?.email || "unknown",
        action: "settings.update",
        entityType: "SETTINGS",
        entityId: currentSettings?.id || "new",
        field: "emailProvider",
        oldValue: currentSettings?.emailProvider || "resend",
        newValue: body.emailProvider,
        organizationId: orgId,
      });
      dataToUpdate.emailProvider = body.emailProvider;
    }

    for (const field of SENSITIVE_FIELDS) {
      const newValue = body[field];
      const currentEncryptedValue = currentSettings?.[field] ?? null;

      if (newValue === undefined || (typeof newValue === "string" && isMaskedValue(newValue))) {
        continue;
      }

      if (newValue === null || newValue.trim() === "") {
        dataToUpdate[field] = null;
        const oldDecrypted = currentEncryptedValue ? decrypt(currentEncryptedValue) : null;
        if (oldDecrypted) {
          auditEntries.push({ field, oldValue: maskSecret(oldDecrypted), newValue: null });
        }
        continue;
      }

      const encryptedNewValue = encrypt(newValue);
      dataToUpdate[field] = encryptedNewValue;

      const oldDecrypted = currentEncryptedValue ? decrypt(currentEncryptedValue) : null;
      auditEntries.push({ field, oldValue: maskSecret(oldDecrypted), newValue: maskSecret(newValue) });
    }

    let settings: any;
    if (currentSettings?.id) {
      settings = await prisma.settings.update({
        where: { id: currentSettings.id },
        data: dataToUpdate,
      });
    } else {
      settings = await prisma.settings.create({
        data: {
          ...dataToUpdate,
          companyName: (dataToUpdate.companyName as string) || "ProjectBill",
          organizationId: orgId,
        } as any,
      });
    }

    const userId = session.user?.id || session.user?.email || "unknown";

    // Save provider configs
    if (body.providerConfig && typeof body.providerConfig === "object") {
      for (const [providerId, configObj] of Object.entries(body.providerConfig)) {
        const manifest = providerRegistry.getById(providerId);
        if (!manifest) continue;

        for (const [key, rawValue] of Object.entries(configObj as Record<string, string>)) {
          if (rawValue === undefined || isMaskedValue(rawValue)) continue;

          const field = manifest.fields.find((f) => f.id === key);
          const isSensitive = field?.type === "password" || /password|secret|key/i.test(key);

          const valueToSave =
            rawValue === null || rawValue.trim() === ""
              ? null
              : isSensitive
              ? encrypt(rawValue)
              : rawValue;

          await prisma.emailProviderConfig.upsert({
            where: {
              organizationId_providerId_key: {
                organizationId: orgId,
                providerId,
                key,
              },
            },
            update: {
              value: valueToSave,
              isEncrypted: isSensitive,
            },
            create: {
              organizationId: orgId,
              providerId,
              key,
              value: valueToSave,
              isEncrypted: isSensitive,
            },
          });
        }
      }
    }

    if (auditEntries.length > 0) {
      const { createAuditLog } = await import("@/lib/audit-logger");
      for (const entry of auditEntries) {
        await createAuditLog({
          userId,
          action: "settings.update",
          entityType: "SETTINGS",
          entityId: settings.id,
          field: entry.field,
          oldValue: entry.oldValue ?? undefined,
          newValue: entry.newValue ?? undefined,
          organizationId: orgId,
        });
      }
    }

    const response = {
      ...settings,
      emailProvider: settings.emailProvider,
      providerConfig: {}, // re-fetch would be more accurate but acceptable
      resendApiKey: maskSecret(settings.resendApiKey ? decrypt(settings.resendApiKey) : null),
      mayarApiKey: maskSecret(settings.mayarApiKey ? decrypt(settings.mayarApiKey) : null),
      mayarWebhookSecret: maskSecret(settings.mayarWebhookSecret ? decrypt(settings.mayarWebhookSecret) : null),
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
}
