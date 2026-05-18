import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Use raw PrismaClient WITHOUT RLS extension for backfill
// We need to query ALL subscriptions across all orgs
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const BATCH_SIZE = 500;

async function backfill() {
  console.log("[BACKFILL] Starting subscription → organizationId backfill...\n");

  // ── Step 1: Detect duplicate subscriptions per userId ──────────────
  const duplicates = await prisma.subscription.groupBy({
    by: ["userId"],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  });

  if (duplicates.length > 0) {
    console.warn(`[WARN] Found ${duplicates.length} users with multiple subscriptions. Merging...`);
    for (const dup of duplicates) {
      const subs = await prisma.subscription.findMany({
        where: { userId: dup.userId },
        orderBy: { createdAt: "asc" },
      });
      // Keep the oldest subscription, delete the rest
      const [keep, ...rest] = subs;
      await prisma.subscription.deleteMany({
        where: { id: { in: rest.map((s) => s.id) } },
      });
      console.log(`[MERGE] userId=${dup.userId}: kept ${keep.id}, removed ${rest.length} duplicates`);
    }
    console.log("");
  }

  // ── Step 2: Batch backfill with cursor ─────────────────────────────
  let processed = 0;
  let skipped = 0;
  let cursor: string | undefined = undefined;

  while (true) {
    const subs = await prisma.subscription.findMany({
      where: { organizationId: null },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
    });

    if (subs.length === 0) break;
    cursor = subs[subs.length - 1].id;

    for (const sub of subs) {
      const membership = await prisma.organizationMember.findFirst({
        where: { userId: sub.userId, role: "OWNER" },
        orderBy: { joinedAt: "asc" },
      });

      if (!membership) {
        console.warn(`[SKIP] No OWNER membership for userId=${sub.userId}, subId=${sub.id}`);
        skipped++;
        continue;
      }

      await prisma.subscription.update({
        where: { id: sub.id },
        data: { organizationId: membership.organizationId },
      });
      processed++;
    }

    console.log(`[PROGRESS] Batch done: processed=${processed}, skipped=${skipped}`);
  }

  // ── Step 3: Pre-flight verification for Phase B ────────────────────
  const remaining = await prisma.subscription.count({
    where: { organizationId: null },
  });

  console.log("");
  if (remaining > 0) {
    console.error(`[BLOCKING] Cannot proceed to Phase B: ${remaining} subscriptions still have null organizationId`);
    console.error(`[BLOCKING] Fix these rows manually before running Phase B migration.`);
    process.exit(1);
  }

  console.log(`[DONE] Backfill complete. processed=${processed}, skipped=${skipped}`);
  console.log(`[DONE] Pre-flight check PASSED: 0 rows with null organizationId — safe to proceed to Phase B`);
}

backfill().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});