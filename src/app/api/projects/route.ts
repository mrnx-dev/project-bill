import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withTenantRls, getTenantCtx } from "@/lib/rls";
import { createAuditLog } from "@/lib/audit-logger";
import { projectSchema } from "@/lib/validations";

export const GET = withTenantRls(async (request: Request, _ctx, tx) => {
  try {
    const ctx = getTenantCtx()!;
    const orgId = ctx.organizationId;

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const pageParam = searchParams.get("page");

    const args: Prisma.ProjectFindManyArgs = {
      where: { organizationId: orgId },
      include: { client: true, invoices: true, items: true },
      orderBy: { createdAt: "desc" },
    };

    if (limitParam && pageParam) {
      const limit = parseInt(limitParam, 10);
      const page = parseInt(pageParam, 10);
      args.skip = (page - 1) * limit;
      args.take = limit;

      const total = await tx.project.count({ where: { organizationId: orgId } });
      const projects = await tx.project.findMany(args);

      return NextResponse.json({
        data: projects,
        meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    }

    const projects = await tx.project.findMany(args);
    return NextResponse.json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 },
    );
  }
});

export const POST = withTenantRls(async (request: Request, _ctx, tx) => {
  try {
    const ctx = getTenantCtx()!;
    const orgId = ctx.organizationId;
    const userId = ctx.userId;

    let json;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const validation = projectSchema.safeParse(json);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const data = validation.data;

    const { checkOrgLimit } = await import("@/lib/billing/subscription");
    const limitCheck = await checkOrgLimit(orgId, "activeProjects");
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: "Plan limit reached", limitCheck },
        { status: 403 }
      );
    }

    let totalPrice = data.totalPrice;
    if (data.items && data.items.length > 0) {
      totalPrice = data.items.reduce((acc, item) => acc + item.price, 0);
    }

    const projectData: Prisma.ProjectUncheckedCreateInput = {
      title: data.title,
      clientId: data.clientId,
      totalPrice,
      dpAmount: data.dpAmount ?? null,
      billingMode: data.billingMode ?? "SIMPLE",
      currency: data.currency,
      language: data.language,
      deadline: data.deadline ? new Date(data.deadline) : null,
      status: "TO_DO",
      organizationId: orgId,
    };

    projectData.terms = data.terms ?? null;
    projectData.taxName = data.taxName ?? null;
    projectData.taxRate = data.taxRate ?? null;

    if (data.items && data.items.length > 0) {
      projectData.items = {
        create: data.items.map((i) => ({
          description: i.description,
          price: i.price,
          quantity: i.quantity ?? null,
          rate: i.rate ?? null,
          organizationId: orgId,
        })),
      };
    }

    const project = await tx.project.create({
      data: projectData,
      include: { client: true, invoices: true, items: true },
    });

    await createAuditLog({
      userId,
      action: "project.create",
      entityType: "PROJECT",
      entityId: project.id,
      newValue: data.title,
      organizationId: orgId,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error("Failed to create project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
});