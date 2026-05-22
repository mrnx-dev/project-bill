# Implementation Plan: Organization RBAC & Security

> **For Hermes:** Use subagent-driven-development to implement this plan task-by-task per phase.

**Goal:** Centralized RBAC, org-switch persistence, invoice status standardization, system context exemption, notification scoping, and critical security fixes.

**Architecture:** Phase 0 (foundation + schema) → Phase 1 (system context fixes) → Phase 2 (RBAC deploy) → Phase 3 (critical fixes) → Phase 4 (org/UI) → Phase 5 (notifications).

**Tech Stack:** Next.js 16, Prisma 7, Auth.js v5, PostgreSQL, Tailwind v4, shadcn/ui

---

## Phase 0: Schema & Foundation Files

> **Dependency:** ALL other phases depend on this. Must complete first.
> **Est.:** ~30m

### Task P0-1: Schema — Add voidedAt to Invoice

**Objective:** Add `voidedAt DateTime?` field to Invoice model for VOID status support.

**Files:**
- Modify: `prisma/schema.prisma` (Invoice model)

**Step 1: Edit schema**

In `prisma/schema.prisma`, find the Invoice model and add after the `lateFeeApplied` field:

```prisma
  voidedAt        DateTime?   // NEW: timestamp when invoice was voided
```

**Step 2: Generate and apply migration**

```bash
cd /root/projects/project-bill && npx prisma migrate dev --name add_voided_at_to_invoice
```

Expected: Migration generated and applied. `voidedAt` column added to Invoice table (nullable).

**Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ && git commit -m "feat(db): add voidedAt field to Invoice model for VOID status support"
```

---

### Task P0-2: Schema — Add userId to Notification

**Objective:** Add `userId String?` field + relation + index to Notification model for user-scoped notifications.

**Files:**
- Modify: `prisma/schema.prisma` (Notification model)

**Step 1: Edit schema**

In `prisma/schema.prisma`, find the Notification model and modify:

```diff
 model Notification {
   id             String       @id @default(uuid())
   title          String
   message        String
   type           String
   isRead         Boolean      @default(false)
   linkUrl        String?
   organizationId String
+  userId         String?
   createdAt      DateTime     @default(now())
   updatedAt      DateTime     @updatedAt
   organization   Organization  @relation(fields: [organizationId], references: [id])
+  user           User?         @relation(fields: [userId], references: [id])

   @@index([organizationId])
+  @@index([userId])
 }
```

**Step 2: Generate and apply migration**

```bash
cd /root/projects/project-bill && npx prisma migrate dev --name add_user_id_to_notifications
```

Expected: Migration generated. `userId` column added to Notification table (nullable).

**Step 3: Generate Prisma client**

```bash
cd /root/projects/project-bill && npx prisma generate
```

Expected: Prisma client regenerated with new fields/relations.

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ && git commit -m "feat(db): add userId field to Notification model for user-scoped notifications"
```

---

### Task P0-3: Create invoice-status.ts

**Objective:** Create `src/lib/invoice-status.ts` with `INVOICE_STATUS`, `VALID_TRANSITIONS`, and `isValidTransition()`.

**Files:**
- Create: `src/lib/invoice-status.ts`

**Step 1: Create the file**

```typescript
// src/lib/invoice-status.ts
export const INVOICE_STATUS = {
  DRAFT:  "DRAFT",
  UNPAID: "UNPAID",
  PAID:   "PAID",
  VOID:   "VOID",
} as const;

export type InvoiceStatus = typeof INVOICE_STATUS[keyof typeof INVOICE_STATUS];

export const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT:  ["UNPAID"],
  UNPAID: ["PAID", "VOID"],
  PAID:   ["VOID"],
  VOID:   [], // terminal state
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

**Step 2: Verify compilation**

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | grep -i "invoice-status" || echo "No errors"
```

Expected: No TypeScript errors related to the new file.

**Step 3: Commit**

```bash
git add src/lib/invoice-status.ts && git commit -m "feat(billing): add INVOICE_STATUS constants and VALID_TRANSITIONS"
```

---

### Task P0-4: Create org-rbac.ts — requireOrgRole + AuthError + getAuthContext

**Objective:** Create `src/lib/auth/org-rbac.ts` with `AuthError`, `requireOrgRole()`, and `getAuthContext()`.

**Files:**
- Create: `src/lib/auth/org-rbac.ts`
- Note: `src/lib/auth/` directory must exist; create if not

**Step 1: Create the directory and file**

```bash
mkdir -p /root/projects/project-bill/src/lib/auth
```

Create `src/lib/auth/org-rbac.ts`:

```typescript
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrganizationMember } from "@prisma/client";

export class AuthError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export type AuthContext =
  | { type: "user"; session: Session; orgId: string; role: string; membership: OrganizationMember }
  | { type: "system"; authMethod: "cron" | "webhook"; orgId?: string };

/**
 * Verify user has the required role in their active organization.
 * Always reads membership from DB — never from JWT cache.
 */
export async function requireOrgRole(
  session: Session | null,
  requiredRoles: string | string[]
): Promise<{ membership: OrganizationMember; organizationId: string }> {
  if (!session?.user?.id) {
    throw new AuthError(401, "Unauthorized");
  }

  const organizationId = session.user.activeOrganizationId;
  if (!organizationId) {
    throw new AuthError(401, "No active organization");
  }

  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: { userId: session.user.id, organizationId },
    },
  });

  if (!membership) {
    throw new AuthError(403, "Not a member of this organization");
  }

  const roles = typeof requiredRoles === "string" ? [requiredRoles] : requiredRoles;
  if (!roles.includes(membership.role)) {
    console.warn(`[RBAC_DENY] userId=${session.user.id} orgId=${organizationId} requiredRole=${roles.join("|")} actualRole=${membership.role}`);
    throw new AuthError(403, `Requires ${roles.join(" or ")} role`);
  }

  return { membership, organizationId };
}

/**
 * Detect auth context: user session (priority), CRON_SECRET, or webhook.
 */
export async function getAuthContext(request: Request): Promise<AuthContext> {
  const session = await auth();
  if (session?.user?.id) {
    const orgId = session.user.activeOrganizationId!;
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } },
    });
    if (!membership) throw new AuthError(403, "Not a member of this organization");
    return { type: "user", session, orgId, role: membership.role, membership };
  }

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    const url = new URL(request.url);
    return { type: "system", authMethod: "cron", orgId: url.searchParams.get("orgId") ?? undefined };
  }

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/webhooks/")) {
    return { type: "system", authMethod: "webhook" };
  }

  throw new AuthError(401, "Unauthorized");
}
```

**Step 2: Verify compilation**

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | grep -i "org-rbac" || echo "No errors"
```

Expected: No TS errors. If Session type is not available, check `@/auth` exports and add `Session` import from `next-auth`.

**Step 3: Commit**

```bash
git add src/lib/auth/org-rbac.ts && git commit -m "feat(auth): add AuthError, requireOrgRole, getAuthContext"
```

---

### Task P0-5: Create org-scoping.ts

**Objective:** Create `src/lib/auth/org-scoping.ts` with `orgQuery()` helper.

**Files:**
- Create: `src/lib/auth/org-scoping.ts`

**Step 1: Create the file**

```typescript
// src/lib/auth/org-scoping.ts
import { AuthError } from "./org-rbac";

/**
 * Creates a scoped query builder that auto-injects organizationId.
 * Prevents cross-org data leaks by eliminating "forgot the filter" bugs.
 */
export function orgQuery(orgId: string) {
  if (!orgId) throw new AuthError(500, "orgQuery: orgId is required");

  const scope = { organizationId: orgId };

  return {
    findMany: <T>(model: any, args?: any): Promise<T[]> =>
      model.findMany({ ...args, where: { ...args?.where, ...scope } }),

    findFirst: <T>(model: any, args?: any): Promise<T | null> =>
      model.findFirst({ ...args, where: { ...args?.where, ...scope } }),

    create: <T>(model: any, args: any): Promise<T> =>
      model.create({
        ...args,
        data: { ...args.data, organizationId: orgId },
      }),

    update: async <T>(model: any, args: any): Promise<T> => {
      const record = await model.findUnique({ where: args.where });
      if (!record || record.organizationId !== orgId) {
        throw new AuthError(404, "Record not found");
      }
      return model.update({ ...args, where: { ...args.where }, data: { ...args.data } });
    },

    delete: async <T>(model: any, args: any): Promise<T> => {
      const record = await model.findUnique({ where: args.where });
      if (!record || record.organizationId !== orgId) {
        throw new AuthError(404, "Record not found");
      }
      return model.delete({ ...args, where: { ...args.where } });
    },
  };
}
```

**Step 2: Verify compilation**

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | grep -i "org-scoping" || echo "No errors"
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/auth/org-scoping.ts && git commit -m "feat(auth): add orgQuery helper for automatic org-scoped queries"
```

---

### Task P0-6: Create permissions.ts

**Objective:** Create `src/lib/auth/permissions.ts` with full permission matrix + `canPerform()`.

**Files:**
- Create: `src/lib/auth/permissions.ts`

**Step 1: Create the file**

```typescript
// src/lib/auth/permissions.ts
export const PERMISSIONS = {
  org_manage:            ["OWNER"],
  team_manage:           ["OWNER", "ADMIN"],
  billing:               ["OWNER"],
  export:                ["OWNER"],
  settings:              ["OWNER", "ADMIN"],
  mark_paid:             ["OWNER", "ADMIN"],
  change_invoice_status: ["OWNER", "ADMIN"],
  void_invoice:          ["OWNER", "ADMIN"],
  delete_invoice:        ["OWNER", "ADMIN"],
  send_email:            ["OWNER", "ADMIN"],
  milestone_approve:     ["OWNER", "ADMIN"],
  recurring_invoice_cud: ["OWNER", "ADMIN"],
  sow_template_cud:      ["OWNER", "ADMIN"],
  view_audit_log:        ["OWNER", "ADMIN"],
  agent_config:          ["OWNER", "ADMIN"],
  create_payment_link:   ["OWNER", "ADMIN"],
  invoice_crud:          ["OWNER", "ADMIN", "MEMBER"],
  client_crud:           ["OWNER", "ADMIN", "MEMBER"],
  project_crud:          ["OWNER", "ADMIN", "MEMBER"],
  dashboard_view:        ["OWNER", "ADMIN", "MEMBER"],
  view_recurring:        ["OWNER", "ADMIN", "MEMBER"],
  view_sow_template:     ["OWNER", "ADMIN", "MEMBER"],
  view_own_notifications: ["OWNER", "ADMIN", "MEMBER"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function canPerform(permission: Permission, role: string): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}
```

