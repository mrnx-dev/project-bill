"use client";

import { formatEnum, isEnumLike } from "@/lib/utils";
import { formatMoney } from "@/lib/currency";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  FileText,
  CreditCard,
  Settings,
  ShieldCheck,
  Trash2,
  Plus,
  Edit,
  RefreshCw,
  Activity,
  Users,
  FolderKanban,
  FileCheck,
} from "lucide-react";

// Helper to pretty-print raw JSON values in the log
function formatLogValue(val: string | null | undefined): string | null {
  if (!val) return null;

  try {
    const parsed = JSON.parse(val);
    if (typeof parsed === "object" && parsed !== null) {
      const currencyFields = ["price", "totalPrice", "amount", "dpAmount", "rate"];
      const enumFields = ["type", "status", "role", "frequency"];
      const displayObj = { ...parsed };
      const defaultCurrency = displayObj.currency || "IDR";

      const lines = Object.entries(displayObj).map(([k, v]) => {
        let displayVal = String(v);
        if (typeof v === 'string') {
          // Format specific enum fields or strings that look like enums
          if (enumFields.includes(k) || isEnumLike(v)) {
            displayVal = formatEnum(v);
          }
        }
        
        if (currencyFields.includes(k) && v !== null && !isNaN(Number(v))) {
          displayVal = formatMoney(Number(v), defaultCurrency);
        }

        // Clean output without literal keys for intuitive fields
        if (k === "type" || k === "amount" || k === "status" || k === "price" || k === "totalPrice") {
          return `${displayVal}`;
        }

        return `${k}: ${displayVal}`;
      });
      return lines.join("\n");
    }

    if (typeof parsed === "string") {
      return isEnumLike(parsed) ? formatEnum(parsed) : parsed;
    }
    return String(parsed);
  } catch (e) {
    // Handle raw string literals that aren't valid JSON
    return isEnumLike(val) ? formatEnum(val) : val;
  }
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  action: string;
  title: string | null;
  entityType: string | null;
  entityId: string | null;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
}

// Map action patterns to icon + color
function getActionMeta(action: string) {
  if (action.includes("create") || action.includes("generate"))
    return {
      icon: Plus,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
      border: "border-emerald-200 dark:border-emerald-500/20",
    };
  if (action.includes("delete") || action.includes("remove") || action.includes("archive"))
    return {
      icon: Trash2,
      color: "text-red-500",
      bg: "bg-red-50 dark:bg-red-500/10",
      border: "border-red-200 dark:border-red-500/20",
    };
  if (action.includes("update") || action.includes("edit"))
    return {
      icon: Edit,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-500/10",
      border: "border-blue-200 dark:border-blue-500/20",
    };
  if (action.includes("PAID") || action.includes("payment"))
    return {
      icon: CreditCard,
      color: "text-emerald-600",
      bg: "bg-emerald-50 dark:bg-emerald-500/10",
      border: "border-emerald-200 dark:border-emerald-500/20",
    };
  if (action.includes("accept") || action.includes("sign"))
    return {
      icon: ShieldCheck,
      color: "text-violet-500",
      bg: "bg-violet-50 dark:bg-violet-500/10",
      border: "border-violet-200 dark:border-violet-500/20",
    };
  if (action.includes("settings"))
    return {
      icon: Settings,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-500/10",
      border: "border-amber-200 dark:border-amber-500/20",
    };
  if (action.includes("RECURRING") || action.includes("reset"))
    return {
      icon: RefreshCw,
      color: "text-sky-500",
      bg: "bg-sky-50 dark:bg-sky-500/10",
      border: "border-sky-200 dark:border-sky-500/20",
    };
  return {
    icon: Activity,
    color: "text-slate-500",
    bg: "bg-slate-50 dark:bg-slate-500/10",
    border: "border-slate-200 dark:border-slate-500/20",
  };
}

