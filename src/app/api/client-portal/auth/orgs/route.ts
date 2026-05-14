import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get("email");
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Find all unexpired, unused ClientAuth records for this email
    const auths = await prisma.clientAuth.findMany({
      where: {
        email,
        tokenExpiresAt: { gt: new Date() },
        usedAt: null,
      },
      select: { organizationId: true, clientId: true },
    });

    if (auths.length === 0) {
      return NextResponse.json({ orgs: [] });
    }

    // Get org names from settings
    const settings = await prisma.settings.findMany({
      where: {
        organizationId: { in: auths.map((a) => a.organizationId) },
      },
      select: { organizationId: true, companyName: true },
    });

    const settingsMap = new Map(settings.map((s) => [s.organizationId, s.companyName]));

    return NextResponse.json({
      orgs: auths.map((a) => ({
        organizationId: a.organizationId,
        companyName: settingsMap.get(a.organizationId) || "Unknown Org",
      })),
    });
  } catch (error) {
    console.error("Failed to list orgs:", error);
    return NextResponse.json({ error: "Failed to list organizations" }, { status: 500 });
  }
}