**Step 2: Verify compilation**

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | grep -i "permissions" || echo "No errors"
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/auth/permissions.ts && git commit -m "feat(auth): add PERMISSIONS config and canPerform helper"
```

---

### Task P0-7: Create hmac.ts

**Objective:** Create `src/lib/auth/hmac.ts` with HMAC sign/verify for public invoice payment endpoint.

**Files:**
- Create: `src/lib/auth/hmac.ts`

**Step 1: Create the file**

```typescript
// src/lib/auth/hmac.ts
import { createHmac, timingSafeEqual } from "crypto";

const HMAC_ALGORITHM = "sha256";

export function signInvoicePay(invoiceId: string, orgId: string): string {
  const secret = process.env.INVOICE_HMAC_SECRET;
  if (!secret) return "";
  return createHmac(HMAC_ALGORITHM, secret)
    .update(`${invoiceId}:${orgId}`)
    .digest("hex");
}

export function verifyInvoicePaySig(invoiceId: string, orgId: string, sig: string): boolean {
  const secret = process.env.INVOICE_HMAC_SECRET;
  if (!secret) return true; // fallback: no secret = no verification
  const expected = createHmac(HMAC_ALGORITHM, secret)
    .update(`${invoiceId}:${orgId}`)
    .digest("hex");
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
```

**Step 2: Verify compilation**

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | grep -i "hmac" || echo "No errors"
```

Expected: No errors.

**Step 3: Commit**

```bash
git add src/lib/auth/hmac.ts && git commit -m "feat(auth): add HMAC sign/verify for public invoice payment endpoint"
```

---

### Task P0-8: Extract sendInvoiceEmail utility

**Objective:** Extract core email sending logic from `src/app/actions/send-invoice.ts` into `src/lib/email/send-invoice-email.ts` — a pure utility function that does NOT call `auth()`.

**Files:**
- Create: `src/lib/email/send-invoice-email.ts`
- Modify: `src/app/actions/send-invoice.ts`

**Step 1: Create the utility file**

Extract all core logic from `send-invoice.ts` lines 21-139 (everything between auth check and final return) into a utility function that accepts `{ invoiceId, orgId, isAutoGenerated, customNotes }`.

```typescript
// src/lib/email/send-invoice-email.ts
import { prisma } from "@/lib/prisma";
import { sendInvoiceEmail as baseSendInvoiceEmail, sendRecurringInvoiceEmail } from "@/lib/email";
import { checkOrgLimit, incrementOrgUsage } from "@/lib/billing/subscription";
import { getBaseUrl } from "@/lib/utils";
import { formatMoney } from "@/lib/currency";

export interface SendInvoiceEmailOptions {
  invoiceId: string;
  orgId: string;
  isAutoGenerated?: boolean;
  customNotes?: string | null;
}

export async function sendInvoiceEmailUtil(options: SendInvoiceEmailOptions) {
  const { invoiceId, orgId, isAutoGenerated = false, customNotes = null } = options;

  const limitCheck = await checkOrgLimit(orgId, "emailsPerMonth");
  if (!limitCheck.allowed) {
    return {
      success: false,
      error: "Monthly email limit reached. Please upgrade your plan.",
      limitCheck,
    };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: orgId },
    include: {
      project: {
        include: { client: true },
      },
    },
  });

  if (!invoice || !invoice.project.client.email) {
    throw new Error("Invoice or Client Email not found");
  }

  const client = invoice.project.client;
  const project = invoice.project;
  const amountStr = formatMoney(Number(invoice.amount), project.currency || "IDR");
  const baseUrl = getBaseUrl();
  const invoiceDetailUrl = `${baseUrl}/invoices/${invoice.id}`;

  try {
    let result;

    if (invoice.type === "RECURRING") {
      result = await sendRecurringInvoiceEmail({
        to: client.email!,
        clientName: client.name,
        projectTitle: project.title,
        invoiceId: invoice.invoiceNumber,
        dueDate: invoice.dueDate,
        amountStr: amountStr,
        invoiceLink: invoiceDetailUrl,
        description: customNotes || invoice.notes,
        lang: project.language as "id" | "en",
        organizationId: orgId,
      });
    } else {
      result = await baseSendInvoiceEmail({
        to: client.email!,
        clientName: client.name,
        projectTitle: project.title,
        invoiceId: invoice.invoiceNumber,
        dueDate: invoice.dueDate,
        amountStr: amountStr,
        invoiceLink: invoiceDetailUrl,
        lang: project.language as "id" | "en",
        organizationId: orgId,
      });
    }

    if (result.success && !result.mocked) {
      await prisma.invoice.update({
        where: { id: invoiceId, organizationId: orgId },
        data: { emailStatus: "SENT" },
      });
      await incrementOrgUsage(orgId, "emailsSent");
    }

    if (!result.success && result.error) {
      throw result.error;
    }

    let mailtoData = undefined;
    if (result.mocked) {
      let subject = "";
      let body = "";

      if (invoice.type === "RECURRING") {
        subject =
          project.language === "en"
            ? `Recurring Invoice [${invoice.invoiceNumber}] for ${project.title} - Action Required`
            : `Tagihan Rutin [${invoice.invoiceNumber}] untuk ${project.title} - Diperlukan Tindakan`;
        body =
          project.language === "en"
            ? `Hello ${client.name},\n\nPlease find your recurring invoice detail here:\n${invoiceDetailUrl}\n\nAmount due: ${amountStr}\n\nAccess all your invoices: ${getBaseUrl()}/client/login\n\nThank you!`
            : `Halo ${client.name},\n\nBerikut adalah detail tagihan rutin Anda:\n${invoiceDetailUrl}\n\nTotal tagihan: ${amountStr}\n\nAkses semua invoice Anda: ${getBaseUrl()}/client/login\n\nTerima kasih!`;
      } else {
        subject =
          project.language === "en"
            ? `Invoice [${invoice.invoiceNumber}] for ${project.title} - Action Required`
            : `Invoice [${invoice.invoiceNumber}] untuk ${project.title} - Diperlukan Tindakan`;
        body =
          project.language === "en"
            ? `Hello ${client.name},\n\nPlease find your invoice detail here:\n${invoiceDetailUrl}\n\nAmount due: ${amountStr}\n\nAccess all your invoices: ${getBaseUrl()}/client/login\n\nThank you!`
            : `Halo ${client.name},\n\nBerikut adalah detail tagihan Anda:\n${invoiceDetailUrl}\n\nTotal tagihan: ${amountStr}\n\nAkses semua invoice Anda: ${getBaseUrl()}/client/login\n\nTerima kasih!`;
      }

      mailtoData = { to: client.email!, subject, body };
    }

    return {
      success: true,
      manual: result.mocked,
      message: result.mocked ? "Select your preferred email provider..." : undefined,
      invoiceLink: result.mocked ? invoiceDetailUrl : undefined,
      mailtoData,
    };
  } catch (emailError: any) {
    console.error("Failed to send email via Resend:", emailError);
    await prisma.invoice.update({
      where: { id: invoiceId, organizationId: orgId },
      data: { emailStatus: "FAILED" },
    });
    return { success: false, error: emailError?.message || "Failed to send email" };
  }
}
```

**Step 2: Simplify the Server Action to call the utility**

Replace `src/app/actions/send-invoice.ts` with a thin wrapper:

```typescript
"use server";

import { auth } from "@/auth";
import { sendInvoiceEmailUtil } from "@/lib/email/send-invoice-email";

export async function sendInvoiceEmail(
  invoiceId: string,
  isAutoGenerated: boolean = false,
  customNotes?: string | null
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const orgId = session.user.activeOrganizationId!;

  try {
    return await sendInvoiceEmailUtil({
      invoiceId,
      orgId,
      isAutoGenerated,
      customNotes,
    });
  } catch (error) {
    console.error("Error generating/sending invoice email:", error);
    return { success: false, error: "Failed to send email" };
  }
}
```

**Step 3: Verify compilation**

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No TypeScript errors. Some pre-existing errors outside this scope are acceptable.

**Step 4: Commit**

```bash
git add src/lib/email/send-invoice-email.ts src/app/actions/send-invoice.ts && git commit -m "refactor(email): extract sendInvoiceEmail utility, SA becomes thin auth wrapper"
```

---

### Task P0-9: Extract sendReceiptEmail utility

**Objective:** Extract core logic from `src/app/actions/send-receipt.ts` into `src/lib/email/send-receipt-email.ts`.

**Files:**
- Create: `src/lib/email/send-receipt-email.ts`
- Modify: `src/app/actions/send-receipt.ts`

**Step 1: Create the utility file**

Extract logic from `send-receipt.ts` lines 16-93 (invoice lookup → PDF gen → email send → return):

```typescript
// src/lib/email/send-receipt-email.ts
import { prisma } from "@/lib/prisma";
import { sendPaymentSuccessEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/utils";
import { generateInvoicePdfBuffer, generateSowPdfBuffer } from "@/lib/pdf-generator";
import { formatMoney } from "@/lib/currency";

export interface SendReceiptEmailOptions {
  invoiceId: string;
  orgId: string;
}

export async function sendReceiptEmailUtil(options: SendReceiptEmailOptions) {
  const { invoiceId, orgId } = options;

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: orgId },
    include: {
      project: {
        include: { client: true },
      },
    },
  });

  if (!invoice || !invoice.project.client.email || invoice.status !== "PAID") {
    throw new Error("Invoice not found or not paid");
  }

  const { project } = invoice;
  const { client } = project;
  const amountStr = formatMoney(Number(invoice.amount), project.currency || "IDR");
  const baseUrl = getBaseUrl();
  const invoiceDetailUrl = `${baseUrl}/invoices/${invoice.id}`;

  let sowPdfBuffer: Buffer | undefined;
  const invoicePdfBuffer = await generateInvoicePdfBuffer(invoice.id);

  if (project.termsAcceptedAt) {
    sowPdfBuffer = await generateSowPdfBuffer(invoice.id);
  }

  console.log(`[SEND_RECEIPT] PDF generation complete for invoice: ${invoice.id}. Proceeding to send email...`);

  try {
    const result = await sendPaymentSuccessEmail({
      to: client.email!,
      clientName: client.name,
      projectTitle: project.title,
      invoiceNumber: invoice.invoiceNumber,
      amountStr,
      invoiceLink: invoiceDetailUrl,
      sowPdfBuffer,
      invoicePdfBuffer,
      lang: project.language as "id" | "en",
      organizationId: orgId,
    });

    console.log(`[SEND_RECEIPT] Email send result:`, result);

    if (!result.success && result.error) {
      throw result.error;
    }

    let mailtoData = undefined;
    if (result.mocked) {
      const subject =
        project.language === "en"
          ? `Payment Receipt [${invoice.invoiceNumber}] for ${project.title}`
          : `Kuitansi Pembayaran [${invoice.invoiceNumber}] untuk ${project.title}`;
      const body =
        project.language === "en"
          ? `Hello ${client.name},\nWe have received your payment for the amount of ${amountStr}.\n\nPlease find your official receipt detail here:\n${invoiceDetailUrl}\n\nThank you!`
          : `Halo ${client.name},\n\nKami telah menerima pembayaran Anda sebesar ${amountStr}.\n\nBerikut adalah detail kuitansi resmi Anda:\n${invoiceDetailUrl}\n\nTerima kasih!`;

      mailtoData = { to: client.email!, subject, body };
    }

    return {
      success: true,
      manual: result.mocked,
      message: result.mocked ? "Select your preferred email provider..." : undefined,
      invoiceLink: result.mocked ? invoiceDetailUrl : undefined,
      mailtoData,
    };
  } catch (emailError: any) {
    console.error("Failed to send receipt email via Resend:", emailError);
    return { success: false, error: emailError?.message || "Failed to send receipt email" };
  }
}
```

**Step 2: Simplify the Server Action**

Replace `src/app/actions/send-receipt.ts`:

```typescript
"use server";

import { auth } from "@/auth";
import { sendReceiptEmailUtil } from "@/lib/email/send-receipt-email";

export async function sendReceiptEmail(invoiceId: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const orgId = session.user.activeOrganizationId!;

  try {
    return await sendReceiptEmailUtil({ invoiceId, orgId });
  } catch (error) {
    console.error("Error generating/sending receipt email:", error);
    return { success: false, error: "Failed to send receipt email" };
  }
}
```

**Step 3: Verify compilation**

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | head -30
```

Expected: No new TS errors.

**Step 4: Commit**

```bash
git add src/lib/email/send-receipt-email.ts src/app/actions/send-receipt.ts && git commit -m "refactor(email): extract sendReceiptEmail utility, SA becomes thin auth wrapper"
```

---

## Phase 0 Summary

| Task | File(s) | Status |
|------|---------|--------|
| P0-1 | prisma/schema (voidedAt) | Not started |
| P0-2 | prisma/schema (notification userId) | Not started |
| P0-3 | src/lib/invoice-status.ts | Not started |
| P0-4 | src/lib/auth/org-rbac.ts | Not started |
| P0-5 | src/lib/auth/org-scoping.ts | Not started |
| P0-6 | src/lib/auth/permissions.ts | Not started |
| P0-7 | src/lib/auth/hmac.ts | Not started |
| P0-8 | src/lib/email/send-invoice-email.ts + send-invoice.ts | Not started |
| P0-9 | src/lib/email/send-receipt-email.ts + send-receipt.ts | Not started |

Proceed to execute Phase 0 via subagent-driven-development? ⏭️

---

## Phase 1: System Context (Cron & Webhook)

> **Dependency:** Phase 0 must complete first (utility files + org-scoping helper exist).
> **Est.:** ~40m

### Task P1-1: Fix cron recurring-invoices — use email utility

**Objective:** Replace `sendInvoiceEmail()` Server Action call with `sendInvoiceEmailUtil()` in cron route. Add `[SYSTEM_ACTION]` logging.

**Files:**
- Modify: `src/app/api/cron/recurring-invoices/route.ts`

**Step 1: Read the current file**

```bash
cat /root/projects/project-bill/src/app/api/cron/recurring-invoices/route.ts
```

Locate line(s) that call `sendInvoiceEmail(newInvoice.id, true, template.description)`.

**Step 2: Replace import and call**

```diff
- import { sendInvoiceEmail } from "@/app/actions/send-invoice";
+ import { sendInvoiceEmailUtil } from "@/lib/email/send-invoice-email";
```

Replace the call block:

```typescript
console.log(`[SYSTEM_ACTION] authMethod=cron action=recurring-invoice-generate orgId=${template.organizationId} invoiceId=${newInvoice.id}`);
await sendInvoiceEmailUtil({
  invoiceId: newInvoice.id,
  orgId: template.organizationId,
  isAutoGenerated: true,
});
```

**Step 3: Verify compilation + Commit**

```bash
cd /root/projects/project-bill && npx tsc --noEmit --pretty 2>&1 | head -20 && git add src/app/api/cron/recurring-invoices/route.ts && git commit -m "fix(cron): replace sendInvoiceEmail SA with utility to fix silent email failure"
```

---

### Task P1-2: Fix cron reminders — add orgId filter

**Objective:** Add `organizationId: { not: null }` to the reminders invoice query. Add `[SYSTEM_ACTION]` logging.

**Files:**
- Modify: `src/app/api/cron/reminders/route.ts`

**Step 1: Read the current file**

```bash
cat /root/projects/project-bill/src/app/api/cron/reminders/route.ts
```

**Step 2: Add orgId filter**

```diff
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      status: "UNPAID",
+     organizationId: { not: null },
      dueDate: { not: null },
      paymentLink: { not: null },
    },
  });
