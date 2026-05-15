import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";
import { encrypt, decrypt, maskSecret, isMaskedValue } from "@/lib/crypto";

const SENSITIVE_FIELDS = ["resendApiKey", "mayarApiKey", "mayarWebhookSecret"] as const;

export async function GET() {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    if (session.user.activeOrganizationRole !== "OWNER") return new NextResponse("Forbidden", { status: 403 });

    const orgId = session.user.activeOrganizationId!;

    let settings = await prisma.settings.findFirst({
      where: {},
    });

    if (!settings) {
      settings = await prisma.settings.create({
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
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    if (session.user.activeOrganizationRole !== "OWNER") return new NextResponse("Forbidden", { status: 403 });

    const orgId = session.user.activeOrganizationId!;
    const body = await req.json();

    const currentSettings = await prisma.settings.findFirst({
      where: {},
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
