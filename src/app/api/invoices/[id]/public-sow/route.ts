import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RateLimiter } from "@/lib/rate-limit";
import { toContractDocumentProps } from "@/lib/contract-document-mapper";

// Public endpoint (no session) — IP rate limit to curb UUID enumeration.
const limiter = new RateLimiter({ limit: 60, windowMs: 60 * 1000 });

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    const rl = limiter.check(ip);
    if (!rl.success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    try {
        const resolvedParams = await params;
        const id = resolvedParams.id; // invoice id

        const invoice = await prisma.invoice.findUnique({
            where: { id },
            select: {
                organizationId: true,
                project: {
                    include: {
                        items: {
                            select: { description: true, quantity: true, rate: true, price: true },
                        },
                        milestones: {
                            orderBy: { order: "asc" },
                            select: { name: true, percentage: true, amount: true, dueDate: true },
                        },
                        client: { select: { name: true, email: true, phone: true } },
                    },
                },
            },
        });

        if (!invoice) {
            return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }

        const { project } = invoice;

        if (!project?.terms) {
            return NextResponse.json(
                { error: "This project has no terms" },
                { status: 400 },
            );
        }

        const settings = await prisma.settings.findFirst({
            where: { organizationId: invoice.organizationId },
            select: {
                companyName: true,
                companyAddress: true,
                companyEmail: true,
                companyWhatsApp: true,
            },
        });

        // Explicit allow-list via the mapper: the only place Decimal/Date become number/string.
        // Built as a literal object — never select-wide + rest-destructure, which silently leaks
        // the next column somebody adds.
        return NextResponse.json(
            toContractDocumentProps({
                // After the terms guard, terms is non-null but keeps its type; assert it.
                project: { ...project, terms: project.terms },
                provider: settings ?? {
                    companyName: null, companyAddress: null, companyEmail: null, companyWhatsApp: null,
                },
            }),
        );
    } catch (error) {
        console.error("Failed to fetch public SOW via invoice:", error);
        return NextResponse.json(
            { error: "Failed to fetch project SOW" },
            { status: 500 },
        );
    }
}