```

Inside processing loop:

```typescript
console.log(`[SYSTEM_ACTION] authMethod=cron action=reminder-send invoiceId=${invoice.id} orgId=${invoice.organizationId}`);
```

**Step 3: Commit**

```bash
git add src/app/api/cron/reminders/route.ts && git commit -m "fix(cron): add orgId filter + SYSTEM_ACTION logging to reminders route"
```

---

### Task P1-3: Fix Mayar webhook — add org-scope + transition validation

**Objective:** Update `POST /api/webhooks/mayar/route.ts` with org-scope, `isValidTransition()`, and `[SYSTEM_ACTION]` logging.

**Files:**
- Modify: `src/app/api/webhooks/mayar/route.ts`

**Step 1: Read current file and add validation**

```bash
cat /root/projects/project-bill/src/app/api/webhooks/mayar/route.ts
```

**Step 2: Add import and validation block**

```diff
+ import { isValidTransition } from "@/lib/invoice-status";
```

Replace the invoice update block with:

```typescript
const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

if (!isValidTransition(invoice.status, 'PAID')) {
  console.warn(`[WEBHOOK] Skipping PAID for invoice id=${invoiceId}: transition ${invoice.status}→PAID invalid`);
  return NextResponse.json({ status: "skipped", reason: "invalid_transition" });
}

