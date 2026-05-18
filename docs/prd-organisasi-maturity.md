# PRD: Organisasi Maturity — Multi-Tenant Production Readiness

> **Version:** 1.0 | **Author:** Naya (PRD Architect) | **Date:** Monday, May 18, 2026
> **Stakeholder:** MRNX Studio | **Project:** ProjectBill

---

## 1. Executive Summary

ProjectBill memiliki fondasi multi-tenant di schema database — semua entity memiliki `organizationId`. Namun implementasi di atasnya masih setengah jalan: subscription terikat ke **user** (bukan organisasi), dashboard layout **bocor data** antar organisasi, dan **tidak ada UI** untuk berpindah organisasi. PRD ini mendokumentasikan perbaikan **3 pilar kritis** yang harus diselesaikan sebelum fitur organisasi bisa dinyatakan production-ready.

**Target user:** OWNER dan ADMIN organisasi yang ingin mengelola workspace dengan banyak anggota secara aman. **North Star:** "User di Org A tidak bisa melihat atau mengakses data milik Org B — baik dari UI maupun API."

---

## 2. Problem Statement

### Pain Points Saat Ini

| # | Masalah | Siapa yang Terkena Dampak | Severity |
|---|---------|---------------------------|----------|
| 1 | Subscription 1:1 User → OWNER bayar untuk SEMUA member tanpa transparansi limit per-org. Kalau OWNER leave, subscription hilang. | OWNER, ADMIN, MEMBER | 🔴 Critical |
| 2 | Dashboard layout (`layout.tsx`) query `client.findMany({ where: {} })` → sidebar menampilkan client dari SEMUA organisasi. Settings GET juga tanpa `organizationId` filter. | Semua user di semua organisasi | 🔴 Data Leak |
| 3 | Tidak ada UI untuk pindah organisasi. API switch sudah ada (`POST /api/organizations/[id]/switch`), tapi tidak ada component yang memanggilnya. User terjebak di `defaultOrganizationId`. | ADMIN, MEMBER yang punya >1 organisasi | 🟠 UX Blocker |

### Akar Masalah Arsitektural

```
Model Subscription: userId (unique, 1:1)
         ↓
checkOrgLimit() → cari OWNER → ambil Subscription OWNER
         ↓
Kalau OWNER tidak ditemukan → allowed: false (semua endpoint gagal)
Kalau OWNER downgrade → semua member kena dampak tanpa transparansi
Kalau OWNER leave → tidak ada mekanisme transfer
```

### Existing Alternatives & Shortcomings

| Alternatif | Kenapa Gagal |
|-----------|-------------|
| Manual filter di setiap API endpoint | Sudah dilakukan (cross-org hardening), tapi dashboard layout masih bypass karena query di server component |
| `defaultOrganizationId` di User model | Hanya set saat login/create — tidak ada cara untuk mengubah tanpa `update()` session |
| Hardcode single-org assumption | Settings `findFirst({ where: {} })` — return row pertama yang ditemukan, tidak deterministik |

---

## 3. Goals & Success Metrics

| Goal Type | Description | KPI |
|-----------|-------------|-----|
| **Security** | Tidak ada data leak antar organisasi di level manapun (UI, API, side-effect) | Zero cross-org data visible via any query path |
| **Business** | Subscription billing akurat per-organisasi, OWNER bisa mengelola plan tanpa mempengaruhi organisasi lain | `checkOrgLimit()` tidak lagi bergantung pada keberadaan OWNER |
| **UX** | User bisa melihat dan berpindah organisasi langsung dari dashboard | Org switcher < 2 klik dari halaman manapun |
| **Technical** | Migration dari user-scoped ke org-scoped tanpa data loss atau downtime | Semua user existing tetap bisa login dan memiliki subscription setelah migration |

---

## 4. User Personas

### Persona A: OWNER (Pembuat Organisasi)
- **Motivasi:** Ingin mengelola workspace, invite team member, kontrol billing plan
- **Frustrasi saat ini:** Bayar subscription tapi tidak bisa lihat siapa yang pakai resource. Takut kalau member lain bisa lihat data organisasi lain.
- **Ekspektasi setelah fix:** Subscription terikat ke organisasi yang dia buat. Bisa switch antar organisasi yang dia miliki.

