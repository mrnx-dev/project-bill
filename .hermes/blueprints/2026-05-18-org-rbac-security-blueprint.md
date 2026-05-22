# Technical Design Document: Organization RBAC & Security

> Version: 1.0 | Author: Raka (TDD Architect) | Date: 2026-05-18
> Based on PRD: `.hermes/prds/2026-05-18-org-rbac-security.md` v1.3

## 1. Overview

Monolithic Next.js 16 App Router design. Central RBAC layer (`requireOrgRole()`) replaces all inline role checks. Org-scoping helper (`orgQuery()`) wraps Prisma queries to prevent cross-org leaks. Permission matrix config drives both server enforcement and client-side UI visibility. System context (cron/webhooks) bypasses user-session RBAC via `getAuthContext()`. Invoice status moves from plain string to validated constants with transition rules. Payment flow split: internal (`/create-payment-link`) with RBAC, client-facing (`/pay`) with HMAC. Email logic extracted to utilities shared by Server Actions and cron.

## 2. Architecture

- **Pattern**: Monolith — Next.js 16 App Router with Prisma 7 ORM, PostgreSQL
- **Auth**: Auth.js v5 (Credentials + JWT), session extended with `activeOrganizationId` and `activeOrganizationRole`
- **API style**: REST via Next.js route handlers + Server Actions for non-idempotent client interactions

### Architecture Diagram

```
User Browser                     System (Cron/Webhook)
      │                                  │
      ▼                                  ▼
┌──────────────┐             ┌──────────────────┐
│  Server      │             │  Cron / Webhook   │
│  Action      │             │  (CRON_SECRET /   │
│  (auth+role) │             │   signature auth)  │
└──────┬───────┘             └────────┬─────────┘
       │                              │
       ▼                              ▼
┌─────────────────────────────────────────────┐
│           Next.js Route Handler              │
│  ┌─────────────────────────────────────┐     │
│  │ getAuthContext(request)              │     │
│  │  ├─ user:   session + requireOrgRole│     │
│  │  ├─ system: CRON_SECRET / webhook   │     │
│  │  └─ fail:  AuthError(401)           │     │
│  └──────────────┬──────────────────────┘     │
│                 │                             │
│                 ▼                             │
│  ┌─────────────────────────────────────┐     │
│  │ Permission Layer                     │     │
│  │  ├─ requireOrgRole(session, roles)   │     │
│  │  ├─ canPerform(permission, role)     │     │
│  │  └─ orgQuery(orgId).findMany(model)  │     │
│  └──────────────┬──────────────────────┘     │
│                 │                             │
│                 ▼                             │
│  ┌─────────────────────────────────────┐     │
│  │    Prisma 7 ORM → PostgreSQL         │     │
│  └─────────────────────────────────────┘     │
└─────────────────────────────────────────────┘
```

### Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Auth check location | Route handler level (not middleware) | Middleware runs before page render and can't easily access Prisma. Route-level gives full context. |
| Role reads from DB | Always query `OrganizationMember`, never JWT cache | Role changes take effect immediately. JWT is only for session identification, not authorization. |
| System context detection | `getAuthContext()` helper that probes session, headers, then path | Single function handles all auth patterns. Priority: user > cron > webhook. |
| Invoice status type | String constants with runtime validation (not DB enum) | Flexible for migration. DB enum would lock schema and complicate transition to uppercase. |
| Payment flow split | Two endpoints: internal (RBAC) + public (HMAC) | Clean separation. No auth() on public endpoint means client portal works without login. |
| Email utility pattern | Extract core logic from Server Action, wrap in auth wrapper | Cron and Server Actions share same code. Auth boundary only at the entry point. |
| SSE filtering | Subscriber-side filter by orgId (not per-org channels) | Avoids Redis channel explosion per org. |
| Notification scoping | Add userId field. Org-wide = null. | Minimal schema change. Per-user read tracking deferred. |

## 3. Data Model

### Schema Change 1: Notification Model

**Current:**
```prisma
model Notification {
  id             String       @id @default(uuid())
  title          String
  message        String
  type           String
  isRead         Boolean      @default(false)
  linkUrl        String?
  organizationId String
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  organization   Organization  @relation(fields: [organizationId], references: [id])

  @@index([organizationId])
}
```

