import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashToken, signSession, COOKIE_NAME } from "@/lib/client-auth";

export async function GET(request: Request) {
  const t = new URL(request.url).searchParams.get("t");
  const loginUrl = new URL("/portal/login", request.url);
  if (!t) return NextResponse.redirect(loginUrl + "?error=invalid_or_expired");

  // Token-only lookup by hash is deliberately unscoped (hash is high-entropy).
  const auth = await prisma.clientAuth.findFirst({
    where: { magicLinkTokenHash: hashToken(t) },
  });
  if (!auth) return NextResponse.redirect(loginUrl + "?error=invalid_or_expired");

  // Atomic single-use consume: every validity condition lives in the WHERE, so
  // a parallel request on the same token can win the row update only once.
  const now = new Date();
  const consume = await prisma.clientAuth.updateMany({
    where: {
      id: auth.id,
      magicLinkTokenHash: hashToken(t),
      magicLinkUsedAt: null,
      magicLinkExpiresAt: { gt: now },
    },
    data: { magicLinkUsedAt: now, magicLinkTokenHash: null },
  });
  if (consume.count !== 1) {
    // Lost the race, expired, or reused — identical response either way.
    return NextResponse.redirect(loginUrl + "?error=invalid_or_expired");
  }

  // Set signed session cookie (30-day rolling TTL) from the winner's row.
  const signed = signSession({
    clientId: auth.clientId,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    sessionVersion: auth.sessionVersion,
  });
  (await cookies()).set(COOKIE_NAME, signed, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return NextResponse.redirect(new URL("/portal", request.url));
}
