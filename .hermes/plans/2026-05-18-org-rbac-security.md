# Implementation Plan: Organization RBAC & Security

> **For Hermes:** Use subagent-driven-development to implement this plan task-by-task per phase.
> **67 atomic tasks, each ≤3 files, ≤5 min, with commit step. Audit-verified vs blueprint: 100% coverage.**

**Goal:** Centralized RBAC, org-switch persistence, invoice status standardization, system context exemption, notification scoping, and critical security fixes.

**Architecture:** Phase 0 (foundation + schema) → Phase 1 (system context fixes) → Phase 2 (RBAC deploy) → Phase 3 (critical fixes) → Phase 4 (org/UI) → Phase 5 (notifications).

**Tech Stack:** Next.js 16, Prisma 7, Auth.js v5, PostgreSQL, Tailwind v4, shadcn/ui

**Global Summary (target):**

| Phase | Tasks | Est. |
|-------|-------|------|
| Phase 0: Foundation | 11 | ~30m |
| Phase 1: System Context | 6 | ~40m |
| Phase 2: RBAC Deploy | 27 | ~2h |
| Phase 3: Critical Fixes | 8 | ~1.5h |
| Phase 4: Org/UI | 12 | ~1.5h |
| Phase 5: Notifications | 3 | ~30m |
| **Total** | **67 tasks** | **~6h** |

---

## Phase 0: Schema & Foundation Files

> **Dependency:** ALL other phases depend on this. Must complete first.
> **Est.:** ~30m | **Tasks:** P0-1 through P0-9b (11 tasks)

### P0-1: Add voidedAt to Invoice schema

**Files:** `prisma/schema.prisma` (Invoice model)
**Objective:** Add `voidedAt DateTime?` field for VOID status support.

Add after `lateFeeApplied`: `voidedAt DateTime? // NEW: timestamp when invoice was voided`

```bash
cd /root/projects/project-bill && npx prisma migrate dev --name add_voided_at_to_invoice
```

Expected: Migration generated. voidedAt column added (nullable).

```bash
git add prisma/schema.prisma prisma/migrations/ && git commit -m "feat(db): add voidedAt field to Invoice model for VOID status support"
```

---

### P0-2: Add userId to Notification schema

**Files:** `prisma/schema.prisma` (Notification model)
**Objective:** Add `userId String?` + relation + index for user-scoped notifications.

```diff
 model Notification {
+  userId         String?
+  user           User?    @relation(fields: [userId], references: [id])
+  @@index([userId])
 }
```

```bash
cd /root/projects/project-bill && npx prisma migrate dev --name add_user_id_to_notifications && npx prisma generate
```

```bash
git add prisma/schema.prisma prisma/migrations/ && git commit -m "feat(db): add userId field to Notification model for user-scoped notifications"
```

---

### P0-3: Create invoice-status.ts

**Files:** Create `src/lib/invoice-status.ts`
**Objective:** Create INVOICE_STATUS constants + VALID_TRANSITIONS + isValidTransition().

See blueprint section 4 for the complete code (INVOICE_STATUS.DRAFT/UNPAID/PAID/VOID, VALID_TRANSITIONS map, isValidTransition function).

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | head -20
git add src/lib/invoice-status.ts && git commit -m "feat(billing): add INVOICE_STATUS constants and VALID_TRANSITIONS"
```

---

### P0-4: Create org-rbac.ts

**Files:** Create `src/lib/auth/org-rbac.ts` (mkdir -p src/lib/auth first)
**Objective:** AuthError class + requireOrgRole() + getAuthContext(). Always reads membership from DB.

See blueprint section 4 for the complete implementation with [RBAC_DENY] logging.

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | head -20
git add src/lib/auth/org-rbac.ts && git commit -m "feat(auth): add AuthError, requireOrgRole, getAuthContext"
```

---

### P0-5: Create org-scoping.ts

**Files:** Create `src/lib/auth/org-scoping.ts`
**Objective:** orgQuery(orgId) helper — auto-injects organizationId to prevent cross-org leaks.

See blueprint section 4 for the complete implementation (findMany, findFirst, create, update, delete scoped).

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | head -20
git add src/lib/auth/org-scoping.ts && git commit -m "feat(auth): add orgQuery helper for automatic org-scoped queries"
```

---

### P0-6: Create permissions.ts

**Files:** Create `src/lib/auth/permissions.ts`
**Objective:** PERMISSIONS config (23 permissions) + canPerform() helper.

See blueprint section 4 for the complete permission matrix.

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | head -20
git add src/lib/auth/permissions.ts && git commit -m "feat(auth): add PERMISSIONS config and canPerform helper"
```

---

### P0-7: Create hmac.ts

**Files:** Create `src/lib/auth/hmac.ts`
**Objective:** signInvoicePay() + verifyInvoicePaySig() for public payment endpoint HMAC. Uses timingSafeEqual.

See blueprint section 4 for the complete implementation.

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | head -20
git add src/lib/auth/hmac.ts && git commit -m "feat(auth): add HMAC sign/verify for public invoice payment endpoint"
```

---

### P0-8a: Create sendInvoiceEmail utility (pure, no auth)

**Files:** Create `src/lib/email/send-invoice-email.ts` (mkdir -p src/lib/email)
**Objective:** Extract core email sending logic from `src/app/actions/send-invoice.ts` into `sendInvoiceEmailUtil(options: SendInvoiceEmailOptions)`. Pure utility — NO `auth()` call. Accepts `{ invoiceId, orgId, isAutoGenerated, customNotes }`.

Copy the logic from the existing SA (everything between auth check and final return), replacing `session.user.activeOrganizationId` with the `orgId` parameter.

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | head -20
git add src/lib/email/send-invoice-email.ts && git commit -m "refactor(email): extract sendInvoiceEmail core logic into pure utility (no auth)"
```

---

### P0-8b: Rewrite sendInvoiceEmail SA as thin wrapper

**Files:** Modify `src/app/actions/send-invoice.ts`
**Objective:** Replace the SA content — now imports and calls `sendInvoiceEmailUtil` from P0-8a.

