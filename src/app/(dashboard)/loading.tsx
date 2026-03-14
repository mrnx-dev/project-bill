import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Overview of active projects tracking.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border bg-card text-card-foreground shadow"
          >
            <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[120px]" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </div>
            <div className="p-6 pt-1 pb-5">
              <Skeleton className="h-8 w-[140px] mb-2" />
              <Skeleton className="h-3 w-[160px]" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-card shadow p-6 space-y-4">
          <Skeleton className="h-6 w-[150px]" />
          <Skeleton className="h-[300px] w-full" />
        </div>
        <div className="rounded-xl border bg-card shadow p-6 space-y-4">
          <Skeleton className="h-6 w-[150px]" />
          <div className="flex justify-center py-10">
            <Skeleton className="h-[200px] w-[200px] rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
