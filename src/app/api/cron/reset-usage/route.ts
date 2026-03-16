import { NextResponse } from "next/server";
import { RateLimiter } from "@/lib/rate-limit";
import { resetAllUsageCounters } from "@/lib/subscription";

// Allow 2 cron requests per minute per IP to prevent abusive triggers
const cronRateLimiter = new RateLimiter({ limit: 2, windowMs: 60 * 1000 });

export async function GET(request: Request) {
    // 0. Rate Limiting Check
    const ip = request.headers.get("x-forwarded-for") || "unknown-ip";
    const rateLimitResult = cronRateLimiter.check(ip);
    if (!rateLimitResult.success) {
        console.warn(`[Cron Rate Limit] Exceeded for IP: ${ip}`);
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    // 1. Validate CRON_SECRET (Default Deny if not set)
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization");

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const result = await resetAllUsageCounters();

        console.log(`[CRON] Reset usage counters for ${result.count} subscription(s)`);

        return NextResponse.json({
            success: true,
            message: `Reset ${result.count} subscription(s)`,
            count: result.count,
        });
    } catch (error) {
        console.error("Cron reset-usage job failed:", error);
        return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
    }
}
