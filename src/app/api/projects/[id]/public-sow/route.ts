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
        const id = resolvedParams.id;

        // No in-repo consumer found for this endpoint; select the same minimal
        // field set as the invoice variant for consistency (audit-trail fields
        // included since a SOW document is incomplete without them).
        const project = await prisma.project.findUnique({
            where: { id },
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
        });

        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }

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
