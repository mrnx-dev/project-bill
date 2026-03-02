"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        // Optionally log the error to an error reporting service
        console.error("Application error:", error)
    }, [error])

    return (
        <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center space-y-4">
            <div className="flex flex-col items-center space-y-2 text-center">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <h2 className="text-2xl font-bold tracking-tight">Something went wrong!</h2>
                <p className="text-muted-foreground max-w-md">
                    We encountered an unexpected error processing your request. Please try again or contact support if the issue persists.
                </p>
                {process.env.NODE_ENV === "development" && (
                    <div className="mt-4 p-4 bg-muted rounded-md text-left text-xs font-mono max-w-2xl overflow-auto">
                        <p className="font-bold text-destructive mb-2">{error.message}</p>
                        <pre>{error.stack}</pre>
                    </div>
                )}
            </div>
            <div className="flex gap-4">
                <Button onClick={() => window.location.href = "/"}>
                    Return Home
                </Button>
                <Button variant="outline" onClick={() => reset()}>
                    Try again
                </Button>
            </div>
        </div>
    )
}
