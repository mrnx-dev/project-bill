import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const resolvedParams = await params;
        const id = resolvedParams.id;

        const invoice = await prisma.invoice.findUnique({
            where: { id },
            include: {
                project: {
                    include: { client: true },
                }
            }
        });

        if (!invoice || !invoice.project) {
            return NextResponse.json({ error: "Project or Invoice not found" }, { status: 404 });
        }

        const project = invoice.project;

        if (!project.terms) {
            return NextResponse.json(
                { error: "This project has no terms" },
                { status: 400 },
            );
        }

        return NextResponse.json(project);
    } catch (error) {
        console.error("Failed to fetch public SOW:", error);
        return NextResponse.json(
            { error: "Failed to fetch project SOW" },
            { status: 500 },
        );
    }
}
