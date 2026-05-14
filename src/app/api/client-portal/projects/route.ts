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

    const projects = await prisma.project.findMany({
      where: {
        clientId: payload.clientId,
        organizationId: payload.organizationId,
      },
      include: {
        invoices: { select: { status: true, amount: true } },
        milestones: { select: { status: true, percentage: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      projects: projects.map((p) => {
        const paidAmount = p.invoices
          .filter((i) => i.status === "PAID")
          .reduce((sum, i) => sum + Number(i.amount), 0);

        const milestoneProgress =
          p.milestones.length > 0
            ? p.milestones
                .filter((m) => m.status === "PAID")
                .reduce((sum, m) => sum + Number(m.percentage), 0)
            : null;

        return {
          id: p.id,
          title: p.title,
          status: p.status,
          totalPrice: p.totalPrice.toString(),
          paidAmount: paidAmount.toString(),
          currency: p.currency,
          deadline: p.deadline,
          milestoneProgress,
        };
      }),
    });
  } catch (error) {
    console.error("Failed to fetch client projects:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}
