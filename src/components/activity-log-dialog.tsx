"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ActivityTimeline, type ActivityLog } from "@/components/activity-timeline";
import { History, ChevronLeft, ChevronRight } from "lucide-react";

interface ActivityLogDialogProps {
  /** Optional: filter by entity type (e.g., "Invoice", "Project") */
  entityType?: string;
  /** Optional: filter by specific entity ID */
  entityId?: string;
  /** Custom trigger element. If not provided, a default button is used. */
  trigger?: React.ReactNode;
  /** Dialog title override */
  title?: string;
}

export function ActivityLogDialog({
  entityType,
  entityId,
  trigger,
  title,
}: ActivityLogDialogProps) {
  const [open, setOpen] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "20",
      });
      if (entityType) params.set("entityType", entityType);
      if (entityId) params.set("entityId", entityId);

      const res = await fetch(`/api/activity?${params}`);
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      const data = await res.json();
      setLogs(data.logs);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    if (open) {
      setPage(1);
      fetchLogs(1);
    }
  }, [open, fetchLogs]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchLogs(newPage);
  };

  const dialogTitle = title
    || (entityType
      ? `Activity — ${entityType}${entityId ? ` #${entityId.substring(0, 8)}` : ""}`
      : "Activity Log");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <History className="h-4 w-4" />
            Activity Log
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>
            {total > 0
              ? `${total} activities recorded`
              : "Change history and activity log"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">
          <ActivityTimeline logs={logs} isLoading={loading} />
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t pt-4 mt-2">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages || loading}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
