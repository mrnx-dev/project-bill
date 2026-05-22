import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireOrgRole, AuthError } from "@/lib/auth/org-rbac";

export async function GET(
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

    const job = await prisma.exportJob.findFirst({
      where: { organizationId: id },
      orderBy: { createdAt: "desc" },
    });

    if (!job) return NextResponse.json({ status: null });

    return NextResponse.json({
      status: job.status,
      downloadUrl: job.downloadUrl,
      completedAt: job.completedAt,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Export status error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}