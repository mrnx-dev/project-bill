import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { providerRegistry } from "@/lib/email/providers/registry";
import { loadProviderConfig, getCompanySettings, getSenderFrom } from "@/lib/email-config";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (session.user.activeOrganizationRole !== "OWNER")
    return new NextResponse("Forbidden", { status: 403 });

  const orgId = session.user.activeOrganizationId!;

  // Read optional `to` from body. Default: session user email.
  let { to } = await req.json().catch(() => ({}) as any);
  to = to || session.user.email;
  if (!to) return NextResponse.json({ error: "No recipient email" }, { status: 400 });

  // Rate limit: 3 per 5 min
  const now = Date.now();
  const limitKey = orgId;
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

  const { providerId, config } = await loadProviderConfig(orgId);
  const provider = providerRegistry.createProvider(providerId, config);

  const settings = await getCompanySettings(orgId);
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
}
