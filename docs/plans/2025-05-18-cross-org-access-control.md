# Cross-Organization Access Control Hardening

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Tambahkan filter `organizationId` ke semua query Prisma di API endpoints untuk mencegah cross-organization data access — user di Org A tidak boleh membaca/mengubah data milik Org B.

**Architecture:** Setiap endpoint yang menerima entity ID dari URL harus memverifikasi bahwa entity tersebut milik organisasi yang aktif dari session user. Pattern standar: tambahkan `organizationId: orgId` ke `where` clause di setiap query `findFirst`, `findUnique`, `update`, `delete`, dan `deleteMany`.

**Tech Stack:** Next.js, TypeScript, Prisma, NextAuth v5

**Severity:** CRITICAL — data isolation / multi-tenancy boundary violation

---

## Deep Analysis

### Serangan yang Mungkin

**Scenario 1 — ID tebakan (UUID v4, low probability tapi tetap valid):**
1. Attacker di Org A login, session punya `activeOrganizationId: orgA`
2. Attacker tahu UUID client milik Org B (dari log, referrer header, atau bruteforce)
3. `PATCH /api/clients/:id` → Prisma `where: { id }` → update sukses meski client milik Org B
4. `GET /api/projects/:id` → `where: { id }` → membaca data project Org B

**Scenario 2 — ID enumeration via error messages:**
- `findFirst({ where: { id } })` tidak ditemukan → 404 "Client not found"
- `findFirst({ where: { id, organizationId: orgId } })` tidak ditemukan → 404 juga
- Tapi di endpoint **projects** jika ada `findFirst` diikuti `update` tanpa orgId, ini double-blow: read + write sekaligus

### Classification by Severity

| Severity | Files | Risk |
|----------|-------|------|
| **CRITICAL — Read + Write** | `clients/[id]`, `projects/[id]`, `invoices/[id]`, `recurring-invoices/[id]`, `sow-templates/[id]`, `projects/[id]/accept-terms` | Attacker bisa membaca + mengubah data milik org lain |
| **HIGH — Write only** | `invoices/[id]/mark-paid` (update), `projects/[id]/items/[itemId]` (update/delete), `invoices/generate` (project lookup) | Write path terlindungi sebagian oleh auth check sebelumnya |
| **MEDIUM — Partial org protection** | `projects/[id]/milestones/` (project lookup di beberapa path), `organizations/[id]/*` | Beberapa query aman, beberapa tidak |
| **LOW / SAFE** | `settings/route.ts` (single org pattern), `milestones/[milestoneId]/approve` | Sudah punya orgId |

### Existing Protected vs Unprotected Queries Mapping

```
FILE                                    | FIND/FETCH           | UPDATE/DELETE
----------------------------------------|----------------------|--------------------
clients/[id]/route.ts                   | findFirst ❌ (×2)   | update ❌, delete ❌
projects/[id]/route.ts                  | findFirst ❌ (×2)   | update ❌, delete ❌
projects/[id]/accept-terms/route.ts     | findUnique ❌ (×2)  | update ❌
invoices/[id]/route.ts                  | findFirst ❌ (×2)   | update ❌, delete ❌
invoices/[id]/mark-paid/route.ts        | findUnique ✅       | update ❌
invoices/generate/route.ts              | findFirst ❌        | N/A
recurring-invoices/[id]/route.ts        | findFirst ❌ (×2)   | update ❌, delete ❌
sow-templates/[id]/route.ts             | findFirst ❌        | delete ❌
projects/[id]/items/[itemId]/route.ts   | findFirst ✅ (×2)  | update ❌, delete ❌
projects/[id]/milestones/[mid]/route.ts | findFirst ✅        | update ✅, misc: project ❌
projects/[id]/milestones/[mid]/mark-paid| findFirst ✅        | update ✅, invoice ❌
organizations/[id]/route.ts             | membership ✅       | update ❌
organizations/[id]/delete/route.ts      | membership ✅       | update ❌, deleteMany ✅

✅ = has organizationId filter
❌ = missing organizationId filter
```

---

## Tasks

### Task 1: Fix clients/[id]/route.ts — PATCH & DELETE handlers

**Objective:** Tambahkan `organizationId: orgId` ke semua query di client endpoint.

**File:** `src/app/api/clients/[id]/route.ts`