**After Migration (`add_user_id_to_notifications`):**
```prisma
model Notification {
  id             String       @id @default(uuid())
  title          String
  message        String
  type           String
  isRead         Boolean      @default(false)
  linkUrl        String?
  organizationId String
  userId         String?                                   // NEW
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  organization   Organization  @relation(fields: [organizationId], references: [id])
  user           User?         @relation(fields: [userId], references: [id])  // NEW

  @@index([organizationId])
  @@index([userId])            // NEW
}
```

### Schema Change 2: Invoice Model

**Current:**
```prisma
model Invoice {
  id              String    @id @default(uuid())
  invoiceNumber   String?
  projectId       String
  type            String
  notes           String?
  amount          Decimal   @default(0)
  status          String    @default("unpaid")
  emailStatus     String    @default("pending")
  dueDate         DateTime?
  paymentLink     String?
  paymentId       String?
  paidAt          DateTime?
  lastReminderAt  DateTime?
  lateFeeApplied  Decimal   @default(0)
  organizationId  String
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  // ... relations
}
```

**After Migration (`add_voided_at_to_invoice`):**
```prisma
model Invoice {
  // ... all existing fields ...
  voidedAt        DateTime?             // NEW: timestamp when invoice was voided
  // ... all existing fields ...
}
```

### Schema Change 3: User Model (existing field, new usage)

```prisma
model User {
  id                     String                @id @default(uuid())
  email                  String                @unique
  password               String
  name                   String
  role                   String                @default("admin")
  onboardingCompleted    Boolean               @default(false)
  defaultOrganizationId  String?               // EXISTING — now updated on org switch + create
  createdAt              DateTime              @default(now())
  updatedAt              DateTime              @updatedAt
  organizationMembers    OrganizationMember[]
}
```

`defaultOrganizationId` saat ini cuma di-set saat signup/onboarding. Setelah PRD: update setiap kali user switch org atau create new org.

## 4. New Libraries & Files

### File Map

```
src/lib/
├── auth/
│   ├── org-rbac.ts          — requireOrgRole(), AuthError, getAuthContext()
│   ├── org-scoping.ts       — orgQuery() helper
│   ├── permissions.ts       — PERMISSIONS config + canPerform()
│   └── hmac.ts              — signInvoicePay(), verifyInvoicePaySig()
├── email/
│   ├── send-invoice-email.ts  — extracted utility (no auth)
│   └── send-receipt-email.ts  — extracted utility (no auth)
└── invoice-status.ts         — INVOICE_STATUS, VALID_TRANSITIONS, isValidTransition()
```

### src/lib/invoice-status.ts

```typescript
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
  VOID:   [],
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

### src/lib/auth/org-rbac.ts

```typescript
import { auth } from "@/lib/auth";
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
  // 1. Check authentication
  if (!session?.user?.id) {
    throw new AuthError(401, "Unauthorized");
  }

  // 2. Extract active org
  const organizationId = session.user.activeOrganizationId;
  if (!organizationId) {
    throw new AuthError(401, "No active organization");
  }

  // 3. Query membership from DB (always fresh)
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: { userId: session.user.id, organizationId },
    },
  });

  if (!membership) {
    throw new AuthError(403, "Not a member of this organization");
  }

  // 4. Check role
  const roles = typeof requiredRoles === "string" ? [requiredRoles] : requiredRoles;
  if (!roles.includes(membership.role)) {
    throw new AuthError(403, `Requires ${roles.join(" or ")} role`);
  }

  return { membership, organizationId };
}

/**
 * Detect auth context: user session (priority), CRON_SECRET, or webhook.
 */
