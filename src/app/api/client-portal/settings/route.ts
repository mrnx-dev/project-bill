import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyClientJWT } from "@/lib/client-jwt";

export async function GET(request: NextRequest) {
  try {
    const cookie = request.cookies.get("client_session");
    if (!cookie?.value) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const payload = await verifyClientJWT(cookie.value);
    if (!payload) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const settings = await prisma.settings.findFirst({
      where: { organizationId: payload.organizationId },
    });

    return NextResponse.json({
      companyName: settings?.companyName || "ProjectBill",
      companyLogoUrl: settings?.companyLogoUrl || null,
    });
  } catch (error) {
    console.error("Failed to fetch client settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}
