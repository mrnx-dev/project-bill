"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { Bell, Check, Loader2, BellRing, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS } from "date-fns/locale";
import { getBrowserLocale } from "@/lib/i18n";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { NotificationType } from "@/lib/notifications";

// Local types
interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  linkUrl: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  data: Notification[];
  meta: any;
  unreadCount: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [currentLocale, setCurrentLocale] = useState(enUS);

  useEffect(() => {
    setCurrentLocale(getBrowserLocale());
  }, []);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const knownNotificationIds = useRef<Set<string>>(new Set());
  const isInitialLoad = useRef(true);

  const { data, error, isLoading, mutate } = useSWR<NotificationsResponse>(
    "/api/notifications?limit=10",
    fetcher
  );

  useEffect(() => {
    if (data?.data) {
      const newNotifications = data.data;
      
      // If not initial load, check for new unread notifications
      if (!isInitialLoad.current) {
        newNotifications.forEach((notification) => {
          if (!notification.isRead && !knownNotificationIds.current.has(notification.id)) {
            // New unread notification! Show toast
            toast(notification.title, {
              description: notification.message,
              action: notification.linkUrl ? {
                label: "View",
                onClick: () => {
                  if (!notification.isRead) markAsRead(notification.id);
                  router.push(notification.linkUrl!);
                }
              } : undefined,
            });
          }
        });
      }

      // Update known IDs
      newNotifications.forEach(n => knownNotificationIds.current.add(n.id));
      setNotifications(newNotifications);
      setUnreadCount(data.unreadCount);
      isInitialLoad.current = false;
    }
  }, [data, mutate, router]);

  // Listen to Server-Sent Events (SSE) for Real-Time Updates
  useEffect(() => {
    const eventSource = new EventSource("/api/events");

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "notification_created") {
          // Re-fetch notifications since a new one arrived
          mutate();
        }
      } catch (e) {
        // Ignored unparseable JSON or heartbeat
      }
    };

    return () => {
      eventSource.close();
    };
  }, [mutate]);

  const markAsRead = async (id?: string) => {
    try {
      // Optimistic update
      mutate(
        (currentData) => {
          if (!currentData) return currentData;
          return {
            ...currentData,
            unreadCount: id ? Math.max(0, currentData.unreadCount - 1) : 0,
            data: currentData.data.map((n) =>
              !id || n.id === id ? { ...n, isRead: true } : n
            ),
          };
        },
        false // Do not revalidate immediately
      );

      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { markAll: true }),
      });

      // Revalidate to ensure sync
      mutate();
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    setIsOpen(false);
    if (notification.linkUrl) {
      router.push(notification.linkUrl);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group">
          <Bell className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] rounded-full border-2 border-background"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAsRead()}
            >
              <Check className="mr-1 h-3 w-3" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[400px] max-h-[60vh]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <p className="text-sm">Loading notifications...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-40 text-sm text-destructive">
              Failed to load notifications
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
                <BellRing className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">
                You have no new notifications.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "flex flex-col gap-1 p-4 cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-0",
                    !notification.isRead && "bg-primary/5"
                  )}
                >
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-sm leading-none flex items-center gap-2">
                        {!notification.isRead && (
                          <span className="h-2 w-2 rounded-full bg-primary" />
                        )}
                        {notification.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                          locale: currentLocale
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {notification.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="p-2 border-t text-center">
          <Button variant="ghost" className="w-full text-xs text-muted-foreground" asChild onClick={() => setIsOpen(false)}>
            <Link href="/notifications">
              View all notifications
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
