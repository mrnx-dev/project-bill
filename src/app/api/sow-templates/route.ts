import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";
import { requireOrgRole, AuthError } from "@/lib/auth/org-rbac";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const orgId = session.user.activeOrganizationId!;

        const templates = await prisma.sOWTemplate.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(templates);
    } catch (error) {
        console.error("[SOW_TEMPLATES_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }
        const { organizationId } = await requireOrgRole(session, ["OWNER", "ADMIN"]);
        const body = await req.json();
        const { name, content } = body;

        if (!name || !content) {
            return new NextResponse("Name and content are required", { status: 400 });
        }

        const { checkOrgLimit } = await import("@/lib/billing/subscription");
        const limitCheck = await checkOrgLimit(organizationId, "sowTemplates");
        if (!limitCheck.allowed) {
            return NextResponse.json(
                { error: "Plan limit reached", limitCheck },
                { status: 403 }
            );
        }

        const template = await prisma.sOWTemplate.create({
            data: { name, content, organizationId },
        });

        await createAuditLog({
            userId: session.user.id,
            action: "sow_template.create",
            entityType: "SOW_TEMPLATE",
            entityId: template.id,
            newValue: name,
            organizationId,
        });

        return NextResponse.json(template);
    } catch (error) {
        if (error instanceof AuthError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
        console.error("[SOW_TEMPLATES_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}