**Queries to fix (5 total):**

PATCH handler:
- Line 20: `findFirst({ where: { id } })` → `findFirst({ where: { id, organizationId: orgId } })`
- Line 28: `update({ where: { id } })` → `update({ where: { id, organizationId: orgId } })`

DELETE handler:
- Line 65: `findFirst({ where: { id } })` → `findFirst({ where: { id, organizationId: orgId } })`
- Line 83: `update({ where: { id } })` → `update({ where: { id, organizationId: orgId } })`
- Line 88: `delete({ where: { id } })` → `delete({ where: { id, organizationId: orgId } })`

**Note:** `orgId` sudah ada di scope (line 18 for PATCH, line 79 for DELETE). Tidak perlu tambahan.

**Commit:**
```bash
git add src/app/api/clients/\[id\]/route.ts && git commit -m "security: add organizationId filter to all Prisma queries in clients/[id] endpoint"
```

---

### Task 2: Fix projects/[id]/route.ts — GET, PATCH & DELETE handlers

**Objective:** Tambahkan `organizationId: orgId` ke semua query di project endpoint.

**File:** `src/app/api/projects/[id]/route.ts`

**Queries to fix (5 total):**

GET handler (line ~47): `findFirst({ where: { id } })` → `findFirst({ where: { id, organizationId: orgId } })`

PATCH handler:
- Line ~117: `findFirst({ where: { id } })` → `findFirst({ where: { id, organizationId: orgId } })`
- Line ~122: `update({ where: { id } })` → `update({ where: { id, organizationId: orgId } })`

DELETE handler:
- Line ~173: `deleteMany({ where: { projectId: id } })` → `deleteMany({ where: { projectId: id, organizationId: orgId } })`
- Line ~174: `delete({ where: { id } })` → `delete({ where: { id, organizationId: orgId } })`

**Commit:**
```bash
git add src/app/api/projects/\[id\]/route.ts && git commit -m "security: add organizationId filter to all Prisma queries in projects/[id] endpoint"
```

---

### Task 3: Fix invoices/[id]/route.ts — GET, PATCH & DELETE handlers

**Objective:** Tambahkan `organizationId: orgId` ke semua query di invoice endpoint.

**File:** `src/app/api/invoices/[id]/route.ts`

**Queries to fix (4 total):**

- Line 20: `findFirst({ where: { id } })` → `findFirst({ where: { id, organizationId: orgId } })`
- Line 33: `update({ where: { id } })` → `update({ where: { id, organizationId: orgId } })`
- Line 57: `findFirst({ where: { id } })` → `findFirst({ where: { id, organizationId: orgId } })`
- Line 64: `delete({ where: { id } })` → `delete({ where: { id, organizationId: orgId } })`

**Commit:**
```bash
git add src/app/api/invoices/\[id\]/route.ts && git commit -m "security: add organizationId filter to all Prisma queries in invoices/[id] endpoint"
```

---

### Task 4: Fix recurring-invoices/[id]/route.ts

**Objective:** Tambahkan `organizationId: orgId` ke semua query di recurring invoice endpoint.

**File:** `src/app/api/recurring-invoices/[id]/route.ts`

**Queries to fix (4 total):**

- Line 19: `findFirst({ where: { id } })` → `findFirst({ where: { id, organizationId: orgId } })`
- Line 27: `findFirst({ where: { id } })` → `findFirst({ where: { id, organizationId: orgId } })`
- Line 50: `update({ where: { id } })` → `update({ where: { id, organizationId: orgId } })`
- Line 58: `delete({ where: { id } })` → `delete({ where: { id, organizationId: orgId } })`

**Commit:**
```bash
git add src/app/api/recurring-invoices/\[id\]/route.ts && git commit -m "security: add organizationId filter to all Prisma queries in recurring-invoices/[id] endpoint"
```

---

### Task 5: Fix sow-templates/[id]/route.ts

**Objective:** Tambahkan `organizationId: orgId` ke semua query di SOW template endpoint.

**File:** `src/app/api/sow-templates/[id]/route.ts`

**Queries to fix (2 total):**

- Line 18: `findFirst({ where: { id } })` → `findFirst({ where: { id, organizationId: orgId } })`
- Line 39: `delete({ where: { id } })` → `delete({ where: { id, organizationId: orgId } })`

