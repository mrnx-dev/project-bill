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
    // We enforce a single config row with id = "global"
    let settings = await prisma.settings.findUnique({
      where: { id: "global" },
    });

    // If it doesn't exist, create default
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: "global",
          companyName: "ProjectBill Consulting",
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
    const body = await req.json();

    const parsedBody = body as {
      companyName: string;
      companyAddress?: string | null;
      companyEmail?: string | null;
      companyLogoUrl?: string | null;
      companyWhatsApp?: string | null;
      resendApiKey?: string | null;
      mayarApiKey?: string | null;
      mayarWebhookSecret?: string | null;
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
      companyLogoUrl: parsedBody.companyLogoUrl,
      companyWhatsApp: parsedBody.companyWhatsApp,
    };

    // Process sensitive fields: skip if masked (unchanged), encrypt if new value
    const auditEntries: { field: string; oldValue: string | null; newValue: string | null }[] = [];

    for (const field of SENSITIVE_FIELDS) {
      const newValue = parsedBody[field];
      const currentEncryptedValue = currentSettings?.[field] ?? null;

      if (!newValue || isMaskedValue(newValue)) {
        // User didn't change this field — keep existing value
        // Don't include in dataToUpdate, so Prisma won't touch it
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

    const settings = await prisma.settings.update({
      where: { id: "global" },
      data: dataToUpdate,
    });

    // Write audit log entries
    if (auditEntries.length > 0) {
      const userId = session.user?.id || session.user?.email || "unknown";
      await prisma.auditLog.createMany({
        data: auditEntries.map((entry) => ({
          userId,
          action: "settings.update",
          field: entry.field,
          oldValue: entry.oldValue,
          newValue: entry.newValue,
        })),
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
