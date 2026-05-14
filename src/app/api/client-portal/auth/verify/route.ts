import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signClientJWT } from "@/lib/client-jwt";

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get("email");
    if (!email) {
      return NextResponse.redirect(new URL("/client/login?error=missing", request.url));
    }

    // Find all unexpired, unused ClientAuth records for this email
    const auths = await prisma.clientAuth.findMany({
      where: {
        email,
        tokenExpiresAt: { gt: new Date() },
        usedAt: null,
      },
      include: { client: { select: { id: true, name: true, email: true } } },
    });

    if (auths.length === 0) {
      return NextResponse.redirect(
        new URL("/client/login?error=expired", request.url),
      );
    }

    const baseUrl = process.env.APP_URL || "http://localhost:3000";

    if (auths.length === 1) {
      // Single org — mark all tokens as used, set cookie and redirect
      const auth = auths[0];
      await prisma.clientAuth.updateMany({
        where: { email, tokenExpiresAt: { gt: new Date() }, usedAt: null },
        data: { usedAt: new Date() },
      });

      const jwt = await signClientJWT({
        clientId: auth.clientId,
        email: auth.email,
        organizationId: auth.organizationId,
      });

      const response = NextResponse.redirect(new URL("/client/dashboard", baseUrl));
      response.cookies.set("client_session", jwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 86400,
        path: "/",
      });
      return response;
    }

    // Multiple orgs — redirect to org selector
    const response = NextResponse.redirect(
      new URL(`/client/select-org?email=${encodeURIComponent(email)}`, baseUrl),
    );
    return response;
  } catch (error) {
    console.error("Failed to verify magic link:", error);
    return NextResponse.redirect(
      new URL("/client/login?error=server", new URL(request.url).origin),
    );
  }
}