### Persona B: ADMIN / MEMBER
- **Motivasi:** Kolaborasi di organisasi tanpa mengelola billing
- **Frustrasi saat ini:** Tidak bisa pindah organisasi setelah di-invite ke beberapa organisasi. Tidak transparan limit mana yang berlaku.
- **Ekspektasi setelah fix:** Bisa melihat organisasi mana yang sedang aktif. Bisa switch organisasi. Tahu limit yang berlaku untuk organisasi yang aktif.

---

## 5. User Stories (Prioritized)

### P0 — MVP (Harus diselesaikan di phase ini)

| ID | Story | Acceptance |
|----|-------|-----------|
| **US-01** | Sebagai OWNER, saya ingin subscription terikat ke organisasi, bukan ke user saya pribadi, sehingga ketika saya invite member, limit yang dipakai adalah limit organisasi | Subscription model punya `organizationId`. `checkOrgLimit()` langsung query tanpa cari OWNER. OWNER tetap bisa manage billing. |
| **US-02** | Sebagai MEMBER di Org A, saya TIDAK ingin melihat client/project/invoice milik Org B di sidebar atau halaman manapun | Dashboard layout dan semua server component query pakai `organizationId: session.user.activeOrganizationId` |
| **US-03** | Sebagai ADMIN yang menjadi member di 3 organisasi, saya ingin bisa memilih organisasi mana yang sedang saya kerjakan dari UI dashboard | Tersedia dropdown/switcher di sidebar/header yang menampilkan semua organisasi user dan memungkinkan switch dalam 1 klik |

---

## 6. Functional Requirements

### FR-1: Subscription Organization-Scoped

**Description:** Mengubah model `Subscription` dari terikat ke `User` (1:1) menjadi terikat ke `Organization` (1:1). Setiap organisasi memiliki subscription plan-nya sendiri. OWNER tetap menjadi pihak yang mengelola billing, tetapi subscription adalah atribut organisasi.

**Schema Migration:**

```diff
model Subscription {
  id                 String    @id @default(uuid())
- userId             String    @unique
+ organizationId     String    @unique
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
+ organization       Organization @relation(fields: [organizationId], references: [id])
+
+ @@index([organizationId])
}
```

**Migration Strategy (Two-Phase):**

> ⚠️ Ini adalah breaking schema change. Butuh dua phase deployment:

**Phase A — Add column + backfill (zero-downtime):**
1. Tambah `organizationId String?` ke `Subscription` (nullable dulu)
2. Deploy, jalankan backfill script: untuk setiap subscription, cari OWNER organisasi dari user bersangkutan, set `organizationId`
3. Pastikan semua row memiliki `organizationId`

**Phase B — Switch primary key (short maintenance window):**
1. Hapus `userId` field + `@unique` constraint
2. Tambah `@unique` ke `organizationId`
3. Hapus relasi `user User`
4. Tambah relasi `organization Organization`
5. Update semua code yang referensi `subscription.userId` → gunakan `getOrgOwnerId()` untuk lookup balik

**API Changes:**

| Endpoint | Old | New |
|----------|-----|-----|
| `GET /api/subscription` | Query by `userId` | Query by `organizationId` dari session |
| `PUT /api/subscription` | Update `userId` target | Update `organizationId` target |
| `POST /api/subscription/checkout` | Create by `userId` | Create/update by `organizationId` |
| `checkOrgLimit(orgId, resource)` | Cari OWNER → subscription OWNER | Query `subscription.findUnique({ organizationId })` langsung |
| `incrementOrgUsage(orgId, field)` | Cari OWNER → update subscription OWNER | `subscription.update({ where: { organizationId } })` langsung |

**Deprecated functions (migrate atau hapus):**

- `checkLimit(userId, resource)` — user-scoped, ganti semua caller ke `checkOrgLimit(orgId, resource)`
- `incrementUsage(userId, field)` — user-scoped, ganti semua caller ke `incrementOrgUsage(orgId, field)`
- `getSubscription(userId)` — ganti ke `getSubscriptionByOrg(orgId)`

**Acceptance Criteria:**

- [ ] AC-1: `Subscription` model memiliki `organizationId` sebagai unique key, bukan `userId`
- [ ] AC-2: Semua user existing di managed mode memiliki subscription per organisasi setelah migration (tidak ada yang kehilangan akses)
- [ ] AC-3: `checkOrgLimit(orgId, "teamMembers")` return count member **dalam organisasi itu**, bukan count global
- [ ] AC-4: Self-hosted mode tetap bypass semua limit check (tidak ada perubahan behavior)
- [ ] AC-5: OWNER masih bisa upgrade/downgrade plan via `/settings/subscription` setelah migration
- [ ] AC-6: Saat create organisasi baru, subscription otomatis dibuat dengan trial 14 hari

