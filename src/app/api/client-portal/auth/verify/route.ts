import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashToken, signSession, COOKIE_NAME } from "@/lib/client-auth";

export async function GET(request: Request) {
  const t = new URL(request.url).searchParams.get("t");
  const loginUrl = new URL("/portal/login", request.url);
  if (!t) return NextResponse.redirect(loginUrl + "?error=invalid_or_expired");

  // Token-only verify: hash the incoming token, find the ClientAuth by hash.
  const auth = await prisma.clientAuth.findFirst({
    where: { magicLinkTokenHash: hashToken(t) },
  });

  const now = new Date();
  const valid =
    auth &&
    auth.magicLinkExpiresAt &&
    auth.magicLinkExpiresAt > now &&
    auth.magicLinkUsedAt === null;

  if (!valid) {
    return NextResponse.redirect(loginUrl + "?error=invalid_or_expired");
  }

  const target = auth!;
  // Single-use: mark used + clear hash atomically.
  await prisma.clientAuth.update({
    where: { id: target.id },
    data: { magicLinkUsedAt: now, magicLinkTokenHash: null },
  });

  // Set signed session cookie (30-day rolling TTL).
  const signed = signSession({
    clientId: target.clientId,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    sessionVersion: target.sessionVersion,
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