**Commit:**
```bash
git add src/app/api/sow-templates/\[id\]/route.ts && git commit -m "security: add organizationId filter to all Prisma queries in sow-templates/[id] endpoint"
```

---

### Task 6: Fix projects/[id]/accept-terms/route.ts

**Objective:** Tambahkan `organizationId: orgId` ke findUnique dan update di accept-terms.

**File:** `src/app/api/projects/[id]/accept-terms/route.ts`

**Queries to fix (3 total):**

- Line 18: `findUnique({ where: { id } })` → `findUnique({ where: { id, organizationId: orgId } })`
- Line 47: `update({ where: { id } })` → `update({ where: { id, organizationId: orgId } })`
- Line 67: `findUnique({ where: { id } })` → `findUnique({ where: { id, organizationId: orgId } })`

**Note:** `orgId` harus diambil dari `session.user.activeOrganizationId` (tidak ada di scope saat ini di accept-terms handler).

**Commit:**
```bash
git add src/app/api/projects/\[id\]/accept-terms/route.ts && git commit -m "security: add organizationId filter to Prisma queries in projects/[id]/accept-terms endpoint"
```

---

### Task 7: Fix invoices/[id]/mark-paid/route.ts — update query

**Objective:** Tambahkan `organizationId: orgId` ke update invoice saat mark-paid.

**File:** `src/app/api/invoices/[id]/mark-paid/route.ts`

**Queries to fix (1 total):**

- Line 48: `update({ where: { id } })` → `update({ where: { id, organizationId: orgId } })`

**Commit:**
```bash
git add src/app/api/invoices/\[id\]/mark-paid/route.ts && git commit -m "security: add organizationId filter to invoice update in mark-paid endpoint"
```

---

### Task 8: Fix invoices/generate/route.ts — project lookup

**Objective:** Tambahkan `organizationId: orgId` ke project findFirst di invoice generation.

**File:** `src/app/api/invoices/generate/route.ts`

**Queries to fix (1 total):**

- Line 21: `findFirst({ where: { id: projectId } })` → `findFirst({ where: { id: projectId, organizationId: orgId } })`

**Commit:**
```bash
git add src/app/api/invoices/generate/route.ts && git commit -m "security: add organizationId filter to project lookup in invoices/generate endpoint"
```

---

### Task 9: Fix projects/[id]/items/[itemId]/route.ts — writeback queries

**Objective:** Tambahkan `organizationId: orgId` ke update dan delete writeback di items endpoint.

**File:** `src/app/api/projects/[id]/items/[itemId]/route.ts`

**Queries to fix (2 total):**

- Line 47: `update({ where: { id: itemId } })` → `update({ where: { id: itemId, organizationId: orgId } })`
- Line 50: `delete({ where: { id: projectId } })` → `delete({ where: { id: projectId, organizationId: orgId } })`

**Commit:**
```bash
git add src/app/api/projects/\[id\]/items/\[itemId\]/route.ts && git commit -m "security: add organizationId filter to writeback queries in items/[itemId] endpoint"
```

---

### Task 10: Fix projects/[id]/milestones/[milestoneId]/route.ts — project lookup

**Objective:** Tambahkan `organizationId: orgId` ke project lookup di milestone endpoint.

**File:** `src/app/api/projects/[id]/milestones/[milestoneId]/route.ts`

**Queries to fix (1 total):**

- Line 59: `findFirst({ where: { id: projectId } })` → `findFirst({ where: { id: projectId, organizationId: orgId } })`

**Commit:**
```bash
git add src/app/api/projects/\[id\]/milestones/\[milestoneId\]/route.ts && git commit -m "security: add organizationId filter to project lookup in milestone endpoint"
```

---

### Task 11: Fix projects/[id]/milestones/[milestoneId]/mark-paid/route.ts — invoice lookup

**Objective:** Tambahkan `organizationId: orgId` ke invoice lookup di mark-paid milestone.

**File:** `src/app/api/projects/[id]/milestones/[milestoneId]/mark-paid/route.ts`

**Queries to fix (1 total):**

- Line 40: `findFirst({ where: { id: milestone.invoiceId } })` → `findFirst({ where: { id: milestone.invoiceId, organizationId: orgId } })`

**Commit:**
```bash
git add src/app/api/projects/\[id\]/milestones/\[milestoneId\]/mark-paid/route.ts && git commit -m "security: add organizationId filter to invoice lookup in milestone mark-paid endpoint"
```

