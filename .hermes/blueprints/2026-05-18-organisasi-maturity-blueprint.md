# Technical Design Document: Organisasi Maturity — Multi-Tenant Production Readiness

> **Version:** 1.0 | **Author:** Raka (TDD Architect) | **Date:** Monday, May 18, 2026
> **Based on PRD:** `docs/prd-organisasi-maturity.md`

---

## 1. Overview

Blueprint ini mendetailkan implementasi 3 functional requirements dari PRD: subscription organization-scoped (FR-1), data isolation dashboard & settings (FR-2), dan organization switcher UI (FR-3). Pendekatan teknis: **two-phase migration** untuk schema change di FR-1 agar zero-downtime, diikuti perbaikan query Prisma di FR-2 dan komponen React baru di FR-3. Semua perubahan mempertahankan backward compatibility untuk self-hosted mode.

**Key Architectural Decision:** Subscription dipindah dari `userId` (1:1 ke User) menjadi `organizationId` (1:1 ke Organization). Ini menghilangkan kebutuhan `getOrgOwnerId()` lookup di setiap `checkOrgLimit()` dan `incrementOrgUsage()`.

---

## 2. Architecture

- **Pattern:** Monorepo Next.js (App Router) — existing structure, tidak ada perubahan
- **Database:** PostgreSQL via Prisma ORM — existing
- **Auth:** NextAuth v5 (JWT) — existing
- **Migration:** Prisma migrate + custom backfill script (idempotent)

### Before vs After — Subscription Flow

```
BEFORE (user-scoped):
  checkOrgLimit(orgId, "clients")
    → getOrgOwnerId(orgId)          // EXTRA QUERY
    → getSubscription(ownerUserId)  // ANOTHER QUERY
    → count clients where orgId
    → compare

AFTER (org-scoped):
  checkOrgLimit(orgId, "clients")
    → Subscription.findUnique({ organizationId: orgId })  // SINGLE QUERY
    → count clients where orgId
    → compare
```

### File Dependency Graph

```
Phase 1: prisma/schema.prisma  ──►  src/lib/billing/subscription.ts
                              ──►  src/app/api/subscription/route.ts
                              ──►  src/app/api/subscription/checkout/route.ts
                              ──►  src/app/api/subscription/check/route.ts
                              ──►  All callers of checkLimit() / incrementUsage()

Phase 2: src/app/(dashboard)/layout.tsx
         src/app/api/settings/route.ts

Phase 3: src/app/(dashboard)/layout.tsx (tambah component)
         src/components/org-switcher.tsx (CREATE)
```

---

## 3. Data Model

### 3.1 Schema Migration — Subscription

**Phase A — Tambah kolom nullable + backfill:**

```diff
model Subscription {
  id                 String    @id @default(uuid())
- userId             String    @unique
+ organizationId     String?   // nullable dulu untuk backfill
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
- user               User      @relation(fields: [userId], references: [id])
+ // userId masih ada, organizationId nullable
}
```

**Backfill Script (idempotent, bisa dijalankan ulang):**

```typescript
// scripts/backfill-subscription-org.ts
import { prisma } from "@/lib/prisma";

async function backfill() {
  const subs = await prisma.subscription.findMany({
    where: { organizationId: null }, // Hanya row yang belum di-backfill
  });

  for (const sub of subs) {
    // Cari OWNER membership — user ini pasti punya membership
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: sub.userId, role: "OWNER" },
      orderBy: { joinedAt: "asc" },
    });

    if (!membership) {
      console.warn(`[SKIP] No OWNER membership for userId=${sub.userId}, skipping`);
      continue;
    }

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { organizationId: membership.organizationId },
    });
    console.log(`[OK] sub=${sub.id} → org=${membership.organizationId}`);
  }

  // Verifikasi: semua row sudah punya organizationId
  const remaining = await prisma.subscription.count({
    where: { organizationId: null },
  });
  console.log(`Remaining without orgId: ${remaining}`);
}
```

