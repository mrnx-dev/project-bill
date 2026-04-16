import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const templates = await prisma.sOWTemplate.findMany({
            orderBy: {
                createdAt: 'desc'
            }
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

        const body = await req.json();
        const { name, content } = body;

        if (!name || !content) {
            return new NextResponse("Name and content are required", { status: 400 });
        }

        // --- Subscription Gate Check ---
        const { checkLimit } = await import("@/lib/billing/subscription");
        const limitCheck = await checkLimit(session.user.id, "sowTemplates");
        if (!limitCheck.allowed) {
            return NextResponse.json(
                { error: "Plan limit reached", limitCheck },
                { status: 403 }
            );
        }
        // -------------------------------

        const template = await prisma.sOWTemplate.create({
            data: {
                name,
                content,
            },
        });

        await createAuditLog({
            userId: session.user.id,
            action: "sow_template.create",
            entityType: "SOW_TEMPLATE",
            entityId: template.id,
            newValue: name,
        });

        return NextResponse.json(template);
    } catch (error) {
        console.error("[SOW_TEMPLATES_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
