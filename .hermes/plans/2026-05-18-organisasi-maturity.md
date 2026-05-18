# Organisasi Maturity — Multi-Tenant Production Readiness Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Migrate Subscription from user-scoped to org-scoped, fix all data isolation leaks in dashboard/settings, and enhance OrgSwitcher with PRD-mandated UX features.

**Architecture:** Two-phase schema migration (Phase A: add nullable organizationId + backfill, Phase B: switch unique constraint), scoped Prisma queries in layout.tsx/settings, and enhance existing OrgSwitcher component with role badges, keyboard navigation, unsaved form warning, and observability logging.

**Tech Stack:** Next.js 16.1.6, Prisma 7, Auth.js v5, PostgreSQL, Tailwind v4, shadcn/ui

---

## Phase 1: Foundation — Subscription Org-Scoped (FR-1)

### Task 1: Add nullable `organizationId` to Subscription model (Phase A)

**Objective:** Add `organizationId String?` field to Subscription so we can backfill existing rows before switching the unique constraint.

**Files:**
- Modify: `prisma/schema.prisma:319-341` (Subscription model)

**Step 1: Edit schema to add nullable organizationId**

In `prisma/schema.prisma`, change the Subscription model:

```diff
 model Subscription {
   id                 String    @id @default(uuid())
   userId             String    @unique
+  organizationId     String?
   plan               String    @default("starter")
   status             String    @default("active")
   mayarCustomerId    String?
   mayarPaymentId     String?
   trialStartedAt     DateTime?
   trialEndsAt        DateTime?
   cancelAtPeriodEnd  Boolean   @default(false)
   cancelledAt        DateTime?
   currentPeriodStart DateTime  @default(now())
   currentPeriodEnd   DateTime
   emailsSent         Int       @default(0)
   invoicesCreated    Int       @default(0)
   paymentLinksUsed   Int       @default(0)
   createdAt          DateTime  @default(now())
   updatedAt          DateTime  @updatedAt
   user               User      @relation(fields: [userId], references: [id])

   @@index([userId])
   @@index([status])
 }
```

**Step 2: Generate and apply migration**

```bash
cd /root/projects/project-bill && npx prisma migrate dev --name add_org_id_to_subscription_nullable
```

Expected: Migration generated and applied successfully, no data loss.

**Step 3: Verify schema**

```bash
cd /root/projects/project-bill && npx prisma generate
```

Expected: Prisma client generated with new `organizationId?` field on Subscription.

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ && git commit -m "feat(billing): add nullable organizationId to Subscription model (Phase A)"
```

---

### Task 2: Create backfill script

**Objective:** Create an idempotent backfill script that populates `organizationId` on every existing Subscription row by finding the user's OWNER membership. Handles duplicates, uses batch cursor-based processing for 100K+ rows, and includes pre-flight verification.

**Files:**
- Create: `scripts/backfill-subscription-org.ts`

**Step 1: Create the backfill script**

Create `scripts/backfill-subscription-org.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
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

  await prisma.$disconnect();
}

backfill().catch((e) => {
  console.error("[FATAL]", e);
  process.exit(1);
});
```

**Step 2: Test run the backfill script (dry)**

```bash
cd /root/projects/project-bill && npx tsx scripts/backfill-subscription-org.ts
```

Expected: Script runs, processes subscriptions, logs progress, reports completion. If no subscriptions exist yet (self-hosted), script should output `[DONE]` with 0 processed.

**Step 3: Verify no remaining null organizationId**

```bash
cd /root/projects/project-bill && npx prisma studio &
# Or query directly:
npx tsx -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.subscription.count({ where: { organizationId: null } }).then(c => {
  console.log('Subscriptions with null organizationId:', c);
  p.\$disconnect();
});
"
```

Expected: Count = 0

**Step 4: Commit**

```bash
git add scripts/backfill-subscription-org.ts && git commit -m "feat(billing): add backfill script for subscription organizationId migration"
```

---

### Task 3: Switch Subscription unique constraint from userId to organizationId (Phase B)

**Objective:** Remove userId from Subscription, make organizationId the unique key, add Organization relation.

**Prerequisite:** Task 2 completed — all Subscription rows have non-null organizationId.

**Files:**
- Modify: `prisma/schema.prisma:319-341` (Subscription model)
- Modify: `prisma/schema.prisma:211-223` (User model — remove subscription relation)

**Step 1: Edit Subscription model**

In `prisma/schema.prisma`, change the Subscription model:

```diff
 model Subscription {
   id                 String    @id @default(uuid())
-  userId             String    @unique
-  organizationId     String?
+  organizationId     String    @unique
   plan               String    @default("starter")
   status             String    @default("active")
   mayarCustomerId    String?
   mayarPaymentId     String?
   trialStartedAt     DateTime?
   trialEndsAt        DateTime?
   cancelAtPeriodEnd  Boolean   @default(false)
   cancelledAt        DateTime?
   currentPeriodStart DateTime  @default(now())
   currentPeriodEnd   DateTime
   emailsSent         Int       @default(0)
   invoicesCreated    Int       @default(0)
   paymentLinksUsed   Int       @default(0)
   createdAt          DateTime  @default(now())
   updatedAt          DateTime  @updatedAt
-  user               User      @relation(fields: [userId], references: [id])
+  organization       Organization @relation(fields: [organizationId], references: [id])

-  @@index([userId])
+  @@index([organizationId])
   @@index([status])
 }
