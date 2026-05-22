import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireOrgRole, AuthError } from "@/lib/auth/org-rbac";
import crypto from "crypto";
import { sendExportReadyEmail } from "@/lib/email";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const { organizationId } = await requireOrgRole(session, "OWNER");

    // Verify the route param matches the user's active organization
    if (id !== organizationId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existingJob = await prisma.exportJob.findFirst({
      where: { organizationId: id, status: "PROCESSING" },
    });
    if (existingJob) {
      return NextResponse.json({ error: "An export is already in progress" }, { status: 409 });
    }

    const job = await prisma.exportJob.create({
      data: { organizationId: id, status: "PROCESSING", requestedBy: session.user.id },
    });

    const userEmail = session.user.email!;

    (async () => {
      try {
        const [org, clients, projects, invoices, templates, recurring, logs] = await Promise.all([
          prisma.organization.findUnique({ where: { id } }),
          prisma.client.findMany({ where: { organizationId: id } }),
          prisma.project.findMany({ where: { organizationId: id }, include: { items: true } }),
          prisma.invoice.findMany({ where: { organizationId: id } }),
          prisma.sOWTemplate.findMany({ where: { organizationId: id }, select: { id: true, name: true, content: true } }),
          prisma.recurringInvoice.findMany({ where: { organizationId: id } }),
          prisma.auditLog.findMany({ where: { organizationId: id }, take: 200, orderBy: { createdAt: "desc" } }),
        ]);

        const downloadToken = crypto.randomBytes(16).toString("hex");
        const downloadUrl = `/api/organizations/${id}/export/download?token=${downloadToken}`;

        await prisma.exportJob.update({
          where: { id: job.id },
          data: { status: "COMPLETED", downloadUrl, completedAt: new Date() },
        });

        sendExportReadyEmail({
          to: userEmail,
          orgName: org?.name || "Unknown",
          downloadUrl,
          organizationId: id,
        }).catch(console.error);
      } catch (err) {
        console.error("Export failed:", err);
        await prisma.exportJob.update({
          where: { id: job.id },
          data: { status: "FAILED" },
        });
      }
    })();

    return NextResponse.json({ jobId: job.id, status: "PROCESSING" }, { status: 202 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to start export:", error);
    return NextResponse.json({ error: "Failed to start export" }, { status: 500 });
  }
}