---

### Task 12: Final sweep — verify zero remaining gaps

**Objective:** Jalankan script grep untuk memastikan tidak ada lagi query Prisma di `/api` yang memakai `id` tanpa `organizationId`.

```bash
cd /root/projects/project-bill/src/app/api && grep -rn "where:.*{.*id[^}]*}" --include="route.ts" | grep -v "organizationId" | grep -v "userId" | grep -v "token" | grep -v "email" | grep -v "cron" | grep -v "webhook"
```

Expected: Zero results (atau hanya hasil yang justified — seperti cron jobs, webhook endpoints yang tidak session-based, dan query yang pakai composite key seperti `userId_organizationId`).

---

## Verification Checklist

### Per-endpoint:
- [ ] `GET/PATCH/DELETE /api/clients/:id` — user Org A tidak bisa akses client Org B → 404
- [ ] `GET/PATCH/DELETE /api/projects/:id` — user Org A tidak bisa akses project Org B → 404
- [ ] `GET/PATCH/DELETE /api/invoices/:id` — user Org A tidak bisa akses invoice Org B → 404
- [ ] `PATCH/DELETE /api/recurring-invoices/:id` — user Org A tidak bisa akses → 404
- [ ] `DELETE /api/sow-templates/:id` — user Org A tidak bisa akses → 404
- [ ] `POST /api/projects/:id/accept-terms` — user Org A tidak bisa accept terms Org B → 404
- [ ] `POST /api/invoices/:id/mark-paid` — user Org A tidak bisa mark-paid invoice Org B → 404
- [ ] `POST /api/invoices/generate` — user Org A tidak bisa generate invoice dari project Org B → 404
- [ ] `PATCH/DELETE /api/projects/:id/items/:itemId` — writeback aman
- [ ] `PATCH/DELETE /api/projects/:id/milestones/:milestoneId` — project lookup aman
- [ ] `POST /api/projects/:id/milestones/:milestoneId/mark-paid` — invoice lookup aman

### Edge Cases:
1. **User pindah organisasi mid-session:** Session `activeOrganizationId` selalu up-to-date dari NextAuth — aman.
2. **OWNER role bypass:** OWNER tetap harus punya `organizationId` filter — OWNER di Org A tidak boleh akses data Org B.
3. **404 ambiguity:** Setelah fix, user Org A mengakses UUID Org B yang valid mendapat 404 (sama seperti UUID yang tidak exist). **Ini desirable** — tidak membocorkan informasi apakah ID exist di org lain.
4. **Performance:** `organizationId` field sudah indexed di Prisma schema — tidak ada regression.

---

## Commit Plan

| # | Commit Message | Files |
|---|---------------|-------|
| 1 | `security: add organizationId filter to all Prisma queries in clients/[id] endpoint` | `api/clients/[id]/route.ts` |
| 2 | `security: add organizationId filter to all Prisma queries in projects/[id] endpoint` | `api/projects/[id]/route.ts` |
| 3 | `security: add organizationId filter to all Prisma queries in invoices/[id] endpoint` | `api/invoices/[id]/route.ts` |
| 4 | `security: add organizationId filter to recurring-invoices/[id] endpoint` | `api/recurring-invoices/[id]/route.ts` |
| 5 | `security: add organizationId filter to sow-templates/[id] endpoint` | `api/sow-templates/[id]/route.ts` |
| 6 | `security: add organizationId filter to accept-terms endpoint` | `api/projects/[id]/accept-terms/route.ts` |
| 7 | `security: add organizationId filter to invoice mark-paid endpoint` | `api/invoices/[id]/mark-paid/route.ts` |
| 8 | `security: add organizationId filter to invoices/generate endpoint` | `api/invoices/generate/route.ts` |
| 9 | `security: add organizationId filter to items writeback queries` | `api/projects/[id]/items/[itemId]/route.ts` |
| 10 | `security: add organizationId filter to milestone project lookup` | `api/projects/[id]/milestones/[mid]/route.ts` |
| 11 | `security: add organizationId filter to milestone mark-paid invoice lookup` | `api/projects/[id]/milestones/[mid]/mark-paid/route.ts` |
| 12 | `security: final sweep — verify zero remaining orphan queries` | verification only |
