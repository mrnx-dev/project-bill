import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withTenantRls, getTenantCtx } from "@/lib/rls";
import { createAuditLog } from "@/lib/audit-logger";

export const GET = withTenantRls(async (request: Request, _ctx, tx) => {
  try {
    const ctx = getTenantCtx()!;
    const orgId = ctx.organizationId;

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const pageParam = searchParams.get("page");

    const args: Prisma.ClientFindManyArgs = {
      where: { isArchived: false, organizationId: orgId },
      orderBy: { createdAt: "desc" },
    };

    if (limitParam && pageParam) {
      const limit = parseInt(limitParam, 10);
      const page = parseInt(pageParam, 10);
      args.skip = (page - 1) * limit;
      args.take = limit;

      const total = await tx.client.count({
        where: { isArchived: false, organizationId: orgId },
      });
      const clients = await tx.client.findMany(args);

      return NextResponse.json({
        data: clients,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    }

    const clients = await tx.client.findMany(args);
    return NextResponse.json(clients);
  } catch (error) {
    console.error("Failed to sequence clients:", error);
    return NextResponse.json(
      { error: "Failed to fetch clients" },
      { status: 500 },
    );
  }
});

export const POST = withTenantRls(async (request: Request, _ctx, tx) => {
  try {
    const ctx = getTenantCtx()!;
    const orgId = ctx.organizationId;
    const userId = ctx.userId;

    const json = await request.json();
    const { name, email, phone } = json;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const { checkOrgLimit } = await import("@/lib/billing/subscription");
    const limitCheck = await checkOrgLimit(orgId, "clients");
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: "Plan limit reached", limitCheck },
        { status: 403 }
      );
    }

    const client = await tx.client.create({
      data: { name, email, phone, organizationId: orgId },
    });

    await createAuditLog({
      userId,
      action: "client.create",
      entityType: "CLIENT",
      entityId: client.id,
      newValue: name,
      organizationId: orgId,
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    console.error("Failed to create client:", error);
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 },
    );
  }
});