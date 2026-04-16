import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const pageParam = searchParams.get("page");

    const args: Prisma.ClientFindManyArgs = {
      where: { isArchived: false },
      orderBy: { createdAt: "desc" },
    };

    if (limitParam && pageParam) {
      const limit = parseInt(limitParam, 10);
      const page = parseInt(pageParam, 10);
      args.skip = (page - 1) * limit;
      args.take = limit;

      const total = await prisma.client.count({ where: { isArchived: false } });
      const clients = await prisma.client.findMany(args);

      return NextResponse.json({
        data: clients,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    }

    const clients = await prisma.client.findMany(args);
    return NextResponse.json(clients);
  } catch (error) {
    console.error("Failed to sequence clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const json = await request.json();
    const { name, email, phone } = json;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // --- Subscription Gate Check ---
    const { checkLimit } = await import("@/lib/billing/subscription");
    const limitCheck = await checkLimit(session.user.id, "clients");
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: "Plan limit reached", limitCheck },
        { status: 403 }
      );
    }
    // -------------------------------

    const client = await prisma.client.create({
      data: { name, email, phone },
    });

    await createAuditLog({
      userId: session.user.id,
      action: "client.create",
      entityType: "CLIENT",
      entityId: client.id,
      newValue: name,
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("Failed to create client:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 },
    );
  }
}