```

**Step 2: Remove subscription relation from User model**

In `prisma/schema.prisma`, change the User model:

```diff
 model User {
   id                     String                @id @default(uuid())
   email                  String                @unique
   password               String
   name                   String
   role                   String                @default("admin")
   onboardingCompleted    Boolean               @default(false)
   defaultOrganizationId  String?
   createdAt              DateTime              @default(now())
   updatedAt              DateTime              @updatedAt
-  subscription           Subscription?
   organizationMembers    OrganizationMember[]
 }
```

**Step 3: Add subscriptions relation to Organization model**

In `prisma/schema.prisma`, add to the Organization model (after existing relations, around line 30-35):

```diff
 model Organization {
   id                String                @id @default(uuid())
   name              String
   slug              String                @unique
   logoUrl           String?
   deletedAt         DateTime?
   createdAt         DateTime              @default(now())
   updatedAt         DateTime              @updatedAt
   members           OrganizationMember[]
   invites           OrganizationInvite[]
+  subscription      Subscription?
   // ... other existing relations ...
 }
```

**Step 4: Generate and apply migration**

```bash
cd /root/projects/project-bill && npx prisma migrate dev --name switch_subscription_to_org_scoped
```

Expected: Migration succeeds — `userId` column dropped, `organizationId` now `@unique`.

**Step 5: Regenerate Prisma client and verify**

```bash
cd /root/projects/project-bill && npx prisma generate
```

Expected: Prisma client regenerated. `Subscription` no longer has `userId`. `Organization` now has `subscription?` field.

**Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ && git commit -m "feat(billing): switch Subscription from userId to organizationId unique (Phase B)"
```

---

### Task 4: Refactor `getSubscription` → `getSubscriptionByOrg` and remove user-scoped helpers

**Objective:** Replace user-scoped `getSubscription(userId)` with org-scoped `getSubscriptionByOrg(orgId)`. Remove dead code: `checkLimit()`, `incrementUsage()`, `getOrgOwnerId()`.

**Files:**
- Modify: `src/lib/billing/subscription.ts` (full refactor)

**Step 1: Replace `getSubscription(userId)` with `getSubscriptionByOrg(orgId)`**

In `src/lib/billing/subscription.ts`, replace lines 165-191:

```typescript
/**
 * Gets or creates the default subscription for an organization.
 * Automatically gives a 14-day Pro trial for new organizations.
 */
export async function getSubscriptionByOrg(organizationId: string): Promise<Subscription> {
  const sub = await prisma.subscription.findUnique({
    where: { organizationId },
  });

  if (sub) return sub;

  // Create default 14-day trial for "pro" plan if it doesn't exist
  const now = new Date();
  const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

  return prisma.subscription.create({
    data: {
      organizationId,
      plan: "pro",
      status: "TRIALING",
      trialStartedAt: now,
      trialEndsAt: trialEnds,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnds,
    },
  });
}
```

**Step 2: Update `checkTrialStatus` to use orgId**

Replace `checkTrialStatus(userId: string)` with:

```typescript
export async function checkTrialStatus(organizationId: string): Promise<{ isTrialing: boolean; daysLeft: number }> {
  const sub = await getSubscriptionByOrg(organizationId);
  if (sub.status !== "TRIALING" || !sub.trialEndsAt) {
    return { isTrialing: false, daysLeft: 0 };
  }

  const now = new Date();
  const diffTime = sub.trialEndsAt.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (daysLeft <= 0) {
    return { isTrialing: false, daysLeft: 0 };
  }

  return { isTrialing: true, daysLeft };
}
```

**Step 3: Update `cancelSubscription` to use orgId**

Replace `cancelSubscription(userId: string)` with:

```typescript
export async function cancelSubscription(organizationId: string): Promise<Subscription> {
  return prisma.subscription.update({
    where: { organizationId },
    data: {
      cancelAtPeriodEnd: true,
    },
  });
}
```

**Step 4: Refactor `checkOrgLimit` — direct query without getOrgOwnerId**

Replace lines 68-130 of `checkOrgLimit`:

```typescript
export async function checkOrgLimit(
  organizationId: string,
  resource: ResourceType
): Promise<LimitCheckResult> {
  if (isSelfHosted()) {
    return { allowed: true, current: 0, limit: Infinity, plan: "business" };
  }

  const sub = await getSubscriptionByOrg(organizationId);
  const planName = sub.plan as PlanType;
  const limits = PLAN_LIMITS[planName] || PLAN_LIMITS.starter;

  if (typeof limits[resource] === "boolean") {
    return { allowed: limits[resource] as boolean, current: 0, limit: 1, plan: planName };
  }

  let current = 0;
  const limit = typeof limits[resource] === "number" ? limits[resource] as number : Infinity;

  switch (resource) {
    case "clients":
      current = await prisma.client.count({
        where: { organizationId, isArchived: false },
      });
      break;
    case "activeProjects":
      current = await prisma.project.count({
        where: { organizationId, status: { not: "DONE" } },
      });
      break;
    case "recurringTemplates":
      current = await prisma.recurringInvoice.count({
        where: { organizationId, isActive: true },
      });
      break;
    case "sowTemplates":
      current = await prisma.sOWTemplate.count({
        where: { organizationId },
      });
      break;
    case "teamMembers":
      current = await prisma.organizationMember.count({
        where: { organizationId },
      });
      break;
    case "invoicesPerMonth":
      current = sub.invoicesCreated;
      break;
    case "emailsPerMonth":
      current = sub.emailsSent;
      break;
    case "paymentLinksPerMonth":
      current = sub.paymentLinksUsed;
      break;
  }

  const result: LimitCheckResult = { allowed: current < limit, current, limit, plan: planName };

  // Logging observability: log every deny (PRD NFR)
  if (!result.allowed) {
    console.warn(`[LIMIT_DENY] orgId=${organizationId} resource=${resource} current=${result.current} limit=${result.limit} plan=${sub.plan}`);
  }

  return result;
}
```

**Step 5: Refactor `incrementOrgUsage` — direct update without getOrgOwnerId**

Replace lines 132-151:

```typescript
export async function incrementOrgUsage(
  organizationId: string,
  field: UsageCounterField,
  amount: number = 1
): Promise<void> {
  if (isSelfHosted()) return;

  try {
    await getSubscriptionByOrg(organizationId);
    await prisma.subscription.update({
      where: { organizationId },
      data: { [field]: { increment: amount } },
    });
  } catch (error) {
    console.error(`Failed to increment org usage for ${organizationId} [${field}]:`, error);
  }
}
```

**Step 6: Remove dead code**

Delete the following functions entirely from `src/lib/billing/subscription.ts`:
- `getOrgOwnerId()` (lines 61-66)
- `getSubscription(userId)` — the old one being replaced
- `checkLimit()` (lines 265-339) — user-scoped, never called in production src
- `incrementUsage()` (lines 349-369) — user-scoped, never called in production src

**Step 7: Verify no compilation errors**

```bash
cd /root/projects/project-bill && npx tsc --noEmit 2>&1 | head -50
```

Expected: Compilation errors pointing to remaining callers of removed functions (to be fixed in later tasks).

**Step 8: Commit**

```bash
git add src/lib/billing/subscription.ts && git commit -m "feat(billing): refactor to org-scoped getSubscriptionByOrg, remove dead user-scoped helpers"
```

---

### Task 5: Update `GET /api/subscription` — query by organizationId

**Objective:** Change GET handler from `getSubscription(session.user.id)` to `getSubscriptionByOrg(orgId)`, fix teamMembers count to use org member count instead of global user count.

**Files:**
- Modify: `src/app/api/subscription/route.ts:1-69` (GET handler)

**Step 1: Update imports**

In `src/app/api/subscription/route.ts` line 3, change:

```diff
-import { getSubscription, checkTrialStatus, isSelfHosted, PLAN_LIMITS, type PlanType } from "@/lib/billing/subscription";
+import { getSubscriptionByOrg, checkTrialStatus, isSelfHosted, PLAN_LIMITS, type PlanType } from "@/lib/billing/subscription";
```

**Step 2: Update GET handler**

Replace lines 26-38:

```diff
-        const sub = await getSubscription(session.user.id);
-        const trialStatus = await checkTrialStatus(session.user.id);
+        const sub = await getSubscriptionByOrg(orgId);
+        const trialStatus = await checkTrialStatus(orgId);
         const planName = sub.plan as PlanType;
         const limits = PLAN_LIMITS[planName] || PLAN_LIMITS.starter;

         // Get current counts for static resources
         const [clientCount, projectCount, recurringCount, sowCount, teamCount] = await Promise.all([
             prisma.client.count({ where: { organizationId: orgId, isArchived: false } }),
             prisma.project.count({ where: { organizationId: orgId, status: { not: "DONE" } } }),
             prisma.recurringInvoice.count({ where: { organizationId: orgId, isActive: true } }),
             prisma.sOWTemplate.count({ where: { organizationId: orgId } }),
-            prisma.user.count(),
+            prisma.organizationMember.count({ where: { organizationId: orgId } }),
         ]);
```

**Step 3: Verify compilation**

```bash
cd /root/projects/project-bill && npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/app/api/subscription/route.ts && git commit -m "fix(billing): query subscription by orgId, fix teamMembers count to use org members"
```

---

### Task 6: Update `PUT /api/subscription` — query by organizationId

**Objective:** Change PUT handler from `prisma.subscription.update({ where: { userId } })` to `prisma.subscription.update({ where: { organizationId } })`.

**Files:**
- Modify: `src/app/api/subscription/route.ts:71-127` (PUT handler)

**Step 1: Update PUT handler**

Replace lines 108-117:

```diff
-        const { userId, plan } = validation.data;
-        const targetUserId = userId || session.user.id;
+        const { plan } = validation.data;

         // Ensure subscription exists first
-        await getSubscription(targetUserId);
+        const orgId = session.user.activeOrganizationId!;
+        await getSubscriptionByOrg(orgId);

         const updated = await prisma.subscription.update({
-            where: { userId: targetUserId },
+            where: { organizationId: orgId },
             data: { plan },
         });
```

**Step 2: Remove `userId` from updateSchema**

Replace line 72-75:

```diff
 const updateSchema = z.object({
-    userId: z.string().uuid().optional(), // If not provided, updates current user
     plan: z.enum(["starter", "pro", "business"]),
 });
```

**Step 3: Verify compilation**

```bash
cd /root/projects/project-bill && npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/app/api/subscription/route.ts && git commit -m "fix(billing): update subscription by organizationId instead of userId"
```

---

### Task 7: Update `POST /api/subscription/checkout` — query by organizationId

**Objective:** Change checkout handler from user-scoped to org-scoped subscription lookup and update.

**Files:**
- Modify: `src/app/api/subscription/checkout/route.ts`

**Step 1: Update imports**

Line 4:

```diff
-import { PLAN_PRICING, getSubscription } from "@/lib/billing/subscription";
+import { PLAN_PRICING, getSubscriptionByOrg } from "@/lib/billing/subscription";
```

**Step 2: Update checkout handler**

Replace lines 14, 28-34, 49-54:

```diff
-    const userId = session.user.id;
+    const orgId = session.user.activeOrganizationId!;

     // ... (plan validation stays the same) ...

-    const user = await prisma.user.findUnique({ where: { id: userId } });
-    if (!user) {
-      return new NextResponse("User not found", { status: 404 });
-    }

     // Ensure subscription exists
-    await getSubscription(userId);
+    await getSubscriptionByOrg(orgId);

     // Create payment link via Mayar
     const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
     const payment = await createPaymentLink({
       amount: price,
-      customerName: user.name || "Customer",
-      customerEmail: user.email || "",
+      customerName: session.user.name || "Customer",
+      customerEmail: session.user.email || "",
       customerMobile: "08000000000",
       description: `ProjectBill - Upgrade to ${plan.toUpperCase()} (${billing})`,
       redirectUrl: `${baseUrl}/settings/subscription?success=true`,
-      organizationId: session.user.activeOrganizationId!,
+      organizationId: orgId,
     });

     // Save payment intent
     await prisma.subscription.update({
-      where: { userId },
+      where: { organizationId: orgId },
       data: {
         mayarPaymentId: payment.id,
       },
     });
```

**Step 3: Verify compilation**

```bash
cd /root/projects/project-bill && npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/app/api/subscription/checkout/route.ts && git commit -m "fix(billing): checkout uses org-scoped subscription lookup"
```

---

### Task 8: Add auto-create subscription when creating organization

**Objective:** When a new organization is created via `POST /api/organizations`, automatically create a trial subscription for that organization.

**Files:**
- Modify: `src/app/api/organizations/route.ts:39-81` (POST handler)

**Step 1: Add import**

At the top of `src/app/api/organizations/route.ts`, add:

```diff
 import { NextResponse } from "next/server";
 import { prisma } from "@/lib/prisma";
 import { auth } from "@/auth";
 import { createOrganizationSchema } from "@/lib/validations/organization";
+import { isSelfHosted } from "@/lib/billing/subscription";
```

**Step 2: Add subscription creation after org + member creation**

After line 68 (`});` closing the organizationMember.create), add:

```typescript
    // Auto-create trial subscription for managed mode
    if (!isSelfHosted()) {
      const now = new Date();
      const trialEnds = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      await prisma.subscription.create({
        data: {
          organizationId: org.id,
          plan: "pro",
          status: "TRIALING",
          trialStartedAt: now,
          trialEndsAt: trialEnds,
          currentPeriodStart: now,
          currentPeriodEnd: trialEnds,
        },
      });
    }
```

**Step 3: Verify compilation**

```bash
cd /root/projects/project-bill && npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Commit**

```bash
git add src/app/api/organizations/route.ts && git commit -m "feat(billing): auto-create trial subscription on organization creation"
```

---

### Task 9: Cascade-delete subscription when organization is deleted

**Objective:** When an organization is soft-deleted, also soft-delete (or hard-delete) its subscription so it doesn't orphan.

**Files:**
- Modify: `src/app/api/organizations/[id]/delete/route.ts`

**Step 1: Add subscription deletion**

After line 26 (`await prisma.organization.update(...)`), add before the member notification loop:

```typescript
    // Delete the organization's subscription
    await prisma.subscription.deleteMany({
      where: { organizationId: id },
    });
```

**Step 2: Verify compilation**

```bash
cd /root/projects/project-bill && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/app/api/organizations/[id]/delete/route.ts && git commit -m "feat(billing): delete subscription when organization is deleted"
```

---

### Task 10: Add logging to `POST /api/organizations/[id]/switch`

**Objective:** Add observability logging per PRD NFR — log every org switch event with userId, fromOrg, toOrg, role.

**Files:**
- Modify: `src/app/api/organizations/[id]/switch/route.ts:25-29`

**Step 1: Add logging after membership verification**

After line 19 (membership check), within the success path:

```diff
     if (!membership) {
       return NextResponse.json({ error: "You are not a member of this organization" }, { status: 403 });
     }

+    console.log(`[ORG_SWITCH] userId=${session.user.id} fromOrg=${session.user.activeOrganizationId ?? "none"} toOrg=${id} role=${membership.role}`);

     return NextResponse.json({
       success: true,
       organizationId: id,
       activeOrganizationRole: membership.role,
     });
```

**Step 2: Verify compilation**

```bash
cd /root/projects/project-bill && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Commit**

```bash
git add src/app/api/organizations/[id]/switch/route.ts && git commit -m "feat(observability): log org switch events with userId, fromOrg, toOrg"
```

---

### Task 11: Update `cancelSubscription` and `checkTrialStatus` callers

**Objective:** Search and update any callers of the old `getSubscription(userId)` and `cancelSubscription(userId)` that may have been missed.

**Files:**
- Search and modify: Any remaining callers in `src/`

**Step 1: Search for remaining callers**

```bash
cd /root/projects/project-bill && grep -rn "getSubscription\b" src/ --include="*.ts" --include="*.tsx" | grep -v "getSubscriptionByOrg" | grep -v "node_modules"
```

Expected: Should find nothing in production src (only possibly in tests).

**Step 2: Search for cancelSubscription callers**

```bash
cd /root/projects/project-bill && grep -rn "cancelSubscription" src/ --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```

Expected: Find callers that pass `userId` — update them to pass `orgId` from `session.user.activeOrganizationId`.

**Step 3: Fix any callers found**

For each caller found, replace `userId` argument with `organizationId` from session.

**Step 4: Update test files if needed**

If tests reference `getSubscription(userId)`, update them to use `getSubscriptionByOrg(orgId)`.

**Step 5: Verify full compilation**

```bash
cd /root/projects/project-bill && npx tsc --noEmit 2>&1 | head -30
```

Expected: Zero errors related to `getSubscription`, `cancelSubscription`, `getOrgOwnerId`, `checkLimit`, `incrementUsage`.

**Step 6: Commit**

```bash
git add -A && git commit -m "fix(billing): update remaining callers from userId to orgId for subscription functions"
```

---

## Phase 2: Data Isolation (FR-2)

### Task 12: Fix dashboard layout data isolation — add orgId guard + scoped Prisma queries