**Phase B — Switch constraint + hapus userId:**

```diff
model Subscription {
  id                 String    @id @default(uuid())
- userId             String    @unique
- organizationId     String?
+ organizationId     String    @unique
  // ... same fields ...
- user               User      @relation(fields: [userId], references: [id])
+ organization       Organization @relation(fields: [organizationId], references: [id])
+
+ @@index([organizationId])
}
```

### 3.2 Updated Entity Relationship

```
Organization (1) ──── (1) Subscription
     │                        │ plan, status, trialEndsAt,
     │                        │ emailsSent, invoicesCreated, paymentLinksUsed
     │
     ├── (many) OrganizationMember
     ├── (many) Client
     ├── (many) Project
     ├── (many) Invoice
     ├── (many) Settings (1:1 per org, enforced by index)
     └── (many) ... etc
```

---

## 4. API Design

### 4.1 Subscription Endpoints (FR-1)

**`GET /api/subscription`**

| Aspek | Detail |
|-------|--------|
| **Purpose** | Fetch subscription + usage untuk organisasi aktif |
| **Auth** | User (session) |
| **Old** | `getSubscription(session.user.id)` → query by `userId` |
| **New** | `findUnique({ where: { organizationId: orgId } })` |
| **Response** (200) | Sama (tidak ada breaking change) |

**`PUT /api/subscription`**

| Aspek | Detail |
|-------|--------|
| **Purpose** | Update plan subscription (OWNER/ADMIN only) |
| **Auth** | OWNER or ADMIN role |
| **Old** | `update({ where: { userId: targetUserId } })` |
| **New** | `update({ where: { organizationId: orgId } })` |
| **Note** | Body schema `{ plan: "pro" }` — sama. Hanya `userId` optional di body dihapus. |

### 4.2 Billing Helpers (FR-1)

**`checkOrgLimit(orgId, resource)` — refactor:**

```typescript
// OLD: Cari OWNER → subscription OWNER
export async function checkOrgLimit(orgId: string, resource: ResourceType) {
  if (isSelfHosted()) return { allowed: true, current: 0, limit: Infinity, plan: "business" };
  
  const sub = await prisma.subscription.findUnique({ where: { organizationId: orgId } });
  if (!sub) {
    // Auto-create trial subscription jika tidak ada (upsert pattern)
    const newSub = await prisma.subscription.create({
      data: {
        organizationId: orgId,
        plan: "pro",
        status: "TRIALING",
        trialStartedAt: new Date(),
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    return { allowed: true, current: 0, limit: Infinity, plan: "pro" };
  }
  
  // ... sisanya sama, baca PLAN_LIMITS, count resource by orgId
}
```

**`incrementOrgUsage(orgId, field)` — refactor:**

```typescript
// OLD: Cari OWNER → update subscription OWNER
// NEW: Langsung update subscription by organizationId
export async function incrementOrgUsage(orgId: string, field: UsageCounterField, amount = 1) {
  if (isSelfHosted()) return;
  try {
    await prisma.subscription.update({
      where: { organizationId: orgId },
      data: { [field]: { increment: amount } },
    });
  } catch (error) {
    console.error(`Failed to increment org usage for ${orgId} [${field}]:`, error);
  }
}
```

**Deprecated functions (di-hapus atau di-rename):**

| Function | Action | Catatan |
|----------|--------|---------|
| `getSubscription(userId)` | Ganti → `getSubscriptionByOrg(orgId)` | Semua caller update |
| `checkLimit(userId, resource)` | Hapus | Gunakan `checkOrgLimit(orgId, resource)` |
| `incrementUsage(userId, field)` | Hapus | Gunakan `incrementOrgUsage(orgId, field)` |
| `getOrgOwnerId(orgId)` | Hapus | Tidak diperlukan lagi |

### 4.3 Settings Endpoint (FR-2)

