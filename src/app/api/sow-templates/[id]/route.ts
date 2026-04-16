import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";

export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const template = await prisma.sOWTemplate.findUnique({
            where: {
                id: id,
            },
        });

        if (!template) {
            return new NextResponse("Not Found", { status: 404 });
        }

        return NextResponse.json(template);
    } catch (error) {
        console.error("[SOW_TEMPLATE_GET]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function PUT(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const body = await req.json();
        const { name, content } = body;

        const existing = await prisma.sOWTemplate.findUnique({ where: { id } });

        const template = await prisma.sOWTemplate.update({
            where: {
                id: id,
            },
            data: {
                name,
                content,
            },
        });

        await createAuditLog({
            userId: session.user.id,
            action: "sow_template.update",
            entityType: "SOW_TEMPLATE",
            entityId: id,
            oldValue: existing?.name || undefined,
            newValue: name,
        });

        return NextResponse.json(template);
    } catch (error) {
        console.error("[SOW_TEMPLATE_PUT]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const template = await prisma.sOWTemplate.delete({
            where: {
                id: id,
            },
        });

        await createAuditLog({
            userId: session.user.id,
            action: "sow_template.delete",
            entityType: "SOW_TEMPLATE",
            entityId: id,
            oldValue: template.name,
        });

        return NextResponse.json(template);
    } catch (error) {
        console.error("[SOW_TEMPLATE_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
