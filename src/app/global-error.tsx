"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error("Global crash:", error)
    }, [error])

    return (
        <html lang="en">
            <body>
                <div className="flex min-h-screen flex-col items-center justify-center p-8 space-y-6 bg-background text-foreground text-center">
                    <AlertCircle className="h-16 w-16 text-destructive mb-4" />
                    <h1 className="text-4xl font-bold tracking-tight">Critical System Error</h1>
                    <p className="text-lg text-muted-foreground max-w-lg">
                        A critical error occurred that prevented the application from loading.
                    </p>
                    <Button size="lg" onClick={() => reset()}>
                        Reload Page
                    </Button>
                </div>
            </body>
        </html>
    )
}
