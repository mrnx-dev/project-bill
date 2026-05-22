import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { generateInvoiceNumber } from "@/lib/invoice-utils";
import { createAuditLog } from "@/lib/audit-logger";
import { requireOrgRole, AuthError } from "@/lib/auth/org-rbac";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; milestoneId: string }> },
) {
  try {
    const session = await auth();
    const { organizationId } = await requireOrgRole(session, ["OWNER", "ADMIN"]);

    const { id: projectId, milestoneId } = await params;

    const milestone = await prisma.paymentMilestone.findFirst({
      where: { id: milestoneId, projectId, organizationId },
      include: { project: { select: { title: true } } },
    });

    if (!milestone) {
      return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
    }

    if (milestone.status !== "PENDING") {
      return NextResponse.json(
        { error: `Cannot approve milestone in ${milestone.status} status` },
        { status: 400 },
      );
    }

    // Auto-generate invoice
    const invoiceNumber = await generateInvoiceNumber(organizationId);
    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + 7);

    // Generate Mayar payment link if configured
    let paymentLink: string | null = null;
    let paymentId: string | null = null;
    try {
      const settings = await prisma.settings.findFirst({
        where: { organizationId },
        select: { mayarApiKey: true },
      });
      if (settings?.mayarApiKey) {
        const { decrypt } = await import("@/lib/crypto");
        const apiKey = decrypt(settings.mayarApiKey);
        if (apiKey) {
          const res = await fetch("https://api.mayar.id/api/v1/payment-link", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              name: `${milestone.project.title} — ${milestone.name}`,
              amount: Number(milestone.amount),
              redirectUrl: `${process.env.APP_URL || "http://localhost:3000"}/client/invoices`,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            paymentLink = data.link || data.paymentLink || null;
            paymentId = data.id || null;
          }
        }
      }
    } catch (e) {
      console.warn("Mayar payment link generation failed (non-fatal):", e);
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        projectId,
        type: "MILESTONE",
        amount: milestone.amount,
        notes: `${milestone.project.title} — Milestone: ${milestone.name}`,
        dueDate: milestone.dueDate || defaultDueDate,
        status: "unpaid",
        paymentLink,
        paymentId,
        organizationId,
      },
    });

    const updated = await prisma.paymentMilestone.update({
      where: { id: milestoneId, organizationId },
      data: {
        status: "INVOICED",
        invoiceId: invoice.id,
      },
      include: { invoice: true },
    });

    await createAuditLog({
      userId: session.user.id,
      action: "milestone.approve",
      entityType: "MILESTONE",
      entityId: milestoneId,
      newValue: `Approved → Invoice ${invoiceNumber}`,
      organizationId,
    });

    return NextResponse.json({ milestone: updated, invoice });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Failed to approve milestone:", error);
    return NextResponse.json({ error: "Failed to approve milestone" }, { status: 500 });
  }
}