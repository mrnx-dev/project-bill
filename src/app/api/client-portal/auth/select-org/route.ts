import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyClientJWT, signClientJWT } from "@/lib/client-jwt";
import { rlsContext } from "@/lib/rls";

export async function POST(request: NextRequest) {
  try {
    const { token, organizationId } = await request.json();

    if (!token || !organizationId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const auth = await prisma.clientAuth.findFirst({
      where: {
        token,
        organizationId,
        tokenExpiresAt: { gt: new Date() },
        usedAt: null,
      },
    });

    if (!auth) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    await prisma.clientAuth.update({
      where: { id: auth.id },
      data: { usedAt: new Date() },
    });

    const jwt = await signClientJWT({
      clientId: auth.clientId,
      email: auth.email,
      organizationId: auth.organizationId,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set("client_session", jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
    });
    return response;
  } catch (error) {
    console.error("Failed to select org:", error);
    return NextResponse.json({ error: "Failed to select organization" }, { status: 500 });
  }
}
