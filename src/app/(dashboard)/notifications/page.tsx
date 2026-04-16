import { prisma } from "@/lib/prisma";
import { NotificationsClient } from "./notifications-client";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect("/login");
  }

  // Admin lock
  if (session.user.role !== "ADMIN") {
     return (
        <div className="flex flex-col items-center justify-center p-8 gap-4 mt-12">
            <h2 className="text-2xl font-bold tracking-tight text-red-500">Access Denied</h2>
            <p className="text-muted-foreground text-center max-w-md">
               You do not have the required administrative permissions to view settings.
            </p>
        </div>
     )
  }

  // Pre-fetch first page of notifications for fast initial load
  const [notificationsRaw, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.notification.count(),
    prisma.notification.count({ where: { isRead: false } }),
  ]);

  // Serialize dates for client
  const initialData = notificationsRaw.map((notif) => ({
    ...notif,
    title: notif.title,
    message: notif.message,
    type: notif.type,
    isRead: notif.isRead,
    linkUrl: notif.linkUrl,
    createdAt: notif.createdAt.toISOString(),
    updatedAt: notif.updatedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Notifications</h1>
          <p className="text-muted-foreground mt-2">
            View the complete history of system events, payments, and document signatures.
          </p>
        </div>
      </div>

      <NotificationsClient 
        initialData={initialData} 
        total={total} 
        initialUnreadCount={unreadCount} 
      />
    </div>
  );
}