export async function getAuthContext(request: Request): Promise<AuthContext> {
  // PRIORITY 1: user session always wins
  const session = await auth();
  if (session?.user?.id) {
    const orgId = session.user.activeOrganizationId!;
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } },
    });
    if (!membership) throw new AuthError(403, "Not a member of this organization");
    return { type: "user", session, orgId, role: membership.role, membership };
  }

  // PRIORITY 2: CRON_SECRET header
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    const url = new URL(request.url);
    return { type: "system", authMethod: "cron", orgId: url.searchParams.get("orgId") ?? undefined };
  }

  // PRIORITY 3: webhook path detection
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/webhooks/")) {
    return { type: "system", authMethod: "webhook" };
  }

  throw new AuthError(401, "Unauthorized");
}
```

### src/lib/auth/org-scoping.ts

```typescript
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
      // Verify record belongs to org BEFORE update
      const record = await model.findUnique({ where: args.where });
      if (!record || record.organizationId !== orgId) {
        throw new AuthError(404, "Record not found");
      }
      return model.update({
        ...args,
        where: { ...args.where },
        data: { ...args.data },
      });
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

### src/lib/auth/permissions.ts

```typescript
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

### src/lib/auth/hmac.ts

```typescript
import { createHmac, timingSafeEqual } from "crypto";

const HMAC_ALGORITHM = "sha256";

/**
 * Sign an invoice pay request with HMAC for public endpoint security.
 * Signature = HMAC-SHA256(invoiceId + ":" + orgId, INVOICE_HMAC_SECRET)
 */
export function signInvoicePay(invoiceId: string, orgId: string): string {
  const secret = process.env.INVOICE_HMAC_SECRET;
  if (!secret) return "";
  return createHmac(HMAC_ALGORITHM, secret)
    .update(`${invoiceId}:${orgId}`)
    .digest("hex");
}

/**
 * Verify an invoice pay HMAC signature.
 * Falls back to allow (return true) if INVOICE_HMAC_SECRET is not set.
 * Uses constant-time comparison to prevent timing attacks.
 */
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

## 5. API Design

### Phase 2 Endpoints (RBAC Deployment)

#### General Pattern
Setiap route handler yang melakukan restricted action kini punya pola standar:

```typescript
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { membership, organizationId } = await requireOrgRole(session, ['OWNER', 'ADMIN']);
    // ... route-specific logic with orgQuery(organizationId) ...
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

#### PATCH /api/invoices/[id] — Status Stripped
- **Purpose:** Update invoice metadata only (notes, dueDate). Status changes prohibited.
- **Auth:** requireOrgRole(session, any) — just verify membership
- **Request:** `{ notes?: string, dueDate?: string }`
- **Behavior:** `status` and `cancelAtPeriodEnd` fields are silently ignored. Only `notes` and `dueDate` accepted.
- **Errors:** 401, 403, 404

#### PATCH /api/invoices/[id]/mark-paid
- **Purpose:** Mark unpaid invoice as paid
- **Auth:** `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- **Behavior:** Validates `isValidTransition(currentStatus, 'PAID')`. Throws 409 if invalid.
- **Errors:** 401, 403, 404, 409

#### DELETE /api/invoices/[id]
- **Purpose:** Delete invoice (not PAID)
- **Auth:** `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- **Status guard:** PAID invoices → 409 "Cannot delete a paid invoice. Void the invoice first."
- **Errors:** 401, 403, 404, 409

#### GET/PUT /api/settings
- **Current:** restricted to OWNER
- **Change:** relaxed to `requireOrgRole(session, ['OWNER', 'ADMIN'])` per matrix

#### PUT /api/organizations/[id]
- **Current:** allows ADMIN
- **Change:** tightened to `requireOrgRole(session, 'OWNER')`

#### GET/PUT /api/subscription, POST /api/subscription/checkout, GET /api/subscription/check
- **Auth:** `requireOrgRole(session, 'OWNER')`

#### GET /api/organizations/[id]/members, GET /api/organizations/[id]/invites
- **Auth:** `requireOrgRole(session, ['OWNER', 'ADMIN'])`

#### GET /api/audit-logs
- **Auth:** `requireOrgRole(session, ['OWNER', 'ADMIN'])`

#### GET/PUT /api/agent/config
- **Auth:** `requireOrgRole(session, ['OWNER', 'ADMIN'])`

#### Milestone endpoints:
- POST .../approve → `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- POST .../unapprove → `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- POST .../mark-paid → `requireOrgRole(session, ['OWNER', 'ADMIN'])`

#### Recurring invoice CUD:
- POST /api/recurring-invoices → `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- PUT /api/recurring-invoices/[id] → `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- DELETE /api/recurring-invoices/[id] → `requireOrgRole(session, ['OWNER', 'ADMIN'])`

#### SOW template CUD:
- POST /api/sow-templates → `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- PUT /api/sow-templates/[id] → `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- DELETE /api/sow-templates/[id] → `requireOrgRole(session, ['OWNER', 'ADMIN'])`

### Phase 3 Endpoints (Critical Fixes)

#### POST /api/invoices/[id]/create-payment-link (NEW)
- **Purpose:** Internal endpoint for OWNER/ADMIN to generate a payment link. Returns HMAC-signed URL.
- **Auth:** `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- **Behavior:** Creates Mayar payment link, stores in `invoice.paymentLink`. Generates HMAC signature for the public `/pay` endpoint.
- **Response 200:**
  ```json
  {
    "paymentLink": "https://app.mayar.id/pay/xxx",
    "hmacSig": "abc123def456"
  }
  ```