**Objective:** Fix `layout.tsx` to scope `settings.findFirst` and `client.findMany` to the active organization. Add `!orgId` guard that redirects to onboarding.

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx:34-52`

**Step 1: Add orgId guard and scoped queries**

Replace lines 34-52:

```diff
   const session = await auth();
   if (!session?.user?.id) {
     redirect("/login");
   }

+  const orgId = session.user.activeOrganizationId;
+  if (!orgId) {
+    redirect("/onboarding/organization");
+  }

   const dbUser = await prisma.user.findUnique({
     where: { id: session.user.id },
     select: { name: true, email: true, onboardingCompleted: true },
   });

   const settings = await prisma.settings.findFirst({
-    where: {},
+    where: { organizationId: orgId },
   });

   const clients = await prisma.client.findMany({
-    where: {},
+    where: { organizationId: orgId },
     orderBy: { createdAt: "desc" },
     select: { id: true, name: true },
   });
```

**Step 2: Verify compilation**

```bash
cd /root/projects/project-bill && npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Verify behavior**

- Login → dashboard should render normally
- If user has no org, should redirect to `/onboarding/organization` (if that route exists) or show empty state

**Step 4: Commit**

```bash
git add src/app/\(dashboard\)/layout.tsx && git commit -m "fix(data-isolation): scope dashboard layout queries to active organization"
```

---

### Task 13: Fix `GET /api/settings` data isolation — scoped findFirst

**Objective:** Fix `settings.findFirst({ where: {} })` in the GET handler to use `{ where: { organizationId: orgId } }`.

**Files:**
- Modify: `src/app/api/settings/route.ts:19-21`

**Step 1: Fix the empty where clause**

Replace lines 19-21:

```diff
     let settings = await prisma.settings.findFirst({
-      where: {},
+      where: { organizationId: orgId },
     });
```

Note: `orgId` is already defined at line 17 as `session.user.activeOrganizationId!` — no additional variable needed.

**Step 2: Also fix PUT handler if needed**

Check if PUT handler has the same unscoped query. If `settings/route.ts` PUT handler (around line 71) has similar `findFirst({ where: {} })`, fix it the same way.

```bash
cd /root/projects/project-bill && grep -n "findFirst.*where.*{}" src/app/api/settings/route.ts
```

Fix any occurrences found.

**Step 3: Verify compilation**

```bash
cd /root/projects/project-bill && npx tsc --noEmit 2>&1 | head -20
```

**Step 4: Verify no other unscoped queries exist**

```bash
cd /root/projects/project-bill && grep -rn "findFirst.*where.*{}" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".d.ts"
cd /root/projects/project-bill && grep -rn "findMany.*where.*{}" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".d.ts"
```

Expected: No remaining `findFirst({ where: {} })` or `findMany({ where: {} })` in dashboard/API code that handles org-scoped data.

**Step 5: Commit**

```bash
git add src/app/api/settings/route.ts && git commit -m "fix(data-isolation): scope settings API queries to active organization"
```

---

## Phase 3: Organization Switcher Enhancement (FR-3)

### Task 14: Add role badge and keyboard navigation to OrgSwitcher

**Objective:** Enhance the existing OrgSwitcher component to display role badges next to org names and support full keyboard navigation.

**Files:**
- Modify: `src/components/org-switcher.tsx`

**Step 1: Read current OrgSwitcher component**

```bash
cat src/components/org-switcher.tsx
```

**Step 2: Add role badge UI**

In the org list item rendering, add a role badge:

```tsx
// For each org item in the popover list, add a role badge next to the name:
<span className="ml-auto text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
  {org.role}
</span>
```

The badge should use different visual styles for OWNER/ADMIN/MEMBER:
- OWNER: slightly emphasized (e.g., `bg-primary/10 text-primary`)
- ADMIN: default muted
- MEMBER: default muted

**Step 3: Add keyboard navigation**

Ensure the OrgSwitcher popover supports:
- `Tab` / `Shift+Tab`: navigate into/out of the switcher
- `ArrowDown` / `ArrowUp`: cycle through org list items
- `Enter`: select the focused org and trigger switch
- `Escape`: close the popover

If using shadcn/ui `Command` component (which already has keyboard support), ensure it's wired properly. If using custom Popover, add `onKeyDown` handler with focus management.

**Step 4: Add single-org non-interactive display**

When `organizations.length === 1`, render the switcher as non-interactive — just show the org name and role badge without the popover trigger functionality.

**Step 5: Verify in browser**

```bash
# Start dev server if not running
cd /root/projects/project-bill && npm run dev
```

Check:
- Switcher shows role badges
- Keyboard navigation works (Tab, Enter, Arrows, Escape)
- Single org shows as non-interactive