**`GET /api/settings`**

```diff
- let settings = await prisma.settings.findFirst({ where: {} });
+ let settings = await prisma.settings.findFirst({ where: { organizationId: orgId } });
```

**`GET /api/settings` — create fallback:**

```diff
    if (!settings) {
      settings = await prisma.settings.create({
-       data: { companyName: "ProjectBill", organizationId: orgId },
+       data: { companyName: "ProjectBill", organizationId: orgId },
      });
    }
```

Note: Code sudah benar (`organizationId: orgId`), tidak perlu diubah.

### 4.4 Organization Switch Endpoint (FR-3)

**`POST /api/organizations/[id]/switch`**

Sudah ada dan berfungsi baik. Tidak ada perubahan API. Response:

```json
{
  "success": true,
  "organizationId": "uuid",
  "activeOrganizationRole": "OWNER"
}
```

### 4.5 Organization List Endpoint (FR-3)

**`GET /api/organizations`**

Sudah ada dan berfungsi baik. Response:

```json
[
  {
    "id": "uuid",
    "name": "My Workspace",
    "slug": "abc123",
    "logoUrl": null,
    "role": "OWNER",
    "joinedAt": "2025-01-01T00:00:00.000Z"
  }
]
```

---

## 5. Frontend Architecture

### 5.1 Dashboard Layout Update (FR-2 + FR-3)

**File:** `src/app/(dashboard)/layout.tsx`

**Perubahan 1 — Query Prisma scoped ke org:**

```typescript
// OLD
const settings = await prisma.settings.findFirst({ where: {} });
const clients = await prisma.client.findMany({ where: {}, ... });

// NEW
const orgId = session.user.activeOrganizationId;
if (!orgId) redirect("/onboarding/organization");

const settings = await prisma.settings.findFirst({
  where: { organizationId: orgId },
});
const clients = await prisma.client.findMany({
  where: { organizationId: orgId },
  orderBy: { createdAt: "desc" },
  select: { id: true, name: true },
});
```

**Perubahan 2 — Pass data ke AppSidebar + tambah OrgSwitcher:**

```tsx
<AppSidebar
  user={dbUser || session.user}
  company={settings || undefined}
  organizations={memberships} // data baru
  activeOrgId={orgId}
/>
```

### 5.2 Organization Switcher Component (FR-3)

**New Component:** `src/components/org-switcher.tsx`

```tsx
// org-switcher.tsx
"use client";

interface OrgSwitcherProps {
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    role: string;
  }>;
  activeOrgId: string;
}

export function OrgSwitcher({ organizations, activeOrgId }: OrgSwitcherProps) {
  // Popover dengan daftar org
  // Trigger: avatar org + nama org
  // Klik org lain → panggil POST /api/organizations/{id}/switch
  // → update() session → router.push("/board") → router.refresh()
}
```

**Component Tree:**

```
AppSidebar
├── SidebarHeader (logo + app name)
├── SidebarNav (menu items)
├── SidebarFooter
│   ├── OrgSwitcher              // NEW
│   │   ├── Trigger button
│   │   └── PopoverContent
│   │       ├── Current org highlight
│   │       ├── Other orgs list
│   │       └── "Create Organization" button
│   └── UserMenu (profil + logout)
```

### 5.3 Data Fetching Flow (OrgSwitcher)

```
layout.tsx (server component)
  ├── GET /api/organizations → fetch all user orgs
  ├── Pass to AppSidebar → OrgSwitcher
  └── Pass activeOrgId from session

OrgSwitcher (client component)
  ├── Display org list from props
  ├── On switch click:
  │   ├── POST /api/organizations/{id}/switch
  │   ├── await update() // NextAuth session update
  │   ├── router.push("/board")
  │   └── router.refresh()
  └── Error handling:
      ├── 401 → redirect /login
      ├── 403 → toast "Access denied"
      └── Network → toast "Connection error"
```

---

