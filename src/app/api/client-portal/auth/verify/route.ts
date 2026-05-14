import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signClientJWT } from "@/lib/client-jwt";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.redirect(new URL("/client/login?error=missing", request.url));
    }

    // Find all unexpired, unused ClientAuth records for this token
    const auths = await prisma.clientAuth.findMany({
      where: {
        token,
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
      // Single org — set cookie and redirect to dashboard
      const auth = auths[0];

      await prisma.clientAuth.update({
        where: { id: auth.id },
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

    // Multiple orgs — return org list as JSON for select-org page
    const orgSettings = await prisma.settings.findMany({
      where: {
        organizationId: { in: auths.map((a) => a.organizationId) },
      },
      select: { organizationId: true, companyName: true },
    });

    const settingsMap = new Map(
      orgSettings.map((s) => [s.organizationId, s.companyName]),
    );

    return NextResponse.json({
      orgs: auths.map((a) => ({
        organizationId: a.organizationId,
        companyName: settingsMap.get(a.organizationId) || "Unknown Org",
      })),
    });
  } catch (error) {
    console.error("Failed to verify magic link:", error);
    return NextResponse.redirect(
      new URL("/client/login?error=server", new URL(request.url).origin),
    );
  }
}
