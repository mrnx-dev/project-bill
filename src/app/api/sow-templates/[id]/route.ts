import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

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

        const template = await prisma.sOWTemplate.update({
            where: {
                id: id,
            },
            data: {
                name,
                content,
            },
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

        return NextResponse.json(template);
    } catch (error) {
        console.error("[SOW_TEMPLATE_DELETE]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}