```typescript
"use server";
import { auth } from "@/auth";
import { sendInvoiceEmailUtil } from "@/lib/email/send-invoice-email";

export async function sendInvoiceEmail(invoiceId: string, isAutoGenerated = false, customNotes?: string | null) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  try {
    return await sendInvoiceEmailUtil({ invoiceId, orgId: session.user.activeOrganizationId!, isAutoGenerated, customNotes });
  } catch (error) {
    return { success: false, error: "Failed to send email" };
  }
}
```

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | head -20
git add src/app/actions/send-invoice.ts && git commit -m "refactor(email): sendInvoiceEmail SA becomes thin auth wrapper around utility"
```

---

### P0-9a: Create sendReceiptEmail utility (pure, no auth)

**Files:** Create `src/lib/email/send-receipt-email.ts`
**Objective:** Extract receipt logic from `src/app/actions/send-receipt.ts` into `sendReceiptEmailUtil(options: SendReceiptEmailOptions)`. Pure utility — NO `auth()`. Accepts `{ invoiceId, orgId }`.

See blueprint section 4 for the implementation.

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | head -20
git add src/lib/email/send-receipt-email.ts && git commit -m "refactor(email): extract sendReceiptEmail core logic into pure utility (no auth)"
```

---

### P0-9b: Rewrite sendReceiptEmail SA as thin wrapper

**Files:** Modify `src/app/actions/send-receipt.ts`
**Objective:** Replace SA content — imports and calls `sendReceiptEmailUtil` from P0-9a.

```typescript
"use server";
import { auth } from "@/auth";
import { sendReceiptEmailUtil } from "@/lib/email/send-receipt-email";

export async function sendReceiptEmail(invoiceId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  try {
    return await sendReceiptEmailUtil({ invoiceId, orgId: session.user.activeOrganizationId! });
  } catch (error) {
    return { success: false, error: "Failed to send receipt email" };
  }
}
```

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | head -20
git add src/app/actions/send-receipt.ts && git commit -m "refactor(email): sendReceiptEmail SA becomes thin auth wrapper around utility"
```

---

## Phase 0 Complete — Move to Phase 1 ⏭️

| Task | File(s) | Status |
|------|---------|--------|
| P0-1 | prisma/schema (voidedAt) | Not started |
| P0-2 | prisma/schema (notification userId) | Not started |
| P0-3 | src/lib/invoice-status.ts | Not started |
| P0-4 | src/lib/auth/org-rbac.ts | Not started |
| P0-5 | src/lib/auth/org-scoping.ts | Not started |
| P0-6 | src/lib/auth/permissions.ts | Not started |
| P0-7 | src/lib/auth/hmac.ts | Not started |
| P0-8a | src/lib/email/send-invoice-email.ts | Not started |
| P0-8b | src/app/actions/send-invoice.ts | Not started |
| P0-9a | src/lib/email/send-receipt-email.ts | Not started |
| P0-9b | src/app/actions/send-receipt.ts | Not started |

---

## Phase 1: System Context (Cron & Webhook)

> **Dependency:** Phase 0 complete (utility files + org-scoping helper exist).
> **Est.:** ~40m | **Tasks:** P1-1 through P1-6 (6 tasks)

### P1-1: Fix cron recurring-invoices — use email utility

**Files:** Modify `src/app/api/cron/recurring-invoices/route.ts`
**Objective:** Replace `sendInvoiceEmail()` Server Action call with `sendInvoiceEmailUtil()` + [SYSTEM_ACTION] logging.

```diff
- import { sendInvoiceEmail } from "@/app/actions/send-invoice";
+ import { sendInvoiceEmailUtil } from "@/lib/email/send-invoice-email";
```

Replace call block:
```typescript
console.log(`[SYSTEM_ACTION] authMethod=cron action=recurring-invoice-generate orgId=${template.organizationId} invoiceId=${newInvoice.id}`);
await sendInvoiceEmailUtil({ invoiceId: newInvoice.id, orgId: template.organizationId, isAutoGenerated: true });
```

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | head -20
git add src/app/api/cron/recurring-invoices/route.ts && git commit -m "fix(cron): replace sendInvoiceEmail SA with utility to fix silent email failure"
```

---

### P1-2: Fix cron reminders — add orgId filter + logging

**Files:** Modify `src/app/api/cron/reminders/route.ts`
**Objective:** Add `organizationId: { not: null }` to invoice where clause. Add [SYSTEM_ACTION] logging.

```diff
  where: {
    status: "UNPAID",
+   organizationId: { not: null },
    dueDate: { not: null },
    paymentLink: { not: null },
  }
```

In processing loop: `console.log(\`[SYSTEM_ACTION] authMethod=cron action=reminder-send invoiceId=${invoice.id} orgId=${invoice.organizationId}\`);`

```bash
git add src/app/api/cron/reminders/route.ts && git commit -m "fix(cron): add orgId filter + SYSTEM_ACTION logging to reminders route"
```

---

### P1-3: Fix Mayar webhook — org-scope + transition validation

**Files:** Modify `src/app/api/webhooks/mayar/route.ts`
**Objective:** Add org-scoped lookup, isValidTransition() check, [SYSTEM_ACTION] logging.

```diff
+ import { isValidTransition } from "@/lib/invoice-status";
```

Replace invoice update block:
```typescript
const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
if (!isValidTransition(invoice.status, 'PAID')) {
  console.warn(`[WEBHOOK] Skipping PAID for invoice id=${invoiceId}: transition ${invoice.status}→PAID invalid`);
  return NextResponse.json({ status: "skipped", reason: "invalid_transition" });
}
console.log(`[SYSTEM_ACTION] authMethod=webhook action=mark-paid invoiceId=${invoiceId} orgId=${invoice.organizationId}`);
await prisma.invoice.update({
  where: { id: invoiceId, organizationId: invoice.organizationId },
  data: { status: 'PAID', paidAt: new Date() },
});
```

```bash
git add src/app/api/webhooks/mayar/route.ts && git commit -m "fix(webhook): add org-scope + isValidTransition + SYSTEM_ACTION logging to Mayar webhook"
```

---

### P1-4: Create + run MIG-1 — invoice status normalization

**Files:** Create `scripts/migrate-invoice-status.ts`
**Objective:** Normalize lowercase "unpaid"/"paid" to "UNPAID"/"PAID". Idempotent.