**Edge Cases:**

- **User jadi OWNER di 2+ organisasi:** Masing-masing organisasi punya subscription sendiri. Switch org = switch subscription context.
- **OWNER leave organisasi:** Subscription tetap di organisasi. `checkOrgLimit()` tetap berfungsi tanpa OWNER. Billing contact perlu ditunjuk ADMIN baru (out of scope phase ini — gunakan fallback: tampilkan warning "no billing contact").
- **Dua OWNER di satu organisasi:** Schema tidak enforce single OWNER. `getOrgOwnerId()` mungkin return first match yang tidak konsisten. Mitigasi: return row dengan `joinedAt` paling awal sebagai canonical OWNER.
- **Organisasi tanpa subscription (data corrupt atau row dihapus manual):** `checkOrgLimit()` return `{ allowed: false, plan: "starter" }` dengan log error. Jangan crash. **Tambahan:** Auto-create trial subscription di background jika row tidak ditemukan (`upsert` pattern): jika `findUnique` return null, buat subscription baru dengan trial 14 hari (PRO plan) agar user tidak terkunci.
- **Downgrade dari PRO ke STARTER saat usage > limit:** Allow downgrade tapi tampilkan warning bahwa beberapa resource akan terkunci (block create baru, tidak hapus data existing).

---

### FR-2: Dashboard Layout Data Isolation

**Description:** Memperbaiki semua query di server component `layout.tsx` dan API `settings` yang tidak menggunakan `organizationId` filter. Setiap query harus scoped ke `session.user.activeOrganizationId`.

**Files to Fix:**

| File | Query | Fix |
|------|-------|-----|
| `src/app/(dashboard)/layout.tsx:44-46` | `settings.findFirst({ where: {} })` | `settings.findFirst({ where: { organizationId: session.user.activeOrganizationId } })` |
| `src/app/(dashboard)/layout.tsx:48-52` | `client.findMany({ where: {} })` | `client.findMany({ where: { organizationId: session.user.activeOrganizationId } })` |
| `src/app/api/settings/route.ts:19-21` | `settings.findFirst({ where: {} })` | `settings.findFirst({ where: { organizationId: orgId } })` |

**Note about `layout.tsx:39-42`:**

```typescript
const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, onboardingCompleted: true },
});
```

Query ini **aman** — user-scoped, bukan org-scoped. Tidak perlu diubah.

**Acceptance Criteria:**

- [ ] AC-1: Sidebar di dashboard hanya menampilkan client milik organisasi yang sedang aktif
- [ ] AC-2: Settings GET hanya mengembalikan settings untuk organisasi aktif
- [ ] AC-3: `settings.create` di handler GET (line 23-27) pakai `organizationId: orgId`, bukan kosong
- [ ] AC-4: Tidak ada query `findFirst({ where: {} })` atau `findMany({ where: {} })` di kode dashboard/API yang menangani data organisasi

**Edge Cases:**

- **User login pertama kali setelah register (belum ada settings):** `findFirst` return null → `settings.create` dibuat dengan `organizationId` yang benar.
- **OrganizationId di session null/undefined:** Jangan query Prisma dengan `organizationId: undefined` — ini akan return null atau error. Harus ada guard: jika `!session.user.activeOrganizationId`, redirect ke halaman create-organization atau tampilkan empty state "No organization selected" tanpa memanggil Prisma sama sekali.

---

### FR-3: Organization Switcher UI

**Description:** Menambahkan komponen UI yang memungkinkan user melihat daftar organisasi tempat dia menjadi member, melihat organisasi mana yang sedang aktif, dan berpindah organisasi.

**UI Placement:** Sidebar footer (mirip pattern Slack, Notion, Linear workspace switcher) **dan/atau** header navbar dropdown.

**Flow:**

```
User klik org switcher (sidebar footer)
  → Popover/Dropdown muncul
  → Menampilkan daftar organisasi (nama, role badge, tanda ✓ untuk yang aktif)
  → User klik organisasi lain
  → Panggil POST /api/organizations/{id}/switch
  → Update session via client-side session update
  → Reload halaman / redirect ke dashboard
  → Semua data sekarang scoped ke organisasi baru
```

**API Integration:**

