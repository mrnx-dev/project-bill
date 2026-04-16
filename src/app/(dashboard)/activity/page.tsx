import { ActivityClient } from "./activity-client";

export const dynamic = "force-dynamic";

export default function ActivityPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity</h1>
          <p className="text-muted-foreground mt-2">
            Track all changes and events across your workspace.
          </p>
        </div>
      </div>

      <ActivityClient />
    </div>
  );
}
