import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { createAuditLog } from "@/lib/audit-logger";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const json = await request.json();
    const {
      title,
      clientId,
      totalPrice,
      dpAmount,
      status,
      currency,
      language,
      deadline,
      terms,
      taxName,
      taxRate,
    } = json;

    const updateData: Prisma.ProjectUncheckedUpdateInput = {};
    if (title !== undefined) updateData.title = title;
    if (clientId !== undefined) updateData.clientId = clientId;
    if (totalPrice !== undefined)
      updateData.totalPrice = parseFloat(totalPrice);
    if (dpAmount !== undefined)
      updateData.dpAmount = dpAmount ? parseFloat(dpAmount) : null;
    if (status !== undefined) updateData.status = status;
    if (currency !== undefined) updateData.currency = currency;
    if (language !== undefined) updateData.language = language;
    if (deadline !== undefined)
      updateData.deadline = deadline ? new Date(deadline) : null;
    if (terms !== undefined) updateData.terms = terms ? terms : null;
    if (taxName !== undefined) updateData.taxName = taxName ? taxName : null;
    if (taxRate !== undefined) updateData.taxRate = taxRate !== null ? parseFloat(taxRate) : null;

    const existing = await prisma.project.findUnique({
      where: { id },
      include: { invoices: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Phase 4.1: Lock Entire Project (except status) if SOW is signed
    if (existing.termsAcceptedAt) {
      // Allow only status changes if signed
      const isTryingToChangeCoreFields =
        (updateData.title !== undefined && updateData.title !== existing.title) ||
        (updateData.clientId !== undefined && updateData.clientId !== existing.clientId) ||
        (updateData.totalPrice !== undefined && updateData.totalPrice !== Number(existing.totalPrice)) ||
        (updateData.dpAmount !== undefined && updateData.dpAmount !== (existing.dpAmount ? Number(existing.dpAmount) : null)) ||
        (updateData.currency !== undefined && updateData.currency !== existing.currency) ||
        (updateData.language !== undefined && updateData.language !== existing.language) ||
        (deadline !== undefined && (deadline ? new Date(deadline).getTime() : null) !== existing.deadline?.getTime()) ||
        (updateData.terms !== undefined && updateData.terms !== existing.terms) ||
        (updateData.taxName !== undefined && updateData.taxName !== existing.taxName) ||
        (updateData.taxRate !== undefined && updateData.taxRate !== (existing.taxRate ? Number(existing.taxRate) : null));

      if (isTryingToChangeCoreFields) {
        return NextResponse.json(
          { error: "Cannot modify project details because the SOW has been signed." },
          { status: 403 },
        );
      }
    }

    // Phase 4.2: Lock Financial Fields due to generated invoices
    if (existing.invoices.length > 0) {
      const isFinanciallyModified =
        (updateData.totalPrice !== undefined && updateData.totalPrice !== Number(existing.totalPrice)) ||
        (updateData.dpAmount !== undefined && updateData.dpAmount !== (existing.dpAmount ? Number(existing.dpAmount) : null)) ||
        (updateData.currency !== undefined && updateData.currency !== existing.currency) ||
        (updateData.taxName !== undefined && updateData.taxName !== existing.taxName) ||
        (updateData.taxRate !== undefined && updateData.taxRate !== (existing.taxRate ? Number(existing.taxRate) : null));

      if (isFinanciallyModified) {
        return NextResponse.json(
          { error: "Cannot modify financial fields (Price, DP, Currency, Tax). Invoices have already been generated for this project." },
          { status: 403 },
        );
      }
    }

    // Validate DP does not exceed totalPrice
    if (
      updateData.totalPrice !== undefined ||
      updateData.dpAmount !== undefined
    ) {
      const effectiveTotal =
        updateData.totalPrice ?? Number(existing.totalPrice);
      const effectiveDp =
        updateData.dpAmount !== undefined
          ? updateData.dpAmount
          : existing.dpAmount
            ? Number(existing.dpAmount)
            : null;
      if (effectiveDp !== null && effectiveDp > effectiveTotal) {
        return NextResponse.json(
          { error: "DP amount cannot exceed total price" },
          { status: 400 },
        );
      }
    }
    
    // Phase 4.3: Subscription Limit Check for Reactivation
    // If the project was "DONE" and is now being moved to an active state, check limit.
    if (existing.status === "DONE" && status !== undefined && status !== "DONE") {
        const { checkLimit } = await import("@/lib/billing/subscription");
        const limitCheck = await checkLimit(session.user.id, "activeProjects");
        if (!limitCheck.allowed) {
            return NextResponse.json(
                { error: "Cannot reactivate project. Active projects limit reached.", limitCheck },
                { status: 403 }
            );
        }
    }

    const project = await prisma.project.update({
      where: { id },
      data: updateData,
      include: { client: true, invoices: true },
    });

    await createAuditLog({
      userId: session.user.id,
      action: "project.update",
      entityType: "PROJECT",
      entityId: id,
      oldValue: existing.title,
      newValue: title || existing.title,
    });

    return NextResponse.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session) return new NextResponse("Unauthorized", { status: 401 });
    const resolvedParams = await params;
    const id = resolvedParams.id;

    // Check for unpaid invoices
    const project = await prisma.project.findUnique({
      where: { id },
      include: { invoices: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const hasUnpaidInvoices = project.invoices.some(
      (inv) => inv.status === "UNPAID",
    );
    if (hasUnpaidInvoices) {
      return NextResponse.json(
        {
          error:
            "Cannot delete project with unpaid invoices. Please resolve all invoices first.",
        },
        { status: 403 },
      );
    }

    await prisma.$transaction([
      // Delete child invoices first to satisfy the Restricted foreign key
      prisma.invoice.deleteMany({
        where: { projectId: id },
      }),
      // Then delete the project
      prisma.project.delete({
        where: { id },
      }),
    ]);

    await createAuditLog({
      userId: session.user.id,
      action: "project.delete",
      entityType: "PROJECT",
      entityId: id,
      oldValue: project.title,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 },
    );
  }
}