console.log(`[SYSTEM_ACTION] authMethod=webhook action=mark-paid invoiceId=${invoiceId} orgId=${invoice.organizationId} status=${invoice.status}→PAID`);

await prisma.invoice.update({
  where: { id: invoiceId, organizationId: invoice.organizationId },
  data: { status: 'PAID', paidAt: new Date() },
});
```

**Step 3: Commit**

```bash
git add src/app/api/webhooks/mayar/route.ts && git commit -m "fix(webhook): add org-scope + isValidTransition + SYSTEM_ACTION logging to Mayar webhook"
```

---

### Task P1-4: Create MIG-1 — invoice status normalization script

**Objective:** Create script to normalize lowercase status values to uppercase.

**Files:**
- Create: `scripts/migrate-invoice-status.ts`

**Step 1: Create the file**

```bash
mkdir -p /root/projects/project-bill/scripts
```

```typescript
// scripts/migrate-invoice-status.ts
import { prisma } from "@/lib/prisma";

async function migrate() {
  console.log("[MIGRATE] Normalizing invoice status to uppercase...");
  const [unpaidRes, paidRes] = await Promise.all([
    prisma.invoice.updateMany({
      where: { status: { equals: "unpaid", mode: "insensitive" } },
      data: { status: "UNPAID" },
    }),
    prisma.invoice.updateMany({
      where: { status: "paid" },
      data: { status: "PAID" },
    }),
  ]);
  console.log(`  → ${unpaidRes.count} invoices: unpaid → UNPAID`);
  console.log(`  → ${paidRes.count} invoices: paid → PAID`);

  const validStatuses = ["UNPAID", "PAID", "DRAFT", "VOID"];
  const remaining = await prisma.invoice.count({ where: { status: { notIn: validStatuses } } });
  if (remaining > 0) {
    const result = await prisma.invoice.updateMany({
      where: { status: { notIn: validStatuses } },
      data: { status: "UNPAID" },
    });
    console.log(`  → ${result.count} unrecognized statuses → UNPAID`);
  }
  console.log("[MIGRATE] Done.");
}