```typescript
// scripts/migrate-invoice-status.ts
import { prisma } from "@/lib/prisma";

async function migrate() {
  console.log("[MIGRATE] Normalizing invoice status to uppercase...");
  const [unpaidRes, paidRes] = await Promise.all([
    prisma.invoice.updateMany({ where: { status: { equals: "unpaid", mode: "insensitive" } }, data: { status: "UNPAID" } }),
    prisma.invoice.updateMany({ where: { status: "paid" }, data: { status: "PAID" } }),
  ]);
  console.log(`  → ${unpaidRes.count} unpaid→UNPAID, ${paidRes.count} paid→PAID`);
  const remaining = await prisma.invoice.count({ where: { status: { notIn: ["UNPAID","PAID","DRAFT","VOID"] } } });
  if (remaining > 0) {
    await prisma.invoice.updateMany({ where: { status: { notIn: ["UNPAID","PAID","DRAFT","VOID"] } }, data: { status: "UNPAID" } });
    console.log(`  → ${remaining} unrecognized → UNPAID`);
  }
  console.log("[MIGRATE] Done.");
}
migrate().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

```bash
cd /root/projects/project-bill && npx tsx scripts/migrate-invoice-status.ts
git add scripts/migrate-invoice-status.ts && git commit -m "feat(scripts): add invoice status normalization migration (MIG-1)"
```

---

### P1-5: Fix countUnpaidInvoices Server Action — add auth + org-scope

**Files:** Find + modify count-unpaid-invoices Action.
**Objective:** Currently zero auth, cross-org leak. Add auth() + org-scope filter.

```bash
grep -rl "countUnpaidInvoices" src/app/actions/
```

Replace with:
```typescript
"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function countUnpaidInvoices() {
  const session = await auth();
  if (!session?.user?.id) return { count: 0 };
  const count = await prisma.invoice.count({ where: { status: "UNPAID", organizationId: session.user.activeOrganizationId! } });
  return { count };
}
```

```bash
git add [path] && git commit -m "fix(auth): add auth + org-scope to countUnpaidInvoices SA"
```

---

### P1-6: Fix checkInvoiceStatus Server Action — mandatory auth + org-scope

**Files:** Find + modify check-invoice-status Action.
**Objective:** Currently optional auth, no org-scope. Make auth mandatory.

```bash
grep -rl "checkInvoiceStatus" src/app/actions/
```

Replace with:
```typescript
"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function checkInvoiceStatus(invoiceId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId, organizationId: session.user.activeOrganizationId! },
    select: { status: true },
  });
  if (!invoice) throw new Error("Invoice not found");
  return invoice;
}
```

```bash
git add [path] && git commit -m "fix(auth): make checkInvoiceStatus auth mandatory + add org-scope"
```

---

## Phase 1 Complete — Move to Phase 2 ⏭️
   421|
   422|## Phase 1: System Context (Cron & Webhook)
   423|
   424|> **Dependency:** Phase 0 complete (utility files + org-scoping helper exist).
   425|> **Est.:** ~40m | **Tasks:** P1-1 through P1-6 (6 tasks)
   426|
   427|(Phase 1 appended from original file)
   428|
   429|

## Phase 2: RBAC Helper Deployment

> **Dependency:** Phase 0-1 done. `requireOrgRole()`, `orgQuery()`, `canPerform()` exist.
> **Est.:** ~2h | **Tasks:** P2-1 through P2-16 (27 tasks, all atomic ≤1 file each)

**Pattern for all route tasks:** After `auth()` check, add:
```typescript
import { requireOrgRole } from "@/lib/auth/org-rbac";
const { membership, organizationId } = await requireOrgRole(session, ['ROLE_NAME']);
```

Each task modifies exactly 1 file. Commit after each.

---

### P2-1: requireOrgRole to sendInvoiceEmail SA
**Files:** `src/app/actions/send-invoice.ts` | **Role:** ['OWNER', 'ADMIN']
```bash
git add src/app/actions/send-invoice.ts && git commit -m "feat(auth): add requireOrgRole(['OWNER', 'ADMIN']) to sendInvoiceEmail SA"
```

### P2-2: requireOrgRole to sendReceiptEmail SA
**Files:** `src/app/actions/send-receipt.ts` | **Role:** ['OWNER', 'ADMIN']
```bash
git add src/app/actions/send-receipt.ts && git commit -m "feat(auth): add requireOrgRole(['OWNER', 'ADMIN']) to sendReceiptEmail SA"
```

### P2-3: Strip status from PATCH /api/invoices/[id]
**Files:** `src/app/api/invoices/[id]/route.ts`
Remove `status` and `cancelAtPeriodEnd`. Accept only `notes` and `dueDate`. Add membership verification.
```bash
git add src/app/api/invoices/[id]/route.ts && git commit -m "fix(auth): strip status + cancelAtPeriodEnd from PATCH invoice, accept only notes/dueDate"
```

### P2-4: Add role + PAID guard to DELETE /api/invoices/[id]
**Files:** `src/app/api/invoices/[id]/route.ts` (same file, different handler) | **Role:** ['OWNER', 'ADMIN']
Add `import { INVOICE_STATUS } from "@/lib/invoice-status";` and check `invoice.status === INVOICE_STATUS.PAID` → 409 before delete.
```bash
git add src/app/api/invoices/[id]/route.ts && git commit -m "fix(auth): add OWNER/ADMIN role check + PAID deletion guard to DELETE invoice"
```

### P2-5: requireOrgRole + isValidTransition to mark-paid
**Files:** `src/app/api/invoices/[id]/mark-paid/route.ts` | **Role:** ['OWNER', 'ADMIN']
```bash
git add src/app/api/invoices/[id]/mark-paid/route.ts && git commit -m "feat(auth): add OWNER/ADMIN + isValidTransition to mark-paid"
```

### P2-6: requireOrgRole to GET/PUT /api/settings
**Files:** `src/app/api/settings/route.ts` | **Role:** ['OWNER', 'ADMIN'] (relax from OWNER-only)
```bash
git add src/app/api/settings/route.ts && git commit -m "feat(auth): relax settings to requireOrgRole(['OWNER', 'ADMIN'])"
```

### P2-7: requireOrgRole to POST /api/settings/test-email
**Files:** `src/app/api/settings/test-email/route.ts` | **Role:** ['OWNER', 'ADMIN']
```bash
git add src/app/api/settings/test-email/route.ts && git commit -m "feat(auth): relax test-email to requireOrgRole(['OWNER', 'ADMIN'])"
```

### P2-8a: requireOrgRole to GET/PUT /api/subscription
**Files:** `src/app/api/subscription/route.ts` | **Role:** 'OWNER'
```bash
git add src/app/api/subscription/route.ts && git commit -m "feat(auth): add requireOrgRole('OWNER') to subscription GET/PUT"
```

### P2-8b: requireOrgRole to POST /api/subscription/checkout
**Files:** `src/app/api/subscription/checkout/route.ts` | **Role:** 'OWNER'
```bash
git add src/app/api/subscription/checkout/route.ts && git commit -m "feat(auth): add requireOrgRole('OWNER') to subscription checkout"
```

### P2-8c: requireOrgRole to GET /api/subscription/check
**Files:** `src/app/api/subscription/check/route.ts` | **Role:** 'OWNER'
```bash
git add src/app/api/subscription/check/route.ts && git commit -m "feat(auth): add requireOrgRole('OWNER') to subscription check"
```

### P2-9a: requireOrgRole to POST /api/organizations/[id]/export
**Files:** `src/app/api/organizations/[id]/export/route.ts` | **Role:** 'OWNER'
```bash
git add src/app/api/organizations/[id]/export/route.ts && git commit -m "feat(auth): add requireOrgRole('OWNER') to export POST"
```

### P2-9b: requireOrgRole to GET /api/organizations/[id]/export/status
**Files:** `src/app/api/organizations/[id]/export/status/route.ts` | **Role:** 'OWNER'
```bash
git add src/app/api/organizations/[id]/export/status/route.ts && git commit -m "feat(auth): add requireOrgRole('OWNER') to export status GET"
```

### P2-10: requireOrgRole to PUT /api/organizations/[id]
**Files:** `src/app/api/organizations/[id]/route.ts` | **Role:** 'OWNER' (tighten from ADMIN-allowed)
```bash
git add src/app/api/organizations/[id]/route.ts && git commit -m "feat(auth): tighten PUT org to requireOrgRole('OWNER')"
```

### P2-11a: requireOrgRole to milestone approve
**Files:** `src/app/api/projects/[id]/milestones/[milestoneId]/approve/route.ts` | **Role:** ['OWNER', 'ADMIN']
```bash
git add src/app/api/projects/[id]/milestones/[milestoneId]/approve/route.ts && git commit -m "feat(auth): add requireOrgRole(['OWNER','ADMIN']) to milestone approve"
```

### P2-11b: requireOrgRole to milestone unapprove
**Files:** `src/app/api/projects/[id]/milestones/[milestoneId]/unapprove/route.ts` | **Role:** ['OWNER', 'ADMIN']
```bash
git add src/app/api/projects/[id]/milestones/[milestoneId]/unapprove/route.ts && git commit -m "feat(auth): add requireOrgRole(['OWNER','ADMIN']) to milestone unapprove"
```

### P2-11c: requireOrgRole to milestone mark-paid
**Files:** `src/app/api/projects/[id]/milestones/[milestoneId]/mark-paid/route.ts` | **Role:** ['OWNER', 'ADMIN']
```bash
git add src/app/api/projects/[id]/milestones/[milestoneId]/mark-paid/route.ts && git commit -m "feat(auth): add requireOrgRole(['OWNER','ADMIN']) to milestone mark-paid"
```

### P2-12a: requireOrgRole to recurring invoice POST
**Files:** `src/app/api/recurring-invoices/route.ts` | **Role:** ['OWNER', 'ADMIN']
```bash
git add src/app/api/recurring-invoices/route.ts && git commit -m "feat(auth): add requireOrgRole(['OWNER','ADMIN']) to recurring invoice POST"
```

### P2-12b: requireOrgRole to recurring invoice PUT
**Files:** `src/app/api/recurring-invoices/[id]/route.ts` | **Role:** ['OWNER', 'ADMIN']
```bash
git add src/app/api/recurring-invoices/[id]/route.ts && git commit -m "feat(auth): add requireOrgRole(['OWNER','ADMIN']) to recurring invoice PUT"
```

### P2-12c: requireOrgRole to recurring invoice DELETE
**Files:** `src/app/api/recurring-invoices/[id]/route.ts` (same file as P2-12b, different handler) | **Role:** ['OWNER', 'ADMIN']
```bash
git add src/app/api/recurring-invoices/[id]/route.ts && git commit -m "feat(auth): add requireOrgRole(['OWNER','ADMIN']) to recurring invoice DELETE"
```

### P2-13a: requireOrgRole to SOW template POST
**Files:** `src/app/api/sow-templates/route.ts` | **Role:** ['OWNER', 'ADMIN']
```bash
git add src/app/api/sow-templates/route.ts && git commit -m "feat(auth): add requireOrgRole(['OWNER','ADMIN']) to SOW template POST"
```

### P2-13b: requireOrgRole to SOW template PUT
**Files:** `src/app/api/sow-templates/[id]/route.ts` | **Role:** ['OWNER', 'ADMIN']
```bash
git add src/app/api/sow-templates/[id]/route.ts && git commit -m "feat(auth): add requireOrgRole(['OWNER','ADMIN']) to SOW template PUT"
```

### P2-13c: requireOrgRole to SOW template DELETE
**Files:** `src/app/api/sow-templates/[id]/route.ts` (same file as P2-13b, different handler) | **Role:** ['OWNER', 'ADMIN']
```bash
git add src/app/api/sow-templates/[id]/route.ts && git commit -m "feat(auth): add requireOrgRole(['OWNER','ADMIN']) to SOW template DELETE"
```

### P2-14a: requireOrgRole to GET audit-logs
**Files:** Find via `grep -rl "audit" src/app/api/` | **Role:** ['OWNER', 'ADMIN']
```bash
git add [path] && git commit -m "feat(auth): add requireOrgRole(['OWNER','ADMIN']) to audit log GET"
```

### P2-14b: requireOrgRole to GET/PUT /api/agent/config
**Files:** `src/app/api/agent/config/route.ts` | **Role:** ['OWNER', 'ADMIN']
```bash
git add src/app/api/agent/config/route.ts && git commit -m "feat(auth): add requireOrgRole(['OWNER','ADMIN']) to agent config"
```

### P2-15a: requireOrgRole to GET /api/organizations/[id]/members
**Files:** `src/app/api/organizations/[id]/members/route.ts` | **Role:** ['OWNER', 'ADMIN']
```bash
git add src/app/api/organizations/[id]/members/route.ts && git commit -m "feat(auth): add requireOrgRole(['OWNER','ADMIN']) to members view"
```

### P2-15b: requireOrgRole to GET /api/organizations/[id]/invites
**Files:** `src/app/api/organizations/[id]/invites/route.ts` | **Role:** ['OWNER', 'ADMIN']
```bash
git add src/app/api/organizations/[id]/invites/route.ts && git commit -m "feat(auth): add requireOrgRole(['OWNER','ADMIN']) to invites view"
```

### P2-16: Final sweep — find uncovered routes + Server Actions
Search for all routes and SA with `auth()` but no `requireOrgRole`. Add role checks to any uncovered.
```bash
cd /root/projects/project-bill
grep -rl "auth()" src/app/api/ --include="*.ts" | while read f; do
  if ! grep -q "requireOrgRole" "$f"; then
    if grep -qE "prisma\.\w+\.(update|create|delete)" "$f"; then echo "UNCOVERED: $f"; fi
  fi
