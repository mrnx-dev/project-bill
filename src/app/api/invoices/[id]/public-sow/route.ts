import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RateLimiter } from "@/lib/rate-limit";

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

        // Select only the fields the SOW print page consumes (client-side fetch
        // at src/app/(public)/invoices/[id]/sow/print/page.tsx:52). The audit-
        // trail fields (termsAccepted*) are part of the SOW document itself, not
        // a leak; the leak we are closing is the full `client` object.
        const invoice = await prisma.invoice.findUnique({
            where: { id },
            select: {
                id: true,
                project: {
                    select: {
                        id: true,
                        title: true,
                        terms: true,
                        language: true,
                        termsAcceptedAt: true,
                        termsAcceptedUserAgent: true,
                        termsAcceptedSessionId: true,
                        client: { select: { name: true } },
                    },
                },
            },
        });

        if (!invoice) {
            return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }

        const project = invoice.project;

        if (!project?.terms) {
            return NextResponse.json(
                { error: "This project has no terms" },
                { status: 400 },
            );
        }

        return NextResponse.json(project);
    } catch (error) {
        console.error("Failed to fetch public SOW via invoice:", error);
        return NextResponse.json(
            { error: "Failed to fetch project SOW" },
            { status: 500 },
        );
    }
}
