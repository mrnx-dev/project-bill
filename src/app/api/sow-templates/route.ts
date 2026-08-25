import { NextResponse } from "next/server";
import { withTenantRls, getTenantCtx } from "@/lib/rls";
import { createAuditLog } from "@/lib/audit-logger";

export const GET = withTenantRls(async (_req, _ctx, tx) => {
    try {
        const ctx = getTenantCtx()!;
        const orgId = ctx.organizationId;

        const templates = await tx.sOWTemplate.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(templates);
    } catch (error) {
        console.error("[SOW_TEMPLATES_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
});

export const POST = withTenantRls(async (req, _ctx, tx) => {
    try {
        const ctx = getTenantCtx()!;
        const orgId = ctx.organizationId;
        const userId = ctx.userId;
        const body = await req.json();
        const { name, content } = body;

        if (!name || !content) {
            return new NextResponse("Name and content are required", { status: 400 });
        }

        const { checkOrgLimit } = await import("@/lib/billing/subscription");
        const limitCheck = await checkOrgLimit(orgId, "sowTemplates");
        if (!limitCheck.allowed) {
            return NextResponse.json(
                { error: "Plan limit reached", limitCheck },
                { status: 403 }
            );
        }

        const template = await tx.sOWTemplate.create({
            data: { name, content, organizationId: orgId },
        });

        await createAuditLog({
            userId,
            action: "sow_template.create",
            entityType: "SOW_TEMPLATE",
            entityId: template.id,
            newValue: name,
            organizationId: orgId,
        });

        return NextResponse.json(template);
    } catch (error) {
        console.error("[SOW_TEMPLATES_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
});