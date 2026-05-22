import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.user.activeOrganizationId!;
    const userId = session.user.id;

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;

    const userScopeFilter = { organizationId: orgId, OR: [{ userId: userId }, { userId: null }] };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: userScopeFilter,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: userScopeFilter }),
      prisma.notification.count({ where: { isRead: false, ...userScopeFilter } }),
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
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = session.user.activeOrganizationId!;
    const userId = session.user.id;

    const userScopeFilter = { organizationId: orgId, OR: [{ userId: userId }, { userId: null }] };

    const body = await req.json();
    const { id, markAll } = body;

    if (markAll) {
      await prisma.notification.updateMany({
        where: { isRead: false, ...userScopeFilter },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true, message: "All notifications marked as read" });
    }

    if (!id) {
      return NextResponse.json({ error: "Missing notification ID" }, { status: 400 });
    }

    const { count } = await prisma.notification.updateMany({
      where: { id, ...userScopeFilter },
      data: { isRead: true },
    });

    if (count === 0) {
      return NextResponse.json({ error: "Notification not found or not accessible" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[NOTIFICATIONS_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
  }
}
