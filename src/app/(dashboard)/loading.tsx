import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-muted-foreground">Loading your project metrics...</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="rounded-xl border bg-card text-card-foreground shadow">
                        <div className="p-6 flex flex-row items-center justify-between space-y-0 pb-2">
                            <Skeleton className="h-4 w-[100px]" />
                            <Skeleton className="h-4 w-4 rounded-full" />
                        </div>
                        <div className="p-6 pt-0">
                            <Skeleton className="h-8 w-[120px] mb-1" />
                            <Skeleton className="h-3 w-[140px]" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold tracking-tight">Recent Projects</h2>
                <div className="rounded-md border p-4 space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="flex justify-between items-center pb-4 border-b last:border-0 last:pb-0">
                            <div className="space-y-2">
                                <Skeleton className="h-5 w-[150px]" />
                                <Skeleton className="h-4 w-[100px]" />
                            </div>
                            <div className="text-right space-y-2">
                                <Skeleton className="h-5 w-[80px] ml-auto" />
                                <Skeleton className="h-5 w-[60px] ml-auto rounded-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