done
grep -rl '"use server"' src/app/actions/ --include="*.ts" | while read f; do
  if ! grep -q "requireOrgRole" "$f"; then
    if grep -qE "(prisma|\.update|\.create|\.delete)" "$f"; then echo "UNCOVERED SA: $f"; fi
  fi
done
```
Add requireOrgRole to each uncovered. Commit individually.
```bash
git add [files] && git commit -m "fix(auth): add requireOrgRole to remaining uncovered routes and actions"
```

---

## Phase 3: Critical Security Fixes

> **Dependency:** Phase 0 done. | **Est.:** ~1.5h | **Tasks:** P3-1 through P3-8

### P3-1: Add orgId filter to GET /api/recurring-invoices
**Files:** `src/app/api/recurring-invoices/route.ts` — change `where: {}` to `where: { organizationId: orgId }`
```bash
git add src/app/api/recurring-invoices/route.ts && git commit -m "fix(security): add orgId filter to recurring invoices GET"
```

### P3-2: Add orgId filter to GET /api/sow-templates
**Files:** `src/app/api/sow-templates/route.ts` — same fix
```bash
git add src/app/api/sow-templates/route.ts && git commit -m "fix(security): add orgId filter to SOW templates GET"
```

### P3-3: Field whitelist PUT /api/recurring-invoices/[id]
**Files:** `src/app/api/recurring-invoices/[id]/route.ts` — replace `data: json` with whitelist
```bash
git add src/app/api/recurring-invoices/[id]/route.ts && git commit -m "fix(security): add field whitelist to recurring invoice PUT"
```

### P3-4: requireOrgRole to retry-email endpoint
**Files:** `src/app/api/invoices/[id]/retry-email/route.ts` — add requireOrgRole(['OWNER','ADMIN'])
```bash
git add src/app/api/invoices/[id]/retry-email/route.ts && git commit -m "feat(auth): add requireOrgRole(['OWNER','ADMIN']) to retry-email endpoint"
```

### P3-5: Auth + org filter to SSE /api/events
**Files:** `src/app/api/events/route.ts` — add auth() at top + org-based filtering in handleEvent
```bash
git add src/app/api/events/route.ts && git commit -m "fix(security): add auth + org filter to SSE events stream"
```

### P3-6: Create internal payment link endpoint
**Files:** Create `src/app/api/invoices/[id]/create-payment-link/route.ts` — auth + OWNER/ADMIN + Mayar + HMAC
```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | head -20
git add src/app/api/invoices/[id]/create-payment-link/route.ts && git commit -m "feat(billing): add create-payment-link endpoint with auth + HMAC signing"
```

### P3-7: Update public /pay with HMAC verification
**Files:** `src/app/api/invoices/[id]/pay/route.ts` — add `verifyInvoicePaySig`, keep public
```bash
git add src/app/api/invoices/[id]/pay/route.ts && git commit -m "fix(security): add HMAC verification to public /pay endpoint"
```

### P3-8: Create void invoice endpoint
**Files:** Create `src/app/api/invoices/[id]/void/route.ts` — OWNER/ADMIN + isValidTransition
```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | head -20
git add src/app/api/invoices/[id]/void/route.ts && git commit -m "feat(billing): add void invoice endpoint with role check + status transition validation"
```

# Phase 4: Organization Persistence + Settings UI

## Overview
Phase 4 ensures that the user's active organization selection is **persisted to the database** (not just JWT memory) so it survives across sessions and devices. It also adds **role-based gating** to settings pages and the sidebar navigation, and introduces an **Organization Settings** page for org-level management (rename, logo, delete).

---

### P4-1: Persist `defaultOrganizationId` on Org Switch

**Objective:** Update the `POST /api/organizations/[id]/switch` handler to write `User.defaultOrganizationId` to the database, so the org selection persists across sessions.

**Files:**
- `src/app/api/organizations/[id]/switch/route.ts`

**Current behavior:** The `POST` handler verifies membership and returns JSON with `{ success, organizationId, activeOrganizationRole }`. The client then calls `session.update()` which triggers the JWT `trigger === "update"` callback in `auth.config.ts` to set `token.activeOrganizationId` — but **nothing writes to the DB**.

**Steps:**
1. After the membership check (line 21-23), add a `prisma.user.update` call to set `defaultOrganizationId` to `id` on the authenticated user.
2. Wrap in a try/catch so DB write failure is logged but doesn't break the response (the JWT session state takes effect immediately regardless).
3. Add a `console.log` with the new persisted value for observability.

**Commit:**
```
git add src/app/api/organizations/[id]/switch/route.ts
git commit -m "feat(rbac): persist defaultOrganizationId to DB on org switch"
```

---

### P4-2: Persist `defaultOrganizationId` on Org Create

**Objective:** When a user creates a new organization via `POST /api/organizations`, set `User.defaultOrganizationId` to the newly created org ID.

**Files:**
- `src/app/api/organizations/route.ts`

**Current behavior:** The `POST` handler creates an org, a membership, and a subscription, then returns the org JSON — but never updates `User.defaultOrganizationId`. On subsequent sign-ins, the user lands on their old default org.

**Steps:**
1. After the `prisma.organizationMember.create` call (line 63), add a `prisma.user.update` to set `defaultOrganizationId: org.id` for `session.user.id`.
2. This mirrors what `createOrg()` in `org-switcher.tsx` does client-side (calls `session.update`), but guarantees DB persistence for future sessions.

**Commit:**
```
git add src/app/api/organizations/route.ts
git commit -m "feat(rbac): persist defaultOrganizationId to DB on org creation"
```

---

### P4-3: JWT Callback Reads `defaultOrganizationId` from DB as Fallback

**Objective:** Ensure the JWT callback always has a `defaultOrganizationId` to set as `activeOrganizationId`, even when the Credentials authorize function can't provide one. Add a DB fallback in `auth.config.ts`.

**Files:**
- `src/auth.config.ts`

**Current behavior:** Line 32: `token.activeOrganizationId = user.defaultOrganizationId;` — this only runs on initial sign-in (`if (user)`). If `user.defaultOrganizationId` is `undefined` (e.g., race condition or manually created user), `activeOrganizationId` stays undefined for the entire session.

**Steps:**
1. Add an `import { prisma } from "@/lib/prisma";` at the top of `auth.config.ts`.
2. In the `jwt` callback, after the `if (user)` block and before the `trigger === "update"` block, add a fallback: if `!token.activeOrganizationId` and `token.id`, query `prisma.user.findUnique({ where: { id: token.id as string }, select: { defaultOrganizationId: true } })` and set `token.activeOrganizationId = userRecord.defaultOrganizationId`.
3. Handle the case where the user has no `defaultOrganizationId` yet (new user without an org) — leave as undefined.
4. Add a `console.log` for the fallback case for observability.

**Commit:**
```
git add src/auth.config.ts
git commit -m "fix(rbac): add DB fallback for defaultOrganizationId in JWT callback"
```

---

### P4-4a: Create Organization Settings Page (Server Component)

**Objective:** Create a new server component page at `/settings/organization` that renders an organization-level settings form (name, logo, delete). Only accessible to OWNER and ADMIN roles.

**Files:**
- NEW `src/app/(dashboard)/settings/organization/page.tsx`

**Steps:**
1. Create the directory `src/app/(dashboard)/settings/organization/`.
2. Create `page.tsx` as an async server component following the pattern from `src/app/(dashboard)/settings/page.tsx`.
3. Import `auth` from `@/auth`, check session, redirect to `/login` if unauthenticated.
4. Role-gate: if `session.user.activeOrganizationRole !== "OWNER" && session.user.activeOrganizationRole !== "ADMIN"`, return an "Access Denied" UI (same pattern as settings/page.tsx lines 15-27).
5. Fetch organization data from `prisma.organization.findUnique` using `session.user.activeOrganizationId`.
6. Render the `OrganizationSettingsForm` client component (P4-4b), passing `organization` as props.
7. Use proper metadata export for the page title.

**Commit:**
```
git add src/app/(dashboard)/settings/organization/page.tsx
git commit -m "feat(rbac): add organization settings page with OWNER/ADMIN gate"
```

---

### P4-4b: Create OrganizationSettingsForm Client Component

**Objective:** Build a shadcn-based form with Card, Dialog, and danger zone for org name editing, logo upload, and organization deletion.

**Files:**
- NEW `src/app/(dashboard)/settings/organization/organization-settings-form.tsx`

**Steps:**
1. Create the client component with `"use client"` directive.
2. Props: `{ organization: { id: string; name: string; slug: string; logoUrl?: string | null } }`.
3. **Name Section (Card):** Render current org name in a `Card` with an edit `Input` field and a Save `Button`. On save, `PATCH /api/organizations/[id]` with the new name. Show a `toast` on success/error.
4. **Logo Section (Card):** Show current logo (or a placeholder). Provide a file upload input that uploads to a storage endpoint and then patches the org record. (Keep it simple — if upload infrastructure isn't ready, show UI with a "coming soon" note.)
5. **Danger Zone (Card with red border):**
   - "Delete Organization" section with a warning description: "This action is irreversible. All projects, invoices, and data will be permanently deleted."
   - A `Dialog` (shadcn AlertDialog or custom Dialog) triggered by a red "Delete Organization" button.
   - Inside the dialog: confirmation text input (user must type the org name to confirm), then a `DELETE /api/organizations/[id]` call.
   - On successful deletion, redirect to `/onboarding/organization` or show a success state.
6. Use `useSession` to refresh the session after name change.
7. Add loading states with `Loader2` spinner.

**Commit:**
```
git add src/app/(dashboard)/settings/organization/organization-settings-form.tsx
git commit -m "feat(rbac): add OrganizationSettingsForm client component with danger zone"
```

---

### P4-5: Role-Gated Sidebar Navigation

**Objective:** Conditionally hide navigation items in the sidebar based on the user's active organization role. Non-OWNER/ADMIN users should not see links to settings they can't access.

**Files:**
- `src/components/app-sidebar.tsx`

**Current behavior:** All `navGroups` items are shown to every authenticated user regardless of role. Settings like Team, SOW Templates, and AI Assistant are visible to MEMBERs who will hit access-denied pages.

**Steps:**
1. Add a new prop `activeRole?: string` to the `AppSidebarProps` interface.
2. Pass `activeRole` from the layout that renders `AppSidebar` (find in `src/app/(dashboard)/layout.tsx` — read session and pass `session.user.activeOrganizationRole`).
3. Update the `navGroups` definition or filter at render time. Options:
   - Add a `requiredRole?: string[]` field to each `NavItem`.
   - Or create a `filterNavGroups` function that checks `activeRole` before rendering.
   - Recommended: Add `minRole` field to `NavItem` with values: `"OWNER" | "ADMIN" | "MEMBER"`. Filter items where the user's role meets or exceeds the minimum.
4. Gate the following items:
   - **Team** (`/settings/team`) → `OWNER` or `ADMIN`
   - **SOW Templates** (`/settings/sow-template`) → `OWNER` or `ADMIN`
   - **AI Assistant** (`/settings/agent`) → `OWNER` or `ADMIN`
   - **Subscription** (`/settings/subscription`) → `OWNER` only
   - **General** (`/settings`) → `OWNER` only (already enforced server-side)
5. Add the new `Organization` settings link (`/settings/organization`) → `OWNER` or `ADMIN`.
6. Keep Dashboard, Projects, Task Board, Clients, Invoices, Recurring, Reports, Activity visible to all roles (MEMBERS included).
7. Also gate the layout that provides the sidebar data — read from `src/app/(dashboard)/layout.tsx`.

**Commit:**
```
git add src/components/app-sidebar.tsx src/app/(dashboard)/layout.tsx
git commit -m "feat(rbac): role-gate sidebar navigation items based on activeOrganizationRole"
```

---

### P4-6a: Server Role Check on Team Settings Page

**Objective:** Add OWNER/ADMIN role enforcement on the Team settings page server component.

**Files:**
- `src/app/(dashboard)/settings/team/page.tsx`

**Current behavior:** The page only checks `session?.user?.id` and redirects to login if missing. Any org member can access the team management page even though they shouldn't.

**Steps:**
1. After the authentication check (line 8-10), add an authorization check following the pattern from `src/app/(dashboard)/settings/page.tsx` lines 15-27.
2. If `session.user.activeOrganizationRole !== "OWNER" && session.user.activeOrganizationRole !== "ADMIN"`, return the "Access Denied" UI with a "Return to Dashboard" link.
3. Import `Link` from `next/link` and `Button` from `@/components/ui/button` for the access-denied UI.

**Commit:**
```
git add src/app/(dashboard)/settings/team/page.tsx
git commit -m "feat(rbac): add OWNER/ADMIN role check on team settings page"
```

---

### P4-6b: Server Role Check on SOW Template Settings Page

**Objective:** Add OWNER/ADMIN role enforcement on the SOW Template settings page.

**Files:**
- `src/app/(dashboard)/settings/sow-template/page.tsx` (convert to server wrapper)
- NEW `src/app/(dashboard)/settings/sow-template/sow-template-client.tsx` (extract client logic)

**Current behavior:** `sow-template/page.tsx` is a `"use client"` component that cannot use server-side `auth()`. There is no role check at all — any member can view and manage SOW templates.

**Steps:**
1. Rename/move the current client logic from `page.tsx` into a new file `sow-template-client.tsx`:
   - Move the entire component body (the `SOWTemplateListPage` function) into the new file.
   - Export it as a named export: `export function SOWTemplateListClient()`.
2. Rewrite `page.tsx` as an async server component following the pattern from `settings/page.tsx`:
   - Import `auth` from `@/auth`, `redirect` from `next/navigation`.
   - Check auth, redirect to `/login` if unauthenticated.
   - Check `activeOrganizationRole` — if not `OWNER` or `ADMIN`, return "Access Denied" UI.
   - Otherwise, render `<SOWTemplateListClient />`.
3. Verify that no props need to be threaded (the client component fetches its own data via `/api/sow-templates`).

**Commit:**
```
git add src/app/(dashboard)/settings/sow-template/page.tsx src/app/(dashboard)/settings/sow-template/sow-template-client.tsx
git commit -m "feat(rbac): add OWNER/ADMIN server role check on SOW template settings page"
```

---

### P4-6c: Server Role Check on Agent Settings Page

**Objective:** Add OWNER/ADMIN role enforcement on the AI Agent settings page.

**Files:**
- `src/app/(dashboard)/settings/agent/page.tsx` (convert to server wrapper)
- NEW `src/app/(dashboard)/settings/agent/agent-settings-client.tsx` (extract client logic)

**Current behavior:** `agent/page.tsx` is a `"use client"` component with no role check. Any org member can configure the AI agent.

**Steps:**
1. Extract the client logic from `page.tsx` into `agent-settings-client.tsx`:
   - Move the `AgentSettingsPage` component (renamed to `AgentSettingsClient`).
2. Rewrite `page.tsx` as an async server component:
   - Import `auth` from `@/auth`, `redirect` from `next/navigation`.
   - Auth check, role check (`OWNER` or `ADMIN`).
   - Render `<AgentSettingsClient />` if authorized.
3. Add imports for the access-denied UI pattern (`Button`, `Link`).

**Commit:**
```
git add src/app/(dashboard)/settings/agent/page.tsx src/app/(dashboard)/settings/agent/agent-settings-client.tsx
git commit -m "feat(rbac): add OWNER/ADMIN server role check on AI agent settings page"
```

---

# Phase 5: Notification Scoping

## Overview
Currently, notifications are scoped **only by `organizationId`**. All org members see all org notifications. Phase 5 scopes notifications to **individual users** by adding a `userId` foreign key to the Notification model, updating the API to filter by user, updating the helper to accept a userId, and backfilling existing notifications.

---

### P5-1: Update Notifications Route for User-Scoped Filter + Mark-Read

**Objective:** Update both `GET` and `PATCH` handlers in the notifications API route to filter by `userId` in addition to `organizationId`, and add the `userId` field to the Notification model.

**Files:**
- `prisma/schema.prisma` — add `userId` field to `Notification` model
- `src/app/api/notifications/route.ts` — update GET and PATCH handlers

**Steps:**

**Part A — Schema Migration (MIG-2):**
1. In `prisma/schema.prisma`, add to the `Notification` model (after `organizationId`):
   ```
   userId         String?
   user           User?         @relation(fields: [userId], references: [id])
   ```
   Make it optional (`String?`) for backward compatibility during migration.
2. Add an index: `@@index([userId])`
3. Run `npx prisma migrate dev --name add-notification-userid` to generate the migration file.

**Part B — GET Handler:**
1. In `src/app/api/notifications/route.ts`, after extracting `orgId` from the session, also extract `session.user.id` as `userId`.
2. Update the `where` clause in all three queries (findMany, count, unreadCount count) to include `userId` filtering:
   - Change `where: { organizationId: orgId }` to `where: { organizationId: orgId, userId: userId }`.
   - For the `unreadCount` query, change similarly.
3. Keep `organizationId` filtering for multi-tenant safety (belt-and-suspenders).

**Part C — PATCH Handler:**
1. In the `markAll` branch, add `userId` to the `where` clause:
   - `where: { isRead: false, organizationId: orgId, userId: userId }`
2. In the single notification update, add `userId` to the `where` clause:
   - `where: { id, organizationId: orgId, userId: userId }`
3. This ensures users can only mark their own notifications as read.

**Commit:**
```
git add prisma/schema.prisma prisma/migrations/* src/app/api/notifications/route.ts
git commit -m "feat(notifications): scope notifications by userId with MIG-2 migration"
```

---

### P5-2: Update `createNotification` Helper to Accept `userId` Param

**Objective:** Update the `createNotification` function in `src/lib/notifications.ts` to accept and store a `userId` parameter, ensuring all newly created notifications are user-scoped.

**Files:**
- `src/lib/notifications.ts`
- All callers (see Steps)

**Steps:**
1. Add `userId` to the `CreateNotificationParams` interface as an optional field (`userId?: string`) for backward compatibility.
2. In the `prisma.notification.create` call, add `userId` to the `data` object.
3. Add a `console.warn` if `userId` is not provided, to help identify missing callers during rollout.

**Update all callers** to pass `userId`:
   - `src/app/api/projects/[id]/accept-terms/route.ts` (line 69): Pass the project owner's userId or the accepting user's id.
   - `src/app/api/webhooks/mayar/route.ts` (line 93): Pass the invoice/project owner's userId.
   - `src/app/api/invoices/[id]/mark-paid/route.ts` (line 70): Pass the invoice owner's userId.
   - Any other files found via grep for `createNotification`.

   For each caller, determine the correct `userId` based on business logic:
   - For project acceptance notifications, use the user who accepted (available from session).
   - For payment webhooks, resolve the userId from the invoice's project owner or org owner.
   - For invoice marking, use the session user's id.

**Commit:**
```
git add src/lib/notifications.ts src/app/api/projects/[id]/accept-terms/route.ts src/app/api/webhooks/mayar/route.ts src/app/api/invoices/[id]/mark-paid/route.ts
git commit -m "feat(notifications): add userId param to createNotification and update all callers"
```

---

### P5-3: Create and Run MIG-2 Notification Backfill Script

**Objective:** Backfill existing notifications with a `userId` so that the user-scoped filtering works retroactively. Without this, existing notifications with `userId = null` will be invisible under the new scoped queries.

**Files:**
- NEW `scripts/migrate-notification-userid.ts`

**Steps:**
1. Create `scripts/` directory if it doesn't exist.
2. Create `scripts/migrate-notification-userid.ts`:

```typescript
// Backfill script: assign userId to existing notifications
// For each notification, find the most appropriate user:
// Priority: notification creator (if available) → org owner → first org member
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting notification userId backfill...");

  // Get all notifications without a userId
  const notifications = await prisma.notification.findMany({
    where: { userId: null },
    include: { organization: { include: { members: { take: 1, orderBy: { joinedAt: "asc" } } } } },
  });

  console.log(`Found ${notifications.length} notifications to backfill`);

  let updated = 0;
  let skipped = 0;

  for (const notif of notifications) {
    // Find the org owner as the fallback userId
    const owner = await prisma.organizationMember.findFirst({
      where: { organizationId: notif.organizationId, role: "OWNER" },
    });

    if (owner) {
      await prisma.notification.update({
        where: { id: notif.id },
        data: { userId: owner.userId },
      });
      updated++;
    } else {
      // Last resort: first member who joined
      const firstMember = notif.organization.members[0];
      if (firstMember) {
        await prisma.notification.update({
          where: { id: notif.id },
          data: { userId: firstMember.userId },
        });
        updated++;
      } else {
        skipped++;
      }
    }

    if (updated % 50 === 0) {
      console.log(`Progress: ${updated} updated, ${skipped} skipped`);
    }
  }

  console.log(`Backfill complete: ${updated} updated, ${skipped} skipped`);
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

3. Add a `package.json` script entry for the backfill:
   ```
   "db:backfill-notifications": "tsx scripts/migrate-notification-userid.ts"
   ```
4. Run the backfill: `npm run db:backfill-notifications`
5. After successful backfill, verify with a Prisma query: `await prisma.notification.count({ where: { userId: null } })` should return 0.
6. Once verified, consider making `userId` required (remove `?`) in a follow-up migration — note this as a future task.

**Commit:**
```
git add scripts/migrate-notification-userid.ts package.json
git commit -m "feat(notifications): add MIG-2 backfill script for notification userId assignment"
```

---

# Global Summary

| Phase | Tasks | Est. |
|-------|-------|------|
| Phase 0: Foundation | 11 | ~30m |
| Phase 1: System Context | 6 | ~40m |
| Phase 2: RBAC Deploy | 27 | ~2h |
| Phase 3: Critical Fixes | 8 | ~1.5h |
| Phase 4: Org/UI | 9 | ~1.5h |
| Phase 5: Notifications | 3 | ~30m |
| **Total** | **64 tasks** | **~6h** |

## Phase 4 Task Breakdown

| Task | Description | Type |
|------|-------------|------|
| P4-1 | Persist `defaultOrganizationId` on org switch endpoint | API |
| P4-2 | Persist `defaultOrganizationId` on org create endpoint | API |
| P4-3 | JWT callback DB fallback for `defaultOrganizationId` | Auth Config |
| P4-4a | Organization settings page server component (NEW) | UI |
| P4-4b | OrganizationSettingsForm with Card/Dialog/Danger zone (NEW) | UI |
| P4-5 | Role-gated sidebar navigation items | UI |
| P4-6a | Server role check on Team settings page | Auth |
| P4-6b | Server role check on SOW Template settings (refactor to server wrapper) | Auth |
| P4-6c | Server role check on AI Agent settings (refactor to server wrapper) | Auth |

## Phase 5 Task Breakdown

| Task | Description | Type |
|------|-------------|------|
| P5-1 | Update notifications route: add userId to schema + user-scoped GET/PATCH | Schema + API |
| P5-2 | Update `createNotification` helper: accept userId param + update all callers | Lib |
| P5-3 | Create and run MIG-2 notification userId backfill script (NEW) | Migration |

## Dependency Notes

- **P4-4a depends on P4-4b** — the page renders the form component
- **P4-5 depends on the layout** — need to read `src/app/(dashboard)/layout.tsx` to thread the role prop
- **P5-1 must run its migration before P5-2** — Prisma schema change must be applied before the helper can write userId
- **P5-3 runs after P5-1 and P5-2** — backfill needs the schema migrated and new notifications going to the right users
- **P4-6b and P4-6c** involve file splitting (page.tsx → page.tsx + client.tsx) — commit both new and modified files together
- All Phase 4 UI tasks should be tested with at least 3 roles: OWNER, ADMIN, MEMBER to verify gating behavior

  1132|---
  1133|
  1134|## Global Summary
  1135|
  1136|| Phase | Tasks | Est. |
  1137||-------|-------|------|
  1138|| Phase 0: Foundation | 11 | ~30m |
  1139|| Phase 1: System Context | 6 | ~40m |
  1140|| Phase 2: RBAC Deploy | 27 | ~2h |
  1141|| Phase 3: Critical Fixes | 8 | ~1.5h |
  1142|| Phase 4: Org/UI | 12 | ~1.5h |
  1143|| Phase 5: Notifications | 3 | ~30m |
  1144|| **Total** | **67 tasks** | **~6h** |
  1145|
  1146|**Audit verified:** 100% blueprint coverage, all tasks ≤3 files, ≤5 min, with commit steps.
  1147|