migrate().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

**Step 2: Run the migration**

```bash
cd /root/projects/project-bill && npx tsx scripts/migrate-invoice-status.ts
```

**Step 3: Commit**

```bash
git add scripts/migrate-invoice-status.ts && git commit -m "feat(scripts): add invoice status normalization migration (MIG-1)"
```

---

### Task P1-5: Fix countUnpaidInvoices Server Action

**Objective:** Add auth + org-scope — currently zero auth, queries cross-org.

**Files:**
- Find + Modify: count-unpaid-invoices action

**Step 1: Find the file**

```bash
grep -rl "countUnpaidInvoices" src/app/actions/
```

**Step 2: Replace function**

```typescript
"use server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function countUnpaidInvoices() {
  const session = await auth();
  if (!session?.user?.id) return { count: 0 };
  const orgId = session.user.activeOrganizationId!;
  const count = await prisma.invoice.count({
    where: { status: "UNPAID", organizationId: orgId },
  });
  return { count };
}
```

**Step 3: Commit**

```bash
git add [path] && git commit -m "fix(auth): add auth + org-scope to countUnpaidInvoices SA"
```

---

### Task P1-6: Fix checkInvoiceStatus Server Action

**Objective:** Make auth mandatory + add org-scope.

**Files:**
- Find + Modify: check-invoice-status action

