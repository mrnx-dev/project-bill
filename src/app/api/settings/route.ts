import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    // We enforce a single config row with id = "global"
    let settings = await prisma.settings.findUnique({
      where: { id: "global" },
    });

    // If it doesn't exist, create default
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: "global",
          companyName: "ProjectBill Consulting",
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error("Failed to fetch settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const body = await req.json();

    // Update the global settings
    const settings = await prisma.settings.update({
      where: { id: "global" },
      data: {
        companyName: body.companyName,
        companyAddress: body.companyAddress,
        companyEmail: body.companyEmail,
        companyLogoUrl: body.companyLogoUrl,
      },
    });

    return NextResponse.json(settings);
  } catch (error: any) {
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