**Step 6: Commit**

```bash
git add src/components/org-switcher.tsx && git commit -m "feat(org-switcher): add role badges, keyboard navigation, single-org display"
```

---

### Task 15: Add unsaved form detection before org switch

**Objective:** Create a `useUnsavedForm` hook that detects if any form on the page is dirty, and add a confirm dialog to the OrgSwitcher before switching orgs when unsaved changes exist.

**Files:**
- Create: `src/hooks/use-unsaved-form.ts`
- Modify: `src/components/org-switcher.tsx`

**Step 1: Create `useUnsavedForm` hook**

Create `src/hooks/use-unsaved-form.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * Detects if any form on the page has unsaved changes by checking
 * for `data-dirty="true"` attributes on form elements.
 * Forms should set this attribute when their dirty state changes.
 */
export function useUnsavedForm() {
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const dirtyForms = document.querySelectorAll('[data-dirty="true"]');
      setIsDirty(dirtyForms.length > 0);
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-dirty"],
      subtree: true,
    });

    // Initial check
    const dirtyForms = document.querySelectorAll('[data-dirty="true"]');
    setIsDirty(dirtyForms.length > 0);

    return () => observer.disconnect();
  }, []);

  const confirmSwitch = useCallback((): boolean => {
    if (!isDirty) return true;
    return window.confirm("You have unsaved changes. Are you sure you want to switch organizations? Your changes will be lost.");
  }, [isDirty]);

  return { isDirty, confirmSwitch };
}
```

**Step 2: Integrate into OrgSwitcher**

In `src/components/org-switcher.tsx`:
1. Import `useUnsavedForm` hook
2. Call it at the top of the component
3. Before any `switchOrganization()` call, check `confirmSwitch()`
4. If `confirmSwitch()` returns false, cancel the switch

```tsx
import { useUnsavedForm } from "@/hooks/use-unsaved-form";

// Inside the component:
const { confirmSwitch } = useUnsavedForm();

// In the switch handler:
async function handleSwitch(orgId: string) {
  if (!confirmSwitch()) return; // User cancelled
  // ... existing switch logic
}
```

**Step 3: Verify in browser**

- Open a form (e.g., settings), make changes (form becomes dirty)
- Try to switch org → confirm dialog should appear
- Click "Cancel" → stay on current org
- Click "OK" → proceed with switch

**Step 4: Commit**

```bash
git add src/hooks/use-unsaved-form.ts src/components/org-switcher.tsx && git commit -m "feat(org-switcher): add unsaved form detection before org switch"
```

---

### Task 16: Integrate OrgSwitcher data flow from layout.tsx

**Objective:** Pass organization memberships data from `layout.tsx` to `AppSidebar` → `OrgSwitcher` so the switcher shows all user orgs. Currently the OrgSwitcher fetches orgs client-side; this task optionally adds server-side data passing for better UX.

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/components/app-sidebar.tsx`

**Step 1: Fetch memberships in layout.tsx**

In `src/app/(dashboard)/layout.tsx`, after the orgId guard, add:

```typescript
const memberships = await prisma.organizationMember.findMany({
  where: { userId: session.user.id },
  include: { organization: true },
  orderBy: { joinedAt: "asc" },
});
```

**Step 2: Pass to AppSidebar**

Update the AppSidebar call:

```diff
-<AppSidebar user={dbUser || session.user} company={settings || undefined} />
+<AppSidebar
+  user={dbUser || session.user}
+  company={settings || undefined}
+  organizations={memberships.map((m) => ({
+    id: m.organization.id,
+    name: m.organization.name,
+    slug: m.organization.slug,
+    logoUrl: m.organization.logoUrl,
+    role: m.role,
+  }))}
+  activeOrgId={orgId}
+/>
```

**Step 3: Update AppSidebar props**

In `src/components/app-sidebar.tsx`, add the new props to its interface and pass them to OrgSwitcher.

**Step 4: Verify in browser**

Check that OrgSwitcher receives org data from server.

**Step 5: Commit**

```bash
git add src/app/\(dashboard\)/layout.tsx src/components/app-sidebar.tsx && git commit -m "feat(org-switcher): pass organization data server-side from layout to sidebar"
```

---

### Task 17: Add "Create Organization" link to OrgSwitcher popover footer

**Objective:** Add a link/button at the bottom of the OrgSwitcher popover that allows users to create a new organization.

**Files:**
- Modify: `src/components/org-switcher.tsx`

**Step 1: Add create org link**

In the OrgSwitcher popover content, at the bottom (after the org list), add:

```tsx
<div className="border-t pt-1 mt-1">
  <button
    onClick={() => {
      // If using the built-in create dialog, trigger it.
      // Otherwise, redirect to a create-org page.
      setShowCreateDialog(true); // or router.push("/settings/organization/new")
    }}
    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
  >
    <Plus className="h-4 w-4" />
    Create Organization
  </button>
