# Analisis Mendalam: Fitur Organisasi ProjectBill

> **Status:** ANALISIS — Monday, May 18, 2026
> **Kesimpulan:** ❌ Belum matang untuk production multi-tenant use

---

## Ringkasan Eksekutif

Fitur organisasi di ProjectBill secara **konseptual sudah benar** — schema database mendukung multi-tenancy penuh dengan `organizationId` di semua entity. Namun **implementasinya masih setengah jalan** dan mengandung sejumlah celah serius yang membuatnya **tidak aman untuk digunakan dalam skenario multi-tenant sejati**. Sistem saat ini hanya berfungsi baik dalam mode single-org-per-user.

---

## Temuan Kritis

### 1. 🔴 Subscription Model: USER-scoped, bukan ORG-scoped

**Ini adalah akar dari hampir semua masalah.**

```prisma
model Subscription {
  id       String @id
  userId   String @unique   // ← 1:1 dengan User, bukan Organization!
  plan     String
  ...
}
```

`Subscription` terikat ke `User` (1:1), bukan ke `Organization`. Konsekuensinya:

| Masalah | Dampak |
|---------|--------|
| Owner org upgrade → semua member dapat limit | Billing tidak adil untuk multi-member org |
| User punya 3 org → 1 subscription? | Tidak jelas org mana yang active untuk billing |
| User leave org → subscription ikut? | Tidak ada mekanisme transfer kepemilikan |
| `checkOrgLimit()` harus "jalan kaki" ke OWNER | Tidak efisien, gagal kalau OWNER tidak ada |

**Cara kerja sekarang:**
```
checkOrgLimit(orgId, "clients")
  → cari OWNER org itu
  → ambil subscription OWNER
  → baca plan subscription
  → hitung limit
```

Kalau OWNER tidak ditemukan → return `{ allowed: false }`. Kalau OWNER ganti plan, semua member kena dampak tanpa transparansi.

---

### 2. 🔴 Dashboard Layout: Data Leak Cross-Organization

**File:** `src/app/(dashboard)/layout.tsx:44-52`

```typescript
const settings = await prisma.settings.findFirst({
    where: {},   // ❌ Tidak ada organizationId filter!
});

const clients = await prisma.client.findMany({
    where: {},   // ❌ Mengambil SEMUA client dari SEMUA organisasi!
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
});
```

**Dampak:** Sidebar menampilkan client dari **semua organisasi** — user Org A bisa melihat nama client Org B. Ini adalah **data leak nyata** bukan sekadar potensi.

---

### 3. 🔴 Settings GET: Tidak ada organizationId filter

**File:** `src/app/api/settings/route.ts:19-21`

```typescript
let settings = await prisma.settings.findFirst({
    where: {},   // ❌ Tanpa organizationId
});
```

Kalau ada 2+ organisasi yang sudah punya Settings row, API ini akan mengembalikan settings milik organisasi yang **pertama ditemukan** (tidak deterministik).

---

### 4. 🟠 Tidak Ada Organization Switcher di Frontend

**API endpoint:** `POST /api/organizations/[id]/switch` — **sudah ada** dan berfungsi baik.

**Masalah:** Tidak ada UI component untuk memanggil endpoint ini.

Pencarian:
- `*switch*`, `*switcher*` di `/src/components` → **0 hasil**
- `switch` di seluruh `/src` → hanya muncul di API route, tidak di component manapun

**Artinya:** User tidak bisa berpindah organisasi. Mereka "terjebak" di organisasi yang di-set saat login (`defaultOrganizationId`).

---

### 5. 🟠 Dua Mekanisme Invite yang Membingungkan

Ada **DUA cara** menambahkan member, dengan behavior berbeda:

| | Direct Add | Email Invite |
|---|---|---|
| Endpoint | `POST /api/orgs/[id]/members` | `POST /api/orgs/[id]/invites` |
| Syarat | User harus sudah terdaftar | Email boleh belum terdaftar |
| Email notifikasi | ❌ Tidak | ✅ Kirim email |
| Token-based | Tidak | Ya (7 hari expiry) |
| Dipakai UI | ✅ TeamClient | ❌ Tidak |

**Masalah:** Ada dua code path untuk operasi yang sama, dengan side-effect berbeda. Maintenance burden dan potensi inkonsistensi.

