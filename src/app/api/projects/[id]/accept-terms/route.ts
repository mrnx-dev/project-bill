import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit-logger";
import { createNotification } from "@/lib/notifications";
import { RateLimiter } from "@/lib/rate-limit";

const limiter = new RateLimiter({ limit: 60, windowMs: 60_000 });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    // This is a public endpoint deliberately accessible without auth,
    // intended for the client viewing their invoice link.
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
    if (!limiter.check(ip).success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { invoiceId } = await request.json().catch(() => ({}));
    if (!invoiceId) {
      return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
    }
    // The invoice UUID is the link that was actually shared; the project id alone must not
    // be enough to sign (old links, exports, screenshots).
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { projectId: true },
    });
    if (!invoice || invoice.projectId !== id) {
      return NextResponse.json({ error: "Invoice does not match project" }, { status: 403 });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      select: { terms: true, termsAcceptedAt: true, termsVersionId: true, updatedAt: true, organizationId: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.terms) {
      return NextResponse.json(
        { error: "This project has no terms to accept" },
        { status: 400 },
      );
    }

    if (project.termsAcceptedAt) {
      return NextResponse.json(
        { error: "Terms have already been accepted" },
        { status: 400 },
      );
    }

    const userAgent = request.headers.get("user-agent") || "Unknown Browser";
    const sessionId = crypto.randomUUID(); // Requires `import crypto from "crypto";` at top or use global crypto if Node >= 19

    // Calculate next version
    const nextVersion = (project.termsVersionId || 0) + 1;

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        termsAcceptedAt: new Date(),
        termsAcceptedUserAgent: userAgent,
        termsAcceptedSessionId: sessionId,
        termsVersionId: nextVersion,
      },
    });

    try {
      await createAuditLog({
        userId: "system_client", // since this is a public unauthenticated route
        organizationId: project.organizationId,
        action: "ACCEPT_SOW",
        entityType: "PROJECT",
        entityId: id,
        newValue: JSON.stringify({ version: nextVersion, userAgent, ip: "recorded_via_cloudflare_headers_if_available" }),
      });

      // Fetch project minimal title for notification
      const p = await prisma.project.findUnique({ where: { id }, select: { title: true } });
      await createNotification({
        title: "SOW Signed",
        message: `Client accepted SOW for project "${p?.title}".`,
        type: "sow_signed",
        linkUrl: `/projects`,
        organizationId: project.organizationId,
      });
    } catch (e) {
      console.error(e);
    }

    return NextResponse.json({
      success: true,
      termsAcceptedAt: updatedProject.termsAcceptedAt,
    });
  } catch (error) {
    console.error("Failed to accept project terms:", error);
    return NextResponse.json(
      { error: "Failed to accept terms" },
      { status: 500 },
    );
  }
}