- **Errors:** 401, 403, 404

#### POST /api/invoices/[id]/pay — HMAC-Protected (UPDATED)
- **Purpose:** Client-facing public endpoint. Creates Mayar payment link for invoice.
- **Auth:** HMAC signature in query param `?sig=...`
- **Request body:** (empty — sig is in URL)
- **Behavior:** Verifies HMAC via `verifyInvoicePaySig(invoiceId, orgId, sig)`. If valid, creates Mayar payment link. If payment link already exists, returns existing one. If `INVOICE_HMAC_SECRET` not set, falls back to no-signature mode (with warning log).
- **Response 200:** `{ "paymentLink": "https://..." }`
- **Errors:** 403 (invalid/empty sig), 404

#### GET /api/recurring-invoices — Org Scope Fix
- **Change:** Add `where: { organizationId: orgId }` filter to Prisma query
- Previously: `where: {}` returned ALL orgs' data

#### GET /api/sow-templates — Org Scope Fix
- **Change:** Add `where: { organizationId: orgId }` filter to Prisma query
- Previously: `where: {}` returned ALL orgs' data

#### PUT /api/recurring-invoices/[id] — Field Whitelist
- **Change:** Replace `data: json` with field whitelisting
- Accepted fields: `name, amount, interval, intervalCount, nextRunAt, isActive, projectId, description, startNumber, prefix`
- Explicitly reject: `organizationId` — if present in body, strip it silently
- **Behavior:**
  ```typescript
  const { organizationId, ...rest } = json;
  const allowed = pick(rest, ['name', 'amount', 'interval', 'intervalCount', 'nextRunAt', 'isActive', 'projectId', 'description', 'startNumber', 'prefix']);
  const updated = await prisma.recurringInvoice.update({
    where: { id, organizationId: orgId },
    data: allowed,
  });
  ```

#### GET /api/events SSE — Auth + Org Filter
- **Change:** Add `auth()` check before SSE connection. Filter emitted events by organizationId.
- **Pattern:**
  ```typescript
  export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
    const orgId = session.user.activeOrganizationId!;

    const customReadable = new ReadableStream({
      start(controller) {
        const handler = (channel: string, message: string) => {
          const event = JSON.parse(message);
          // Only emit events for this user's org, or their own notifications
          if (event.data?.organizationId === orgId || event.data?.userId === session.user.id || event.data?.userId === null) {
            controller.enqueue(encode(event));
          }
        };
        // ... attach handler
      },
    });
    return new NextResponse(customReadable, { headers: { 'Content-Type': 'text/event-stream' } });
  }
  ```

#### POST /api/invoices/[id]/retry-email
- **Change:** Add `requireOrgRole(session, ['OWNER', 'ADMIN'])`