## 6. Data Flow

### Flow 1: First Login (No Org Yet)

```
User login
→ auth() → session created
→ Dashboard layout renders
→ session.user.activeOrganizationId = undefined
→ Guard di layout: redirect /onboarding/organization
→ User create organization (POST /api/organizations)
→ Subscription auto-created with trial (di POST handler)
→ OrgSwitcher muncul dengan 1 org
```

### Flow 2: Switch Organization

```
User klik org lain di OrgSwitcher
→ Client: POST /api/organizations/{newOrgId}/switch
→ Server: verifikasi membership, return { organizationId, role }
→ Client: await update({ activeOrganizationId, activeOrganizationRole })
→ Client: router.push("/board")
→ Client: router.refresh()
→ Server: layout.tsx re-render dengan orgId baru
→ Semua query Prisma otomatis scoped ke orgId baru
```

### Flow 3: Check Limit (After Migration)

```
User create new client
→ POST /api/clients
→ checkOrgLimit(orgId, "clients") dipanggil
→ Subscription.findUnique({ where: { organizationId: orgId } })  // LANGSUNG
→ Count clients where organizationId: orgId
→ Compare current < limit
→ Allow or reject
```

---

## 7. Security

| Aspek | Status |
|-------|--------|
| **Authentication** | NextAuth v5 JWT — unchanged |
| **Authorization** | ORGANIZATION-scoped via `activeOrganizationId` di session |
| **RBAC** | Existing: OWNER > ADMIN > MEMBER. Tidak ada perubahan di phase ini |
| **Input validation** | Zod — unchanged |
| **Switch verification** | `switch` endpoint verify membership via `OrganizationMember.findUnique` — aman |
| **Data isolation** | Semua query Prisma harus punya `organizationId` filter — di-enforce via FR-2 fix |

---

## 8. Implementation Phases

### Phase 1: Foundation — Subscription Org-Scoped (FR-1)

**8 files, ~2-3 commits**

| # | Task | Files | Est. |
|---|------|-------|------|
| 1 | Schema: tambah `organizationId` nullable ke `Subscription` | `prisma/schema.prisma` | 5m |
| 2 | Backfill script: idempotent, untuk setiap subscription cari OWNER | `scripts/backfill-subscription-org.ts` | 15m |
| 3 | Schema: hapus `userId`, `unique` pindah ke `organizationId`, tambah relasi | `prisma/schema.prisma` | 5m |
| 4 | Refactor `checkOrgLimit()` — langsung query `findUnique({ organizationId })` | `src/lib/billing/subscription.ts` | 10m |
| 5 | Refactor `incrementOrgUsage()` — langsung update `organizationId` | `src/lib/billing/subscription.ts` | 5m |
| 6 | Deprecate: hapus `checkLimit()`, `incrementUsage()`, `getOrgOwnerId()` | `src/lib/billing/subscription.ts` | 5m |
| 7 | Update `GET /api/subscription` — query by `organizationId` | `src/app/api/subscription/route.ts` | 5m |
| 8 | Update `PUT /api/subscription` — query by `organizationId` | `src/app/api/subscription/route.ts` | 5m |
| 9 | Update `POST /api/organizations` — auto-create subscription with trial | `src/app/api/organizations/route.ts` | 5m |
| 10 | Update `POST /api/organizations/[id]/delete` — hapus subscription juga | `src/app/api/organizations/[id]/delete/route.ts` | 5m |
| 11 | Update `POST /api/subscription/checkout` — query by `organizationId` | `src/app/api/subscription/checkout/route.ts` | 5m |
| 12 | Update `GET /api/subscription/check` — query by `organizationId` | `src/app/api/subscription/check/route.ts` | 5m |

### Phase 2: Data Isolation (FR-2)

**2 files, ~1 commit**

