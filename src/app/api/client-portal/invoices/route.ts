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

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: payload.organizationId,
        project: { clientId: payload.clientId },
      },
      include: { project: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount.toString(),
        status: inv.status,
        dueDate: inv.dueDate,
        projectTitle: inv.project.title,
        paymentLink: inv.paymentLink,
        type: inv.type,
      })),
    });
  } catch (error) {
    console.error("Failed to fetch client invoices:", error);
    return NextResponse.json({ error: "Failed to fetch invoices" }, { status: 500 });
  }
}
