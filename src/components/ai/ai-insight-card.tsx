"use client";
// AI Insight Card Component — displays proactive insights
import { cn } from "@/lib/utils";
import type { ProactiveInsight } from "@/lib/ai/types";
import { AlertTriangle, TrendingUp, Users, DollarSign, Clock } from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  overdue_warning: AlertTriangle,
  cashflow_alert: TrendingUp,
  client_suggestion: Users,
  pricing_tip: DollarSign,
  follow_up_reminder: Clock,
};

const colorMap: Record<string, string> = {
  high: "border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800",
  medium: "border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800",
  low: "border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800",
};

interface AIInsightCardProps {
  insight: ProactiveInsight;
  onAction?: () => void;
}

export function AIInsightCard({ insight, onAction }: AIInsightCardProps) {
  const Icon = iconMap[insight.type] ?? AlertTriangle;

  return (
    <div className={cn("rounded-lg border p-3 text-sm", colorMap[insight.priority])}>
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-foreground">{insight.message}</p>
          {insight.action && onAction && (
            <button
              onClick={onAction}
              className="mt-2 text-xs font-medium text-primary hover:underline"
            >
              {insight.actionLabel ?? "View details →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