| # | Task | Files | Est. |
|---|------|-------|------|
| 13 | Dashboard layout: tambah guard `!orgId` + scoped Prisma queries | `src/app/(dashboard)/layout.tsx` | 10m |
| 14 | Settings GET: scoped `findFirst({ organizationId: orgId })` | `src/app/api/settings/route.ts` | 5m |

### Phase 3: Organization Switcher UI (FR-3)

**2 files, ~1 commit**

| # | Task | Files | Est. |
|---|------|-------|------|
| 15 | Buat `OrgSwitcher` component | `src/components/org-switcher.tsx` | 30m |
| 16 | Integrasikan ke `AppSidebar` + pass data dari `layout.tsx` | `src/components/app-sidebar.tsx` + `layout.tsx` | 15m |

---

## 9. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Backfill gagal — ada subscription tanpa OWNER membership | Data corrupt, `organizationId` tetap null | Medium | Backfill skip + log. Phase A tidak ubah constraint — aman. Cari manual setelahnya |
| Phase B — row dengan `organizationId: null` masih ada | Unique constraint gagal di deploy | Low | **Pre-flight check** sebelum Phase B: `count({ where: { organizationId: null } })` — jika > 0, block migration |
| User dengan multiple SUBSCRIPTION rows (data corrupt) | `@unique` constraint gagal di Phase B | Low | Query `groupBy` di backfill script untuk deteksi duplikat sebelum Phase B. Handle: merge ke satu row, drop duplicate |
| Self-hosted DB tidak punya subscription sama sekali | `checkOrgLimit()` crash | Low | `findUnique` return null → auto-create trial. Self-hosted selalu bypass di guard pertama |
| OrgSwitcher trigger infinite re-render loop | UI freeze | Low | `update() session → router.refresh()` — pastikan callback hanya fire sekali. Guard: `if (orgId === activeOrgId) return` |
| User switch org saat ada form yang belum di-save | Data hilang | Medium | Tambahkan `beforeSwitch()` callback: deteksi `formState.isDirty` di form active. Jika dirty, tampilkan confirm dialog "You have unsaved changes" sebelum switch |

---

## 10. Open Questions

- [ ] **Org icon/logo untuk OrgSwitcher:** Saat ini `Organization.logoUrl` sudah ada di schema, tapi tidak ada UI untuk upload. Phase ini skip — gunakan avatar dengan inisial nama org sebagai fallback.
- [ ] **"Create Organization" button di OrgSwitcher:** PRD mention sebagai opsional. Implementasi minimal — tampilkan link `+` di footer switcher yang redirect ke `/settings/organization/new`. Page tersebut sudah ada? Akan dicek saat implementasi.

---

## 11. Blueprint-to-PRD Gap Audit

| Check | Result |
|-------|--------|
| **FR-1: Migration plan detail** | ✅ Covered — Phase A (backfill) + Phase B (switch) |
| **FR-1: Auto-create trial subscription** | ✅ `checkOrgLimit()` upsert fallback |
| **FR-1: `checkOrgLimit` refactor** | ✅ Langsung query, tanpa cari OWNER |
| **FR-1: Deprecated functions removal** | ✅ `checkLimit`, `incrementUsage`, `getOrgOwnerId` marked |
| **FR-2: layout.tsx guard `!orgId`** | ✅ Redirect guard |
| **FR-2: settings/route.ts fix** | ✅ Scoped query |
| **FR-3: OrgSwitcher component** | ✅ New file + integration plan |
| **FR-3: Sidebar footer placement** | ✅ Component tree diagram |
| **FR-3: Error handling** | ✅ 401, 403, Network |
| **Edge case: Dua OWNER** | ✅ Backfill `orderBy: { joinedAt: "asc" }` ambil pertama |
| **Edge case: Session expired switch** | ✅ 401 → redirect login with callbackUrl |
| **Edge case: User baru no org** | ✅ Redirect guard |
| **Self-hosted backward compat** | ✅ Semua bypass tetap di `isSelfHosted()` guard pertama |
