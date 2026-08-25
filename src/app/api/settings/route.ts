import { NextResponse } from "next/server";
import { withTenantRls, getTenantCtx } from "@/lib/rls";
import { createAuditLog } from "@/lib/audit-logger";
import { encrypt, decrypt, maskSecret, isMaskedValue } from "@/lib/crypto";

const SENSITIVE_FIELDS = ["resendApiKey", "mayarApiKey", "mayarWebhookSecret"] as const;

export const GET = withTenantRls(async (_req, _ctx, tx) => {
  try {
    const tenant = getTenantCtx()!;
    if (tenant.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
    const orgId = tenant.organizationId;
    let settings = await tx.settings.findFirst({
      where: { organizationId: orgId },
    });

    if (!settings) {
      settings = await tx.settings.create({
        data: { companyName: "ProjectBill", organizationId: orgId },
      });
    }

    const response = {
      ...settings,
      resendApiKey: maskSecret(settings.resendApiKey ? decrypt(settings.resendApiKey) : null),
      mayarApiKey: maskSecret(settings.mayarApiKey ? decrypt(settings.mayarApiKey) : null),
      mayarWebhookSecret: maskSecret(settings.mayarWebhookSecret ? decrypt(settings.mayarWebhookSecret) : null),
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
});

export const PUT = withTenantRls(async (req, _ctx, tx) => {
  try {
    const tenant = getTenantCtx()!;
    if (tenant.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
    const orgId = tenant.organizationId;
    const userId = tenant.userId;
    const body = await req.json();

    const currentSettings = await tx.settings.findFirst({
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
      settings = await tx.settings.update({
        where: { id: currentSettings.id },
        data: dataToUpdate,
      });
    } else {
      settings = await tx.settings.create({
        data: {
          ...dataToUpdate,
          companyName: (dataToUpdate.companyName as string) || "ProjectBill",
          organizationId: orgId,
        } as any,
      });
    }

    if (auditEntries.length > 0) {
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
      resendApiKey: maskSecret(settings.resendApiKey ? decrypt(settings.resendApiKey) : null),
      mayarApiKey: maskSecret(settings.mayarApiKey ? decrypt(settings.mayarApiKey) : null),
      mayarWebhookSecret: maskSecret(settings.mayarWebhookSecret ? decrypt(settings.mayarWebhookSecret) : null),
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
  }
});