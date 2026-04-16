import { NextResponse } from "next/server";
import { downgradeExpiredTrials } from "@/lib/billing/subscription";

import { RateLimiter } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Allow 2 requests per minute per IP to prevent abusive triggers
const cronRateLimiter = new RateLimiter({ limit: 2, windowMs: 60 * 1000 });

export async function GET(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown-ip";
    const rateLimitResult = cronRateLimiter.check(ip);
    
    if (!rateLimitResult.success) {
      console.warn(`[Cron Rate Limit] Exceeded for IP: ${ip}`);
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const result = await downgradeExpiredTrials();

    return NextResponse.json({
      success: true,
      message: `Downgraded ${result.count} expired trials`,
      downgradedCount: result.count
    });
  } catch (error) {
    console.error("[CRON_ERROR]", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}

