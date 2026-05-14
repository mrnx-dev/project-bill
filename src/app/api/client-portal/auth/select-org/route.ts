import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { signClientJWT } from "@/lib/client-jwt";

export async function POST(request: NextRequest) {
  try {
    const { email, organizationId } = await request.json();

    if (!email || !organizationId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // Find the active token for this email+org
    await prisma.clientAuth.updateMany({
      where: {
        email,
        organizationId,
        tokenExpiresAt: { gt: new Date() },
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    // Sign JWT and set cookie
    const client = await prisma.client.findFirst({
      where: { email, organizationId, isArchived: false },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const jwt = await signClientJWT({
      clientId: client.id,
      email,
      organizationId,
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
