import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireOrgRole, AuthError } from "@/lib/auth/org-rbac";
import { providerRegistry } from "@/lib/email/providers/registry";
import { loadProviderConfig, getCompanySettings, getSenderFrom } from "@/lib/email-config";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const { organizationId } = await requireOrgRole(session, ['OWNER', 'ADMIN']);

    // Read optional `to` from body. Default: session user email.
    let { to } = await req.json().catch(() => ({}) as any);
    to = to || session.user.email;
    if (!to) return NextResponse.json({ error: "No recipient email" }, { status: 400 });

    // Rate limit: 3 per 5 min
    const now = Date.now();
    const limitKey = organizationId;
    const current = rateLimitMap.get(limitKey);
    if (current && current.resetAt > now && current.count >= 3) {
      return NextResponse.json(
        { error: "Rate limited. Max 3 tests per 5 minutes." },
        { status: 429 }
      );
    }
    if (!current || current.resetAt <= now) {
      rateLimitMap.set(limitKey, { count: 1, resetAt: now + 5 * 60 * 1000 });
    } else {
      current.count++;
    }

    const { providerId, config } = await loadProviderConfig(organizationId);
    const provider = providerRegistry.createProvider(providerId, config);

    const settings = await getCompanySettings(organizationId);
    const from = getSenderFrom(settings.companyName, settings.senderEmail);

    const result = await provider.send({
      to,
      from,
      subject: "Test Email — ProjectBill",
      html: `<p>This is a test email from ProjectBill using ${provider.name}.</p><p>If you received this, your email provider is configured correctly.</p>`,
    });

    return NextResponse.json({
      success: result.success,
      messageId: result.messageId,
      provider: providerId,
      error: result.error,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return new NextResponse(error.message, { status: error.statusCode });
    }
    console.error("Failed to send test email:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}