**Step 1: Find and replace**

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
  const orgId = session.user.activeOrganizationId!;
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId, organizationId: orgId },
    select: { status: true },
  });
  if (!invoice) throw new Error("Invoice not found");
  return invoice;
}
```

**Step 2: Commit**

```bash
git add [path] && git commit -m "fix(auth): make checkInvoiceStatus auth mandatory + add org-scope"
```

---

## Phase 2: RBAC Helper Deployment

> **Dependency:** Phase 0-1 done. Requires `requireOrgRole()`, `orgQuery()`, `canPerform()` exist.
> **Est.:** ~2h

### Task P2-1: Add requireOrgRole to sendInvoiceEmail SA

**Objective:** Add `requireOrgRole(session, ['OWNER', 'ADMIN'])`.

**Files:**
- Modify: `src/app/actions/send-invoice.ts`

**Step 1: Add import and role check**

```typescript
import { requireOrgRole } from "@/lib/auth/org-rbac";
// After auth() check:
const { organizationId } = await requireOrgRole(session, ['OWNER', 'ADMIN']);
// Replace `const orgId = session.user.activeOrganizationId!` with organizationId from requireOrgRole
```

**Step 2: Use organizationId instead of session orgId**

```typescript
return await sendInvoiceEmailUtil({ invoiceId, orgId: organizationId, isAutoGenerated, customNotes });
```

**Step 3: Commit**

```bash
git add src/app/actions/send-invoice.ts && git commit -m "feat(auth): add requireOrgRole(['OWNER', 'ADMIN']) to sendInvoiceEmail"
```

---

### Task P2-2: Add requireOrgRole to sendReceiptEmail SA

**Objective:** Same pattern as P2-1.

**Files:**
- Modify: `src/app/actions/send-receipt.ts`

**Step 1: Add import and role check**

```typescript
import { requireOrgRole } from "@/lib/auth/org-rbac";
const { organizationId } = await requireOrgRole(session, ['OWNER', 'ADMIN']);
```

**Step 2: Commit**

```bash
git add src/app/actions/send-receipt.ts && git commit -m "feat(auth): add requireOrgRole(['OWNER', 'ADMIN']) to sendReceiptEmail"
```

---

### Task P2-3: Strip status from PATCH /api/invoices/[id]

**Objective:** Remove `status` and `cancelAtPeriodEnd` from accepted PATCH fields. Accept only `notes` and `dueDate`.

**Files:**
- Modify: `src/app/api/invoices/[id]/route.ts`

**Step 1: Edit PATCH handler**

```typescript
const json = await request.json();
const { notes, dueDate } = json;
// status and cancelAtPeriodEnd are SILENTLY IGNORED

const updateData: Record<string, unknown> = {};
if (notes !== undefined) updateData.notes = notes;
if (dueDate !== undefined) updateData.dueDate = dueDate;
```

**Step 2: Commit**

```bash
git add src/app/api/invoices/[id]/route.ts && git commit -m "fix(auth): strip status + cancelAtPeriodEnd from PATCH invoice, accept only notes/dueDate"
```

---

### Task P2-4: Add role + status guard to DELETE /api/invoices/[id]

**Objective:** Add `requireOrgRole(['OWNER', 'ADMIN'])` + PAID deletion guard.

**Files:**
- Modify: `src/app/api/invoices/[id]/route.ts`

**Step 1: Add check to DELETE handler**

```typescript
import { requireOrgRole } from "@/lib/auth/org-rbac";
import { INVOICE_STATUS } from "@/lib/invoice-status";

// After auth() in DELETE:
const { organizationId } = await requireOrgRole(session, ['OWNER', 'ADMIN']);
const orgId = organizationId;

// After invoice lookup:
if (invoice.status === INVOICE_STATUS.PAID) {
  return NextResponse.json(
    { error: "Cannot delete a paid invoice. Void the invoice first." },
    { status: 409 }
  );
}
```

**Step 2: Commit**

```bash
git add src/app/api/invoices/[id]/route.ts && git commit -m "fix(auth): add OWNER/ADMIN role check + PAID deletion guard to DELETE invoice"
```

---

### Task P2-5: Add requireOrgRole + isValidTransition to mark-paid

**Objective:** Add `requireOrgRole(['OWNER', 'ADMIN'])` + `isValidTransition()` to `PATCH /api/invoices/[id]/mark-paid`.

**Files:**
- Modify: `src/app/api/invoices/[id]/mark-paid/route.ts`

**Step 1: Read and modify**

```bash
cat /root/projects/project-bill/src/app/api/invoices/[id]/mark-paid/route.ts
```

```typescript
import { requireOrgRole } from "@/lib/auth/org-rbac";
import { isValidTransition, INVOICE_STATUS } from "@/lib/invoice-status";

// After auth():
const { organizationId } = await requireOrgRole(session, ['OWNER', 'ADMIN']);

// Before setting PAID:
if (!isValidTransition(invoice.status, INVOICE_STATUS.PAID)) {
  return NextResponse.json({ error: "Cannot mark paid: invoice status is current" }, { status: 409 });
}
```

**Step 2: Commit**

```bash
git add [file] && git commit -m "feat(auth): add OWNER/ADMIN + isValidTransition to mark-paid"
```

---

### Tasks P2-6 to P2-15: Bulk Role Check Addition

**Pattern for all — add requireOrgRole after auth() check:**

```typescript
import { requireOrgRole } from "@/lib/auth/org-rbac";
const { organizationId } = await requireOrgRole(session, ['OWNER', 'ADMIN']); // or ['OWNER']
```

| # | Route | Role |
|---|-------|------|
| P2-6 | GET/PUT /api/settings | `['OWNER', 'ADMIN']` |
| P2-7 | POST /api/settings/test-email | `['OWNER', 'ADMIN']` |
| P2-8 | subscription routes (GET/PUT/checkout/check) | `'OWNER'` |
| P2-9 | export routes (POST + status GET) | `'OWNER'` |
| P2-10 | PUT /api/organizations/[id] | `'OWNER'` |
| P2-11 | milestone approve/unapprove/mark-paid | `['OWNER', 'ADMIN']` |
| P2-12 | recurring invoice CUD | `['OWNER', 'ADMIN']` |
| P2-13 | SOW template CUD | `['OWNER', 'ADMIN']` |
| P2-14 | audit log, agent config | `['OWNER', 'ADMIN']` |
| P2-15 | members, invites view | `['OWNER', 'ADMIN']` |

---

### Task P2-16: Final sweep

**Step 1: Find uncovered routes**

```bash
cd /root/projects/project-bill
grep -rl "auth()" src/app/api/ --include="*.ts" | while read f; do
  if ! grep -q "requireOrgRole" "$f"; then
    if grep -qE "prisma\.\w+\.(update|create|delete)" "$f"; then
      echo "UNCOVERED WRITE: $f"
    fi
  fi
