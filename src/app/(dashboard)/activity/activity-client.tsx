"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ActivityTimeline, type ActivityLog } from "@/components/activity-timeline";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ENTITY_FILTERS = [
  { label: "All", value: "" },
  { label: "Invoice", value: "INVOICE" },
  { label: "Project", value: "PROJECT" },
  { label: "Client", value: "CLIENT" },
  { label: "Recurring Invoice", value: "RECURRING_INVOICE" },
  { label: "SOW Template", value: "SOW_TEMPLATE" },
  { label: "Settings", value: "SETTINGS" },
] as const;

export function ActivityClient() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeFilter, setActiveFilter] = useState("");

  const fetchLogs = useCallback(async (pageNum: number, entityType: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "25",
      });
      if (entityType) params.set("entityType", entityType);

      const res = await fetch(`/api/activity?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setLogs(data.logs);
      setTotalPages(data.pagination.totalPages);
      setTotal(data.pagination.total);
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(page, activeFilter);
  }, [page, activeFilter, fetchLogs]);

  const handleFilterChange = (value: string) => {
    setActiveFilter(value);
    setPage(1);
  };

  // Use a ref to access latest state without re-triggering the SSE connection
  const latestState = useRef({ page, activeFilter });
  useEffect(() => {
    latestState.current = { page, activeFilter };
  }, [page, activeFilter]);

  // Listen to Server-Sent Events (SSE) for Real-Time Updates
  useEffect(() => {
    const eventSource = new EventSource("/api/events");

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "activity_logged") {
          // Re-fetch activities since a new one arrived
          // We only auto-refresh if we are on the first page
          const curr = latestState.current;
          if (curr.page === 1) {
            fetchLogs(1, curr.activeFilter);
          }
        }
      } catch (e) {
        // Ignored unparseable JSON or heartbeat
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE Connection Error", error);
      // EventSource auto-reconnects, but logging helps debugging
    };

    return () => {
      eventSource.close();
    };
  }, [fetchLogs]);


  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Activity History</CardTitle>
            <CardDescription>
              {total > 0
                ? `${total} activities recorded`
                : "All changes and activities in your workspace"}
            </CardDescription>
          </div>
          {/* Filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {ENTITY_FILTERS.map((filter) => (
              <Badge
                key={filter.value}
                variant={activeFilter === filter.value ? "default" : "outline"}
                className="cursor-pointer select-none text-xs px-3 py-1 hover:bg-primary/90 hover:text-primary-foreground transition-colors"
                onClick={() => handleFilterChange(filter.value)}
              >
                {filter.label}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ActivityTimeline 
          logs={logs} 
          isLoading={loading} 
          stickyBg="bg-card/95 backdrop-blur-sm"
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t pt-4 mt-6">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