#### POST /api/invoices/[id]/void (NEW)
- **Purpose:** Void a PAID or UNPAID invoice. Final status — no further transitions.
- **Auth:** `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- **Behavior:**
  1. Find invoice by `{ id, organizationId: orgId }`
  2. Validate `isValidTransition(invoice.status, 'VOID')` — 409 if invalid
  3. `prisma.invoice.update({ where: { id }, data: { status: 'VOID', voidedAt: now() } })`
  4. Create audit log entry
- **Errors:** 401, 403, 404, 409

### Phase 4 Endpoints (Org Persistence)

#### POST /api/organizations/[id]/switch — Persist to DB
- **Change:** After membership verification, update `User.defaultOrganizationId` in database
- **Additional:** Response now includes updated org info for immediate client-side session update
- **Pattern:**
  ```typescript
  // ... verify membership (existing) ...
  await prisma.user.update({
    where: { id: session.user.id },
    data: { defaultOrganizationId: organizationId },
  });
  return NextResponse.json({ ...org, role: membership.role });
  ```

#### POST /api/organizations — Persist defaultOrganizationId
- **Change:** After creating org + membership, update `User.defaultOrganizationId` to the new org
- **Pattern:**
  ```typescript
  // ... create org, membership (existing) ...
  await prisma.user.update({
    where: { id: session.user.id },
    data: { defaultOrganizationId: org.id },
  });
  return NextResponse.json({ ...org, role: "OWNER" });
  ```

#### auth.config.ts JWT Callback — Read defaultOrganizationId from DB
- **Change:** On initial JWT creation, query DB for `User.defaultOrganizationId` and corresponding `OrganizationMember.role`
- **Pattern:**
  ```typescript
  async jwt({ token, user, trigger, session }) {
    if (user) {
      token.id = user.id;
      // Read defaultOrganizationId from DB
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      const defaultOrgId = dbUser?.defaultOrganizationId;
      if (defaultOrgId) {
        const membership = await prisma.organizationMember.findUnique({
          where: { userId_organizationId: { userId: user.id, organizationId: defaultOrgId } },
        });
        if (membership) {
          token.activeOrganizationId = defaultOrgId;
          token.activeOrganizationRole = membership.role;
        } else {
          // Fallback if membership was removed
          const fallback = await prisma.organizationMember.findFirst({
            where: { userId: user.id },
            orderBy: { joinedAt: 'asc' },
          });
          if (fallback) {
            token.activeOrganizationId = fallback.organizationId;
            token.activeOrganizationRole = fallback.role;
          }
        }
      }
      // ... existing trigger === "update" logic remains ...
    }
    return token;
  }
  ```

### Phase 5 Endpoints (Notification Scoping)

#### GET /api/notifications
- **Change:** Filter by `{ organizationId: orgId, OR: [{ userId: session.user.id }, { userId: null }] }`
- **Behavior:** Returns user-scoped notifications + org-wide notifications
- **Response:**
  ```json
  {
    "notifications": [...],
    "total": 10,
    "unreadCount": 3
  }
  ```

#### PATCH /api/notifications
- **Change:** Mark operations scoped to current user
- **Mark single:** `where: { id, organizationId: orgId, userId: session.user.id }`
- **Mark all:** `where: { isRead: false, organizationId: orgId, userId: session.user.id }`

#### createNotification() Helper
- **Change:** Accept `userId` parameter. If provided, set on notification. If null, org-wide.
- **Pattern:**
  ```typescript
  export async function createNotification(
    type: string,
    title: string,
    message: string,
    organizationId: string,
    userId?: string | null,
    linkUrl?: string,
  ) {
    const notification = await prisma.notification.create({
      data: { type, title, message, organizationId, userId: userId ?? null, linkUrl },
    });
    // Broadcast via SSE
    await dispatchEvent("system_events", { type: "notification_created", data: notification });
    return notification;
  }
  ```

## 6. Frontend Architecture

### Pages (Modified/New)

| Route | Page Component | Server/Client | Role Gate |
|-------|---------------|---------------|-----------|
| `/settings/organization` | OrganizationSettingsPage (NEW) | Server → Client | OWNER only (server) |
| `/settings` | SettingsPage (MODIFIED) | Server → Client | Tab gating per role |
| `/settings/team` | TeamPage (MODIFIED) | Server → Client | OWNER/ADMIN (add server check) |
| `/settings/sow-template` | SOWTemplatePage (MODIFIED) | Server → Client | MEMBER: view-only |
| `/settings/subscription` | SubscriptionPage | Server → Client | OWNER only (server) |

### New Component: `/settings/organization/page.tsx`

```typescript
// Server Component
export default async function OrganizationSettingsPage() {
  const session = await auth();
  const { membership, organizationId } = await requireOrgRole(session, 'OWNER');

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: { _count: { select: { members: true } } },
  });

  return (
    <OrganizationSettingsForm
      org={{
        id: org.id,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logoUrl,
        createdAt: org.createdAt,
        memberCount: org._count.members,
      }}
    />
  );
}
```

### New Component: OrganizationSettingsForm (Client Component)

- shadcn Card + Form layout
- Fields: name (text), logo (URL text), slug (read-only with "Edit" toggle)
- Slug edit confirmation dialog: "Changing slug may break shared links. Continue?"
- Danger zone: Delete card with type-confirm dialog
- Save → `fetch PUT /api/organizations/[id]`
- Delete → `fetch POST /api/organizations/[id]/delete` → redirect to `/onboarding/organization`

### Sidebar Nav Gating (MODIFIED)

In `src/components/app-sidebar.tsx`, receive `role` from server props:

```typescript
const navItems = [
  { label: "Team",     href: "/settings/team",         roles: ["OWNER", "ADMIN"] },
  { label: "Organization", href: "/settings/organization", roles: ["OWNER"] },
  { label: "Subscription", href: "/settings/subscription", roles: ["OWNER"] },
  { label: "SOW Templates", href: "/settings/sow-template", roles: ["OWNER", "ADMIN", "MEMBER"] },
  { label: "Company",  href: "/settings",              roles: ["OWNER", "ADMIN"] },
  { label: "Agent/AI", href: "/settings/agent",        roles: ["OWNER", "ADMIN"] },
];
// Filter: navItems.filter(item => item.roles.includes(userRole))
```

### Server Actions (MODIFIED)

**sendInvoiceEmail** → now wraps utility:
```typescript
export async function sendInvoiceEmail(invoiceId: string, isAutoGenerated: boolean = false, customNotes?: string | null) {
  const session = await auth();
  const { organizationId } = await requireOrgRole(session, ['OWNER', 'ADMIN']);
  return sendInvoiceEmailUtil({ invoiceId, orgId: organizationId, isAutoGenerated, customNotes });
}
```

**sendReceiptEmail** → now wraps utility:
```typescript
export async function sendReceiptEmail(invoiceId: string) {
  const session = await auth();
  const { organizationId } = await requireOrgRole(session, ['OWNER', 'ADMIN']);
  return sendReceiptEmailUtil({ invoiceId, orgId: organizationId });
}
```

**countUnpaidInvoices** → fixed:
```typescript
export async function countUnpaidInvoices() {
  const session = await auth();
  if (!session?.user?.id) return { count: 0 };  // Return 0 instead of leaking cross-org data
  const orgId = session.user.activeOrganizationId!;
  const count = await prisma.invoice.count({
    where: { status: "UNPAID", organizationId: orgId },
  });
  return { count };
}
```

**checkInvoiceStatus** → mandatory auth:
```typescript
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