done
```

**Step 2: Same for Server Actions**

```bash
grep -rl '"use server"' src/app/actions/ --include="*.ts" | while read f; do
  if ! grep -q "requireOrgRole" "$f"; then
    if grep -qE "(prisma|fetch|\.update|\.create|\.delete)" "$f"; then
      echo "UNCOVERED ACTION: $f"
    fi
  fi
done
```

**Step 3: Add requireOrgRole to any uncovered files + Commit**

---

## Phase 3: Critical Security Fixes

> **Est.:** ~1.5h

### Task P3-1: Add orgId filter to GET /api/recurring-invoices

**File:** `src/app/api/recurring-invoices/route.ts` — change `where: {}` to `where: { organizationId: orgId }`.

### Task P3-2: Add orgId filter to GET /api/sow-templates

**File:** `src/app/api/sow-templates/route.ts` — same fix.

### Task P3-3: Field whitelist PUT /api/recurring-invoices/[id]

**File:** `src/app/api/recurring-invoices/[id]/route.ts` — replace `data: json` with whitelist.

### Task P3-4: Auth + requireOrgRole to retry-email

**File:** `src/app/api/invoices/[id]/retry-email/route.ts` — add requireOrgRole.

### Task P3-5: Auth + org filter to SSE /api/events

**File:** `src/app/api/events/route.ts` — add auth() + org-based filtering.

### Task P3-6: Create internal payment link endpoint

**Create:** `src/app/api/invoices/[id]/create-payment-link/route.ts` — auth + OWNER/ADMIN + HMAC signing.

### Task P3-7: Update public /pay with HMAC verification

**File:** `src/app/api/invoices/[id]/pay/route.ts` — add HMAC verify, keep public fallback.

### Task P3-8: Create void invoice endpoint

**Create:** `src/app/api/invoices/[id]/void/route.ts` — OWNER/ADMIN + isValidTransition.

---

## Phase 4: Org Persistence + Settings UI

> **Est.:** ~1.5h

### Task P4-1: Switch endpoint persist defaultOrganizationId

**File:** `src/app/api/organizations/[id]/switch/route.ts`

```typescript
await prisma.user.update({
  where: { id: session.user.id },
  data: { defaultOrganizationId: organizationId },
});
```

### Task P4-2: Create org persist defaultOrganizationId

**File:** `src/app/api/organizations/route.ts`

```typescript
await prisma.user.update({
  where: { id: session.user.id },
  data: { defaultOrganizationId: org.id },
});
```

### Task P4-3: JWT callback reads defaultOrganizationId from DB

**File:** Find `async jwt` callback in auth config. Add DB lookup for `defaultOrganizationId` and set `activeOrganizationId` + `activeOrganizationRole`.

### Task P4-4: Create /settings/organization page

**Create:** `src/app/(dashboard)/settings/organization/page.tsx` (server component)
**Create:** `src/app/(dashboard)/settings/organization/organization-settings-form.tsx` (client form with shadcn Card + Dialog)

Fields: name, logo URL, slug (with edit toggle). Danger zone: delete with confirm.

### Task P4-5: Role-gated sidebar nav

**File:** `src/components/app-sidebar.tsx` — filter navItems by userRole.

### Task P4-6: Server role checks on settings sub-pages

**Files:** team/page.tsx, sow-template/page.tsx, agent/page.tsx — add `requireOrgRole`.

---

## Phase 5: Notification Scoping

> **Est.:** ~30m

### Task P5-1: GET /api/notifications user-scoped filter

**File:** `src/app/api/notifications/route.ts`

```typescript
where: {
  organizationId: orgId,
  OR: [{ userId: session.user.id }, { userId: null }],
},
```

### Task P5-2: PATCH /api/notifications user-scoped mark

**File:** Same file — mark operations scoped to `userId: session.user.id`.

### Task P5-3: createNotification helper accept userId

**File:** Find `createNotification` in `src/lib/` — add optional `userId` parameter.

### Task P5-4: Run MIG-2

**Create + Run:** `scripts/migrate-notification-userid.ts` — verify existing notifications remain null.

---

## Global Summary

| Phase | Tasks | Est. |
|-------|-------|------|
| Phase 0: Foundation | 9 | ~30m |
| Phase 1: System Context | 6 | ~40m |
| Phase 2: RBAC Deploy | 16 | ~2h |
| Phase 3: Critical Fixes | 8 | ~1.5h |
| Phase 4: Org/UI | 6 | ~1.5h |
| Phase 5: Notifications | 4 | ~30m |
| **Total** | **~49 tasks** | **~6h** |
