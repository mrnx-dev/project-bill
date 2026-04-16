import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { encrypt, decrypt, maskSecret, isMaskedValue } from "@/lib/crypto";

// Fields that contain sensitive API keys
const SENSITIVE_FIELDS = ["resendApiKey", "mayarApiKey", "mayarWebhookSecret"] as const;
type SensitiveField = typeof SENSITIVE_FIELDS[number];

export async function GET() {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
    // We enforce a single config row with id = "global"
    let settings = await prisma.settings.findUnique({
      where: { id: "global" },
    });

    // If it doesn't exist, create default
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: "global",
          companyName: "ProjectBill",
        },
      });
    }

    // Decrypt and mask sensitive fields before sending to the client
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
    if (session.user.role !== "ADMIN") return new NextResponse("Forbidden", { status: 403 });
    const body = await req.json();

    const parsedBody = body as {
      companyName: string;
      companyAddress?: string | null;
      companyEmail?: string | null;
      senderEmail?: string | null;
      companyLogoUrl?: string | null;
      companyWhatsApp?: string | null;
      resendApiKey?: string | null;
      mayarApiKey?: string | null;
      mayarWebhookSecret?: string | null;
      bankName?: string | null;
      bankAccountName?: string | null;
      bankAccountNumber?: string | null;
    };

    // Fetch current settings to compare for audit log
    const currentSettings = await prisma.settings.findUnique({
      where: { id: "global" },
    });

    // Build the data object, handling encryption for sensitive fields
    const dataToUpdate: Record<string, string | null | undefined> = {
      companyName: parsedBody.companyName,
      companyAddress: parsedBody.companyAddress,
      companyEmail: parsedBody.companyEmail,
      senderEmail: parsedBody.senderEmail,
      companyLogoUrl: parsedBody.companyLogoUrl,
      companyWhatsApp: parsedBody.companyWhatsApp,
      bankName: parsedBody.bankName,
      bankAccountName: parsedBody.bankAccountName,
      bankAccountNumber: parsedBody.bankAccountNumber,
    };

    // Process sensitive fields: skip if masked (unchanged), encrypt if new value
    const auditEntries: { field: string; oldValue: string | null; newValue: string | null }[] = [];

    for (const field of SENSITIVE_FIELDS) {
      const newValue = parsedBody[field];
      const currentEncryptedValue = currentSettings?.[field] ?? null;

      if (newValue === undefined || (typeof newValue === "string" && isMaskedValue(newValue))) {
        // User didn't change this field — keep existing value
        // Don't include in dataToUpdate, so Prisma won't touch it
        continue;
      }

      if (newValue === null || newValue.trim() === "") {
        dataToUpdate[field] = null;
        const oldDecrypted = currentEncryptedValue ? decrypt(currentEncryptedValue) : null;
        if (oldDecrypted) {
          auditEntries.push({
            field,
            oldValue: maskSecret(oldDecrypted),
            newValue: null,
          });
        }
        continue;
      }

      // User provided a new plaintext key — encrypt it
      const encryptedNewValue = encrypt(newValue);
      dataToUpdate[field] = encryptedNewValue;

      // Build audit log entry
      const oldDecrypted = currentEncryptedValue ? decrypt(currentEncryptedValue) : null;
      auditEntries.push({
        field,
        oldValue: maskSecret(oldDecrypted),
        newValue: maskSecret(newValue),
      });
    }

    const settings = await prisma.settings.upsert({
      where: { id: "global" },
      update: dataToUpdate,
      create: {
        id: "global",
        ...dataToUpdate,
        companyName: dataToUpdate.companyName as string || "ProjectBill",
      } as any,
    });

    // Write audit log entries for sensitive field changes
    const userId = session.user?.id || session.user?.email || "unknown";

    if (auditEntries.length > 0) {
      const { createAuditLog } = await import("@/lib/audit-logger");
      for (const entry of auditEntries) {
        await createAuditLog({
          userId,
          action: "settings.update",
          entityType: "SETTINGS",
          entityId: "global",
          field: entry.field,
          oldValue: entry.oldValue ?? undefined,
          newValue: entry.newValue ?? undefined,
        });
      }
    }

    // Also log a general settings update for non-sensitive field changes
    const nonSensitiveChanged = currentSettings && (
      currentSettings.companyName !== parsedBody.companyName ||
      currentSettings.companyAddress !== (parsedBody.companyAddress ?? null) ||
      currentSettings.companyEmail !== (parsedBody.companyEmail ?? null) ||
      currentSettings.bankName !== (parsedBody.bankName ?? null)
    );

    if (nonSensitiveChanged) {
      const { createAuditLog } = await import("@/lib/audit-logger");
      await createAuditLog({
        userId,
        action: "settings.update",
        entityType: "SETTINGS",
        entityId: "global",
        oldValue: currentSettings.companyName,
        newValue: parsedBody.companyName,
      });
    }

    // Return masked response
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