</div>
```

The existing OrgSwitcher already has a create org dialog. If it does, just ensure the "+" trigger is visible in the popover footer.

**Step 2: Verify in browser**

- Open switcher → "Create Organization" link visible at bottom
- Click → create org dialog opens or redirect works

**Step 3: Commit**

```bash
git add src/components/org-switcher.tsx && git commit -m "feat(org-switcher): add create organization link in popover footer"
```

---

## Phase 4: Verification & Cleanup

### Task 18: Full TypeScript compilation check

**Objective:** Ensure the entire codebase compiles without errors after all changes.

**Files:**
- All modified files

**Step 1: Run full type check**

```bash
cd /root/projects/project-bill && npx tsc --noEmit 2>&1
```

Expected: Zero errors. If errors exist, fix them before proceeding.

**Step 2: Fix any remaining issues**

Common issues to check:
- Any remaining `getSubscription(userId)` calls
- Any remaining `where: {}` on org-scoped tables
- Import paths for renamed functions

**Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: resolve remaining TypeScript errors after org-scoped migration"
```

---

### Task 19: Verify no unscoped queries remain

**Objective:** Scan the entire codebase for any remaining Prisma queries that should be org-scoped but aren't.

**Files:**
- Search across `src/`

**Step 1: Search for unscoped findFirst/findMany**

```bash
cd /root/projects/project-bill && grep -rn "findFirst.*where.*{}" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
cd /root/projects/project-bill && grep -rn "findMany.*where.*{}" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules
```

**Step 2: Search for remaining userId references on Subscription**

```bash
cd /root/projects/project-bill && grep -rn "\.userId" src/ --include="*.ts" --include="*.tsx" | grep -i subscription | grep -v node_modules
```

Expected: No matches — subscription should no longer reference userId.

**Step 3: Fix any issues found**

**Step 4: Commit**

```bash
git add -A && git commit -m "fix: clean up remaining unscoped queries and userId references on Subscription"
```

---

### Task 20: Manual verification checklist

**Objective:** Run through the PRD verification checklist manually.

**No files to modify.**

**Step 1: Verify FR-1 (Subscription Org-Scoped)**

- [ ] Create organization → subscription auto-created with trial 14 days
- [ ] `checkOrgLimit(orgId, "clients")` returns limit based on org's subscription
- [ ] `checkOrgLimit(orgId, "teamMembers")` counts org members, not all users
- [ ] Self-hosted: `checkOrgLimit()` still returns `{ allowed: true }`

**Step 2: Verify FR-2 (Data Isolation)**

- [ ] Dashboard sidebar only shows clients from active org
- [ ] Settings page only shows settings for active org
- [ ] Switch to different org → sidebar shows that org's clients, settings shows that org's settings
- [ ] No `where: {}` queries remaining in dashboard code

**Step 3: Verify FR-3 (Org Switcher)**

- [ ] Switcher shows all user orgs
- [ ] Active org is highlighted
- [ ] Switch within 1 click
- [ ] Role badge visible
- [ ] Keyboard accessible (Tab, Enter, Arrows)
- [ ] Unsaved form warning appears when switching with dirty form
- [ ] Create org link works
- [ ] Error handling: 401/403/network

**Step 4: Document results**

If all checks pass, the feature is production-ready. If not, create follow-up tasks.

---

## Summary

| Phase | Tasks | Files | Est. |
|-------|-------|-------|------|
| Phase 1: Subscription Org-Scoped | 1-11 | ~10 files | ~90m |
| Phase 2: Data Isolation | 12-13 | ~2 files | ~15m |
| Phase 3: Org Switcher Enhancement | 14-17 | ~4 files | ~60m |
| Phase 4: Verification & Cleanup | 18-20 | ~0 files | ~20m |
| **Total** | **20 tasks** | **~12 files** | **~185m** |

**Critical dependency chain:**
- Tasks 1-3 must be sequential (schema migration Phase A → backfill → Phase B)
- Task 4 depends on Task 3 (schema change must complete first)
- Tasks 5-7 depend on Task 4 (getSubscriptionByOrg must exist)
- Tasks 8-11 can be done in any order after Task 4
- Phase 2 tasks (12-13) are independent of Phase 1 but should follow after
- Phase 3 tasks (14-17) are independent and can begin anytime
- Phase 4 tasks (18-20) must be last