Switcher sudah didukung oleh API yang sudah ada:

```
POST /api/organizations/[id]/switch
  → Mengecek membership user di org tersebut
  → Return { organizationId, activeOrganizationRole }
  → Client update session dengan data baru
```

**Component Tree:**

```
<OrganizationSwitcher>
  ├─ Button trigger (avatar org + nama org + chevron)
  ├─ PopoverContent
  │   ├─ Current org highlight
  │   ├─ Divider
  │   ├─ List organisasi lain
  │   │   └─ OrganizationItem (nama, role badge, icon)
  │   └─ Divider
  │   └─ "Create Organization" button (jika ada)
  └─ Loading state saat switch
```

**Data Fetching:**

- `GET /api/organizations` → return semua organisasi user (sudah ada, line 17-28)
- Response format: `[{ id, name, slug, logoUrl, role, joinedAt }]`

**Session Update Flow:**

```typescript
// Di component client:
async function switchOrganization(orgId: string) {
    const res = await fetch(`/api/organizations/${orgId}/switch`, { method: "POST" });
    const data = await res.json();
    
    // Update NextAuth session client-side
    await update({
        activeOrganizationId: data.organizationId,
        activeOrganizationRole: data.activeOrganizationRole,
    });
    
    // Redirect ke dashboard dengan org baru
    router.push("/board");
    router.refresh();
}
```

**Acceptance Criteria:**

- [ ] AC-1: Switcher menampilkan SEMUA organisasi tempat user menjadi member (OWNER, ADMIN, atau MEMBER)
- [ ] AC-2: Organisasi yang sedang aktif ditandai dengan checkmark atau highlight
- [ ] AC-3: Klik organisasi lain → switch terjadi dalam < 1 detik → halaman reload dengan data organisasi baru
- [ ] AC-4: Role user (OWNER/ADMIN/MEMBER) ditampilkan di samping nama organisasi
- [ ] AC-5: Switcher accessible via keyboard (Tab, Enter, Arrow keys)
- [ ] AC-6: Jika user hanya member di 1 organisasi, switcher tetap tampil (menunjukkan nama organisasi) tapi non-interactive
- [ ] AC-7: Setelah switch, sidebar, settings, dan semua halaman menampilkan data organisasi baru
- [ ] AC-8: Switcher tidak muncul jika `session.user.activeOrganizationId` null/undefined

**Edge Cases:**

- **User di-remove dari organisasi saat sedang aktif:** Next request ke API akan 403. Redirect ke halaman "no organization" atau auto-switch ke organisasi pertama yang tersedia.
- **Organisasi di-delete saat user sedang aktif di dalamnya:** Sama seperti di atas — auto-switch ke organisasi lain.
- **User baru register, belum punya organisasi:** `GET /api/organizations` return empty array `[]`. Switcher tidak boleh muncul — redirect user ke create-organization flow. Jangan render dashboard tanpa organisasi.
- **Switch saat ada form yang belum di-save:** Tampilkan warning "You have unsaved changes" sebelum switch.
- **Network error saat switch:** Tampilkan toast error, tetap di organisasi saat ini.
- **Session expired di tengah switch:** Panggilan `update()` akan gagal (401). Tangkap error, redirect ke `/login` dengan `callbackUrl` kembali ke halaman yang sedang dituju. Jangan biarkan UI stuck di loading state.

---

## 7. Non-Functional Requirements

| Kategori | Requirement |
|----------|-----------|
| **Performance** | Migration script harus bisa memproses 100K+ subscription rows dalam < 5 menit. Org switcher API response < 200ms (cached). |
| **Security** | `switch` endpoint harus memverifikasi membership user di organisasi target. Tidak boleh switch ke organisasi tanpa membership. |
| **Reliability** | Migration harus memiliki rollback path. Backfill script harus idempotent (bisa dijalankan ulang tanpa efek samping). |
| **Backward Compatibility** | Self-hosted mode: tidak ada perubahan behavior. Semua endpoint tetap berfungsi tanpa subscription check. |
| **Observability** | Log setiap switch organisasi (userId, fromOrgId, toOrgId, timestamp). Log setiap `checkOrgLimit()` yang return `allowed: false`. |

---

## 8. High-Level Architecture

### Data Model — After Migration

```
Organization (1) ──── (1) Subscription
     │                        │
     │ plan, status,          │ emailsSent, invoicesCreated,
     │ trialEndsAt            │ paymentLinksUsed
     │
     └── (many) OrganizationMember
     └── (many) Client, Project, Invoice, etc. (already exists)
```

