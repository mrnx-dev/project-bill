import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";
import { createNotification } from "@/lib/notifications";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const orgId = session.user.activeOrganizationId!;

    const project = await prisma.project.findUnique({
      where: { id, organizationId: orgId },
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
      where: { id, organizationId: orgId },
      data: {
        termsAcceptedAt: new Date(),
        termsAcceptedUserAgent: userAgent,
        termsAcceptedSessionId: sessionId,
        termsVersionId: nextVersion,
      },
    });

    try {
      await createAuditLog({
        userId: session.user.id || "system_client",
        organizationId: project.organizationId,
        action: "ACCEPT_SOW",
        entityType: "PROJECT",
        entityId: id,
        newValue: JSON.stringify({ version: nextVersion, userAgent, ip: "recorded_via_cloudflare_headers_if_available" }),
      });

      // Fetch project minimal title for notification
      const p = await prisma.project.findUnique({ where: { id, organizationId: orgId }, select: { title: true } });
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
