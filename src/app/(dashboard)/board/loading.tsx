import { Skeleton } from "@/components/ui/skeleton";

export default function BoardLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Board</h1>
          <p className="text-muted-foreground mt-2">
            Manage project lifecycles using the Kanban board.
          </p>
        </div>
      </div>

      <div className="flex gap-6 h-full overflow-x-auto pb-4">
        {/* Render 4 columns for To Do, In Progress, Review, Done */}
        {Array.from({ length: 4 }).map((_, colIndex) => (
          <div key={colIndex} className="flex-none w-80 flex flex-col pt-1">
            <div className="flex items-center justify-between mb-3 px-1">
              <Skeleton className="h-6 w-[100px]" />
              <Skeleton className="h-5 w-5 rounded-full" />
            </div>

            <div className="flex-1 rounded-xl bg-muted/50 p-3 space-y-3">
              {Array.from({ length: colIndex === 0 ? 3 : 1 }).map(
                (_, cardIndex) => (
                  <div
                    key={cardIndex}
                    className="bg-card rounded-lg border shadow-sm p-4 space-y-3"
                  >
                    <Skeleton className="h-5 w-[140px]" />
                    <Skeleton className="h-4 w-[200px]" />
                    <div className="flex justify-between items-center mt-4">
                      <Skeleton className="h-3 w-[60px]" />
                      <Skeleton className="h-6 w-[80px] rounded-full" />
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