## 7. System Context (Cron & Webhook)

### GET /api/cron/recurring-invoices — Fix Silent Email Failure
- **Change:** Call `sendInvoiceEmailUtil()` directly instead of `sendInvoiceEmail()` Server Action
- **Pattern:**
  ```typescript
  // Inside cron loop, after invoice creation:
  await sendInvoiceEmailUtil({
    invoiceId: newInvoice.id,
    orgId: template.organizationId,
    isAutoGenerated: true,
  });
  ```

### GET /api/cron/reminders — Add Org Scope
- **Change:** Add `organizationId: { not: null }` to invoice query
- **Pattern:** `where: { status: "UNPAID", organizationId: { not: null }, dueDate: { not: null }, paymentLink: { not: null } }`

### POST /api/webhooks/mayar — Add Org Scope + Transition Validation
- **Change 1:** Query invoice with org-scoped lookup
- **Change 2:** Validate `isValidTransition(invoice.status, 'PAID')` before updating
- **Pattern:**
  ```typescript
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (!isValidTransition(invoice.status, 'PAID')) {
    console.warn(`[WEBHOOK] Skipping PAID for invoice id=${invoiceId}: transition ${invoice.status}→PAID invalid`);
    return NextResponse.json({ status: "skipped", reason: "invalid_transition" });
  }
  await prisma.invoice.update({
    where: { id: invoiceId, organizationId: invoice.organizationId },
    data: { status: 'PAID', paidAt: new Date() },
  });
  ```