function getEntityIcon(entityType: string | null) {
  const normalized = entityType?.toUpperCase();
  switch (normalized) {
    case "INVOICE":
      return FileText;
    case "PROJECT":
      return FolderKanban;
    case "CLIENT":
      return Users;
    case "SETTINGS":
      return Settings;
    case "SOW_TEMPLATE":
      return FileCheck;
    case "RECURRING_INVOICE":
      return RefreshCw;
    default:
      return Activity;
  }
}

/** Format entityType for display: "INVOICE" → "Invoice", "SOW_TEMPLATE" → "SOW Template" */
function formatEntityType(entityType: string): string {
  return entityType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function formatAction(action: string): string {
  // Convert dot notation and underscores to readable format
  return action
    .replace(/\./g, " → ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function groupByDate(logs: ActivityLog[]): Map<string, ActivityLog[]> {
  const groups = new Map<string, ActivityLog[]>();
  for (const log of logs) {
    const date = new Date(log.createdAt);
    let key: string;
    if (isToday(date)) {
      key = "Today";
    } else if (isYesterday(date)) {
      key = "Yesterday";
    } else {
      key = format(date, "MMMM d, yyyy", { locale: enUS });
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(log);
  }
  return groups;
}

interface ActivityTimelineProps {
  logs: ActivityLog[];
  isLoading?: boolean;
  /** Background class for sticky headers. Defaults to 'bg-background/95 backdrop-blur-sm' */
  stickyBg?: string;
}

export function ActivityTimeline({
  logs,
  isLoading,
  stickyBg = "bg-background/95 backdrop-blur-sm"
}: ActivityTimelineProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="flex gap-3 items-start">
                <div className="h-9 w-9 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="bg-muted rounded-full p-4 mb-4">
          <Activity className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          No activity recorded yet
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Activity will appear when you create invoices, update settings, etc.
        </p>
      </div>
    );
  }

  const grouped = groupByDate(logs);

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([dateLabel, dateLogs]) => (
        <div key={dateLabel}>
          <h3 className={`text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 sticky top-0 py-1 z-10 ${stickyBg}`}>
            {dateLabel}
          </h3>
          <div className="space-y-1">
            {dateLogs.map((log) => {
              const meta = getActionMeta(log.action);
              const IconComponent = meta.icon;
              const date = new Date(log.createdAt);

              return (
                <div
                  key={log.id}
                  className="flex gap-3 items-start py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  {/* Icon */}
                  <div
                    className={`flex items-center justify-center h-9 w-9 rounded-full ${meta.bg} border ${meta.border} shrink-0`}
                  >
                    <IconComponent className={`h-4 w-4 ${meta.color}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {formatAction(log.action)}
                      </p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {format(date, "HH:mm")}
                      </span>
                    </div>
                    {log.title && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {log.title}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {log.userName}
                      </span>
                      {log.entityType && (
                        <>
                          <span className="text-muted-foreground/40">·</span>
                          <span className="text-xs text-muted-foreground/70">
                            {formatEntityType(log.entityType)}
                            {log.entityId && (
                              <span className="font-mono ml-1 text-[10px]">
                                {log.entityId.substring(0, 8)}…
                              </span>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                    {/* Show field changes and/or old/new values */}
                    {(log.field || log.oldValue || log.newValue) && (
                      <div className="mt-1.5 text-xs bg-muted/50 rounded-md px-2.5 py-1.5 font-mono inline-block max-w-full overflow-hidden">
                        {log.field && (
                          <div className="text-muted-foreground font-semibold mb-1">{log.field}</div>
                        )}
                        {log.oldValue && (
                          <div className="text-red-500/80 whitespace-pre-wrap">
                            <span className="line-through ml-1">{formatLogValue(log.oldValue)}</span>
                          </div>
                        )}
                        {log.newValue && (
                          <div className="text-emerald-600 whitespace-pre-wrap mt-0.5">
                            {formatLogValue(log.newValue)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