---

### 6. 🟠 Organization Delete: Soft-Delete Tidak Lengkap

**File:** `src/app/api/organizations/[id]/delete/route.ts`

Delete organisasi hanya set `deletedAt = new Date()`. Tapi:

| Kekurangan | Dampak |
|-----------|--------|
| Tidak ada grace period hard-delete | Data orphan tidak pernah dibersihkan |
| Query entity TIDAK filter `deletedAt: null` | Data organisasi yang "dihapus" masih muncul di query normal |
| Tidak ada notification ke member | Member tidak tahu kalau org sudah dihapus |
| Member masih bisa switch ke org yang deleted | `switch` endpoint tidak cek `deletedAt` |

---

### 7. 🟡 Team Member Count Inkonsisten

Di 3 tempat berbeda, perhitungan team member berbeda:

| Lokasi | Query | Scope |
|--------|-------|-------|
| `checkOrgLimit()` | `organizationMember.count({ organizationId })` | ✅ Per-org |
| `checkLimit()` | `user.count()` | ❌ Semua user |
| `subscription GET` | `user.count()` | ❌ Semua user |

`checkLimit()` dan `subscription/GET` menggunakan `user.count()` — menghitung **semua user di database**, bukan member organisasi. Ini membuat limit team member tidak akurat di user-centric path.

---

### 8. 🟡 Tidak Ada Middleware RBAC per-Organization

Saat ini setiap endpoint harus manual:
1. Panggil `auth()`
2. Ambil `orgId` dari `session.user.activeOrganizationId!`
3. Verifikasi membership (kadang dilakukan, kadang tidak)

**Tidak ada pola konsisten.** Beberapa endpoint lakukan ini, banyak yang tidak. Tidak ada helper reusable seperti `requireOrgMembership(role)`.

---

## Analisis Arsitektur: Single-Org vs Multi-Org Mindset

### Yang SUDAH benar:

| Komponen | Status |
|----------|--------|
| Schema Prisma — `organizationId` di semua entity | ✅ |
| Index database untuk `organizationId` | ✅ |
| `OrganizationMember` composite key | ✅ |
| `OrganizationInvite` dengan token + expiry | ✅ |
| Session JWT menyimpan `activeOrganizationId` | ✅ |
| API switch organization | ✅ |
| API CRUD members, invites, org | ✅ |
| Subscription plan limits (PRO, BUSINESS) | ✅ |
| Self-hosted mode bypass billing | ✅ |

### Yang MASIH salah / belum selesai:

| Komponen | Severity |
|----------|----------|
| Subscription model 1:1 User (bukan 1:Org) | 🔴 Arsitektural |
| Dashboard layout query tanpa orgId | 🔴 Data leak |
| Settings GET tanpa orgId | 🔴 Data leak |
| Tidak ada org switcher UI | 🟠 UX blocker |
| Dua mekanisme invite redundan | 🟠 Maintenance |
| Soft-delete tidak lengkap | 🟠 Data integrity |
| Team count tidak konsisten | 🟡 Accuracy |
| Tidak ada RBAC helper | 🟡 DX |

---

## Rekomendasi

### Prioritas 1 — HARUS diperbaiki sebelum multi-tenant production:

1. **Subscription harus org-scoped** — `Subscription` butuh `organizationId`, bukan/user selain `userId`. Ini perubahan schema besar yang perlu migration plan.

2. **Dashboard layout & settings query harus org-scoped** — Tambahkan `organizationId: session.user.activeOrganizationId` ke query di `layout.tsx` dan `settings/route.ts`.

3. **Organization switcher UI** — Implementasi dropdown/selector di sidebar untuk pindah organisasi.

### Prioritas 2 — Sebaiknya diperbaiki:

4. **Konsolidasi invite** — Pilih satu mekanisme (email invite) dan hapus yang satunya, atau merge jadi satu endpoint.

5. **Complete soft-delete lifecycle** — Tambahkan `deletedAt` filter di query + cron job purge.

6. **RBAC middleware/helper** — Buat helper `requireOrgRole(orgId, roles[])` yang reusable.

### Prioritas 3 — Nice to have:

7. **Subscription transfer** — Saat owner leave, bisa transfer subscription ke admin lain.
8. **Org-level audit trail** — Catat siapa yang create/delete organisasi.