## 8. Migration Scripts

### MIG-1: Invoice Status Normalization

**File:** `scripts/migrate-invoice-status.ts`

Run: `npx tsx scripts/migrate-invoice-status.ts`

Logic:
1. `updateMany` where `status: "unpaid"` → set `"UNPAID"`
2. `updateMany` where `status: "paid"` → set `"PAID"`
3. `count` where `status notIn ["UNPAID", "PAID", "DRAFT", "VOID"]` → if > 0, `updateMany` to `"UNPAID"`
4. Log counts, validate 0 remaining

### MIG-2: Notification UserId Backfill (No-op)

**File:** `scripts/migrate-notification-userid.ts`

Run after schema migration. Mostly a no-op since default is `null`.

### MIG-3: Schema Migration

```bash
npx prisma migrate dev --name add_voided_at_to_invoice
```

Adds `voidedAt DateTime?` to Invoice model. No data transformation needed.

## 9. Implementation Phases

### Phase 0: Schema + Foundation Files

**Estimated effort:** ~30m

- [ ] `npx prisma migrate dev --name add_voided_at_to_invoice` — MIG-3
- [ ] `npx prisma migrate dev --name add_user_id_to_notifications` — FR-9 schema
- [ ] Create `src/lib/invoice-status.ts` — constants + transition validator
- [ ] Create `src/lib/auth/org-rbac.ts` — requireOrgRole, AuthError, getAuthContext
- [ ] Create `src/lib/auth/org-scoping.ts` — orgQuery helper
- [ ] Create `src/lib/auth/permissions.ts` — PERMISSIONS + canPerform
- [ ] Create `src/lib/auth/hmac.ts` — signInvoicePay, verifyInvoicePaySig
- [ ] Extract `src/lib/email/send-invoice-email.ts` from existing Server Action
- [ ] Extract `src/lib/email/send-receipt-email.ts` from existing Server Action

### Phase 1: System Context (Cron & Webhook)

**Estimated effort:** ~40m

- [ ] `GET /api/cron/recurring-invoices` — replace `sendInvoiceEmail` call with `sendInvoiceEmailUtil()`
- [ ] `GET /api/cron/reminders` — add `organizationId: { not: null }` to query
- [ ] `POST /api/webhooks/mayar` — add org-scoped lookup + `isValidTransition()` check
- [ ] `scripts/migrate-invoice-status.ts` — create and run MIG-1
- [ ] `countUnpaidInvoices` Server Action — add auth + org-scope
- [ ] `checkInvoiceStatus` Server Action — make auth mandatory + org-scope

### Phase 2: RBAC Helper Deployment

**Estimated effort:** ~2h

- [ ] `sendInvoiceEmail` Server Action → auth + role wrapper around utility
- [ ] `sendReceiptEmail` Server Action → auth + role wrapper around utility
- [ ] `PATCH /api/invoices/[id]` — strip `status`, remove `cancelAtPeriodEnd`
- [ ] `DELETE /api/invoices/[id]` — add role check + PAID guard
- [ ] `PATCH /api/invoices/[id]/mark-paid` — add `requireOrgRole(['OWNER', 'ADMIN'])`
- [ ] `GET/PUT /api/settings` — relax to `requireOrgRole(['OWNER', 'ADMIN'])`
- [ ] `GET/PUT /api/subscription`, checkout, check — `requireOrgRole('OWNER')`
- [ ] `POST /api/organizations/[id]/export`, export status — `requireOrgRole('OWNER')`
- [ ] `PUT /api/organizations/[id]` — tighten to `requireOrgRole('OWNER')`
- [ ] Milestone approve/unapprove/mark-paid — add `requireOrgRole(['OWNER', 'ADMIN'])`
- [ ] Recurring invoice CUD — add `requireOrgRole(['OWNER', 'ADMIN'])`
- [ ] SOW template CUD — add `requireOrgRole(['OWNER', 'ADMIN'])`
- [ ] Audit log, agent config, team/invites view — add `requireOrgRole()`
- [ ] Final sweep: search ALL remaining API routes for uncovered role checks

