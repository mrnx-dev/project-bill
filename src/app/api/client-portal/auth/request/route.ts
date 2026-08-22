import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken, hashToken } from "@/lib/client-auth";
import { sendMagicLinkEmail } from "@/lib/email";
import { RateLimiter } from "@/lib/rate-limit";

// Public endpoint (no session) — intentionally bypasses RLS to find clients
// by email across orgs. Returns nothing to the caller (always 200).
const limiter = new RateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });

export async function POST(request: Request) {
  // Rate-limit per IP (curb enumeration/spam)
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  if (!limiter.check(ip).success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let email: string | undefined;
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  // findMany by email across orgs (no session → no RLS context → unscoped, intentional)
  const clients = await prisma.client.findMany({
    where: { email, isArchived: false },
    select: { id: true, name: true, email: true, isArchived: true, organizationId: true, organization: { select: { name: true } } },
  }).catch(() => []);

  const eligible = clients.filter((c) => c.email && !c.isArchived);
  if (eligible.length === 0) {
    // Anti-enumeration: still 200, do nothing.
    return NextResponse.json({ ok: true });
  }

  const baseUrl = process.env.APP_URL || "http://localhost:3000";
  const fifteenMin = 15 * 60 * 1000;
  const links: { orgName: string; url: string }[] = [];

  for (const c of eligible) {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + fifteenMin);
    await prisma.clientAuth.upsert({
      where: { clientId: c.id },
      create: {
        clientId: c.id,
        organizationId: c.organizationId,
        magicLinkTokenHash: hashToken(token),
        magicLinkExpiresAt: expiresAt,
        magicLinkUsedAt: null,
      },
      update: {
        organizationId: c.organizationId,
        magicLinkTokenHash: hashToken(token),
        magicLinkExpiresAt: expiresAt,
        magicLinkUsedAt: null,
      },
    });
    links.push({
      orgName: c.organization?.name ?? "ProjectBill",
      url: `${baseUrl}/api/client-portal/auth/verify?t=${token}`,
    });
  }

  // v1: sender = first matching client's org (single-org self-hosted: the org).
  await sendMagicLinkEmail({
    to: email,
    clientName: eligible[0].name,
    links,
    organizationId: eligible[0].organizationId,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
