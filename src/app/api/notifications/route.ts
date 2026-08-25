import { NextResponse } from "next/server";
import { withTenantRls, getTenantCtx } from "@/lib/rls";

export const GET = withTenantRls(async (req, _ctx, tx) => {
  try {
    const ctx = getTenantCtx()!;
    const orgId = ctx.organizationId;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      tx.notification.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      tx.notification.count({ where: { organizationId: orgId } }),
      tx.notification.count({ where: { isRead: false, organizationId: orgId } }),
    ]);

    return NextResponse.json({
      data: notifications,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      unreadCount,
    });
  } catch (error) {
    console.error("[NOTIFICATIONS_GET_ERROR]", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
});

export const PATCH = withTenantRls(async (req, _ctx, tx) => {
  try {
    const ctx = getTenantCtx()!;
    const orgId = ctx.organizationId;

    const body = await req.json();
    const { id, markAll } = body;

    if (markAll) {
      await tx.notification.updateMany({
        where: { isRead: false, organizationId: orgId },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true, message: "All notifications marked as read" });
    }

    if (!id) {
      return NextResponse.json({ error: "Missing notification ID" }, { status: 400 });
    }

    const notification = await tx.notification.update({
      where: { id, organizationId: orgId },
      data: { isRead: true },
    });

    return NextResponse.json(notification);
  } catch (error) {
    console.error("[NOTIFICATIONS_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
});