### Phase 3: Critical Security Fixes

**Estimated effort:** ~1.5h

- [ ] `GET /api/recurring-invoices` — add `organizationId: orgId` filter
- [ ] `GET /api/sow-templates` — add `organizationId: orgId` filter
- [ ] `PUT /api/recurring-invoices/[id]` — field whitelist replacement
- [ ] `POST /api/invoices/[id]/retry-email` — add `requireOrgRole(['OWNER', 'ADMIN'])`
- [ ] `GET /api/events` SSE — add `auth()` + org-based filtering
- [ ] Create `POST /api/invoices/[id]/create-payment-link` — auth + role + Mayar logic
- [ ] Update `POST /api/invoices/[id]/pay` — HMAC signature verification
- [ ] Create `POST /api/invoices/[id]/void` — auth + role + transition validation

### Phase 4: Org Persistence + Settings UI

**Estimated effort:** ~1.5h

- [ ] `POST /api/organizations/[id]/switch` — update `User.defaultOrganizationId`
- [ ] `POST /api/organizations` — update `User.defaultOrganizationId` on creation
- [ ] `auth.config.ts` JWT callback — read `defaultOrganizationId` from DB
- [ ] Create `/settings/organization/page.tsx` (server component)
- [ ] Create `OrganizationSettingsForm` (client component with shadcn)
- [ ] Update `app-sidebar.tsx` — role-gated nav items
- [ ] Add server role check to `/settings/team`, `/settings/sow-template`, `/settings/agent`

### Phase 5: Notification Scoping

**Estimated effort:** ~30m

- [ ] `GET /api/notifications` — update filter to include userId
- [ ] `PATCH /api/notifications` — mark-read scoped to current user
- [ ] `createNotification()` helper — accept `userId` parameter
- [ ] `scripts/migrate-notification-userid.ts` — run MIG-2 (no-op, but run for completeness)

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `POST /api/invoices/[id]/pay` falls back to no-HMAC if `INVOICE_HMAC_SECRET` not set | Self-hosted instance unprotected | Log warning at startup and every request. Document clearly in .env.example. |
| Cron token rotation breaks cron jobs if CRON_SECRET updated without updating cron configuration | Scheduled tasks stop running | Document rotation process. Add health check endpoint for each cron route. |
| Invoice status migration (lowercase→uppercase) fails on large dataset with concurrent writes | Data inconsistency | Run migration during maintenance window. Idempotent script allows re-run. |
| `getAuthContext()` accidentally identifies a user request as system context | Auth bypass | User session is priority 1. System context only reached if no session exists. |
| Race condition: org switch on two devices simultaneously | One device's switch lost | Last write wins. Both devices converge on next login via `defaultOrganizationId` from DB. Acceptable for MVP. |
| Mayar webhook receives event for VOID invoice after transition validation added | Webhook returns 200 "skipped" instead of updating | Correct behavior. VOID is terminal. Client sees no change. |
| SSE stream memory leak (long-lived connections) | Server OOM | Already has heartbeat mechanism. No change needed. |

## 11. Open Questions

- [ ] **Resolved:** `cancelAtPeriodEnd` on Invoice PATCH — removed. Not a valid Invoice field.
- [ ] **Resolved:** Mayar webhook + VOID transition — validator check added.
- [ ] **Resolved:** Client portal `/pay` auth — HMAC signature + fallback to no-HMAC.
- [ ] **Resolved:** Cron email failure — refactored to utility, bypasses Server Action auth.
- [ ] Open: Should `scripts/` path be `scripts/` or `prisma/scripts/`? — keep `scripts/` (existing convention).
- [ ] Open: `INVOICE_HMAC_SECRET` — what's the recommended length? — Minimum 32 bytes (64 hex chars). Document in `.env.example`.