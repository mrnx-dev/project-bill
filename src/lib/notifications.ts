import { prisma } from "@/lib/prisma";
import { dispatchEvent } from "./event-emitter";

export type NotificationType = "payment" | "sow_signed" | "system";

interface CreateNotificationParams {
  title: string;
  message: string;
  type: NotificationType;
  linkUrl?: string;
}

export async function createNotification({
  title,
  message,
  type,
  linkUrl,
}: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type,
        linkUrl,
      },
    });

    // Notify any active SSE listeners that a new notification occurred
    await dispatchEvent("system_events", {
      type: "notification_created",
      data: notification,
    });

    return notification;
  } catch (error) {
    console.error("[NOTIFICATIONS] Error creating notification:", error);
    // We don't want a notification failure to break the main flow (e.g. webhook)
    return null;
  }
}