### Key Integration Points

```
┌─────────────────────────────────────────────────┐
│              API Layer                           │
│                                                 │
│  checkOrgLimit(orgId) ──► Subscription          │
│  incrementOrgUsage(orgId) ──► Subscription      │
│  switch org ──► Session update ──► JWT          │
│                                                 │
├─────────────────────────────────────────────────┤
│              Middleware / Layout                 │
│                                                 │
│  layout.tsx ──► orgId filter untuk semua query  │
│  settings/route.ts ──► orgId filter             │
│                                                 │
├─────────────────────────────────────────────────┤
│              Frontend                            │
│                                                 │
│  OrganizationSwitcher ──► GET /api/organizations │
│                      ──► POST /api/orgs/{id}/switch │
│                      ──► update() session        │
└─────────────────────────────────────────────────┘
```

---

## 9. Out of Scope (MVP)

1. **Subscription transfer antar member** — Saat OWNER leave, tidak ada mekanisme otomatis menunjuk billing contact baru. Fallback: tampilkan warning di org settings.
2. **Konsolidasi invite mechanism** — Dua mekanisme (direct add vs email invite) tetap berjalan paralel. Konsolidasi dilakukan di phase berikutnya.
3. **Complete soft-delete lifecycle** — Organisasi yang dihapus (deletedAt) tidak otomatis di-purge. Tidak ada filter `deletedAt` di query normal. Cron job purge ditunda.
4. **RBAC middleware helper** — Setiap endpoint tetap melakukan manual check. Helper `requireOrgRole()` tidak dibuat di phase ini.
5. **Org-level audit trail** — Tidak ada pencatatan khusus untuk event organisasi (create, delete, switch).
6. **Org discovery / join request** — User tidak bisa request join organisasi; harus di-invite oleh OWNER/ADMIN.

---

## 10. Success Criteria

- [ ] Semua test case di `Verification Checklist` (FR-1, FR-2, FR-3) terpenuhi
- [ ] Tidak ada regression: semua test existing tetap passing
- [ ] User existing tidak kehilangan akses subscription setelah migration
- [ ] Self-hosted mode tidak terpengaruh (semua test self-hosted tetap passing)
- [ ] Dashboard layout mengembalikan data yang benar sebelum dan sesudah switch organisasi
- [ ] Org switcher bisa diakses dari semua halaman dashboard

### Verification Checklist

**FR-1 (Subscription Org-Scoped):**
- [ ] Create organisasi baru → subscription otomatis dibuat dengan trial 14 hari (PRO plan)
- [ ] `checkOrgLimit(orgId, "clients")` return limit berdasarkan subscription organisasi itu
- [ ] `checkOrgLimit(orgId, "teamMembers")` menghitung `organizationMember.count({ organizationId })`
- [ ] OWNER upgrade plan → limit organisasi berubah untuk semua member
- [ ] User dengan 2+ organisasi: tiap organisasi punya subscription terpisah
- [ ] Self-hosted: `checkOrgLimit()` tetap return `{ allowed: true }`

**FR-2 (Data Isolation):**
- [ ] Login sebagai user Org A → sidebar hanya tampilkan client Org A
- [ ] Settings page hanya tampilkan dan simpan settings untuk Org A
- [ ] Switch ke Org B → sidebar tampilkan client Org B, settings tampilkan settings Org B
- [ ] Tidak ada `where: {}` di query Prisma manapun di dashboard

**FR-3 (Org Switcher):**
- [ ] Switcher menampilkan semua organisasi user
- [ ] Organisasi aktif ditandai
- [ ] Switch organisasi dalam 1 klik
- [ ] Setelah switch, semua data UI berubah ke organisasi baru
- [ ] Keyboard accessible
- [ ] Handle error: organisasi dihapus, network error, session expired

---

## Glossary

| Term | Definition |
|------|-----------|
| **Multi-tenancy** | Satu instance aplikasi melayani banyak organisasi dengan data terisolasi |
| **Org-scoped** | Data dimiliki dan hanya bisa diakses oleh satu organisasi |
| **User-scoped** | Data dimiliki oleh user individu (model lama yang akan diubah) |
| **North Star** | Tujuan utama: user Org A tidak bisa melihat data Org B |
| **Self-hosted mode** | User hosting sendiri — semua limit bypass, tidak ada subscription check |
