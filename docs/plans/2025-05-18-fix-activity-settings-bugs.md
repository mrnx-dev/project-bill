# Fix Bug: Activity Log & Settings Dropdown Default Value ✅

> **Status:** COMPLETED — Monday, May 18, 2026

**Goal:** Fix two bugs: (1) client update activity log hanya mencatat nama padahal user mengedit email, (2) dropdown field dengan `defaultValue` di settings email provider tidak tersubmit kecuali user memilih ulang.

**Architecture:** 
- Bug 1 ada di backend API `PATCH /api/clients/[id]` — audit log hanya mencatat `name` tanpa `field` label dan tanpa mencatat perubahan `email`/`phone`.
- Bug 2 ada di frontend `email-provider-card.tsx` — `Select` component menggunakan `field.defaultValue` sebagai fallback visual, tapi form state (`react-hook-form`) tidak terisi, sehingga field dengan `defaultValue` tidak ikut tersubmit.

**Tech Stack:** Next.js, TypeScript, react-hook-form, Zod, Prisma

**Total Commits:** 3 (2 untuk Bug 1, 1 untuk Bug 2)

---

## Root Cause Analysis

### Bug 1: Activity tidak mencatat perubahan email

**File:** `src/app/api/clients/[id]/route.ts` (baris 33-41)

Saat PATCH client, `createAuditLog` hanya mencatat `name`:
```typescript
oldValue: existing?.name || undefined,   // hanya name
newValue: name || undefined,              // hanya name
// field: TIDAK DIISI                     // tidak ada konteks field apa yang berubah
```

Akibatnya: user mengedit `email`, tapi yang muncul di activity log adalah perubahan `name`. Tidak ada indikasi field apa yang berubah (`field` kosong), dan perubahan `email`/`phone` hilang sama sekali.

### Bug 2: Dropdown default value tidak tersubmit

**File:** `src/components/forms/email-provider-card.tsx` (baris 103-108)

```tsx
<Select
  value={formField.value ?? field.defaultValue ?? ""}  // fallback visual saja
  onValueChange={formField.onChange}
>
```

`formField.value ?? field.defaultValue` hanya bekerja sebagai fallback visual — dropdown **menampilkan** "STARTTLS" tapi `formField.value` sebenarnya `undefined`. Saat form disubmit, field tersebut tidak dikirim karena `react-hook-form` tidak punya nilai untuk field itu. Backend (`settings/route.ts` PUT handler) juga skip field dengan `rawValue === undefined`.

---

## Task 1: Fix client update audit log — catat semua field yang berubah ✅

**Objective:** Audit log client.update mencatat field apa yang berubah (name, email, phone) dengan `field` label yang sesuai.

**Files:**
- Modify: `src/app/api/clients/[id]/route.ts`

**Status:** DONE
**Commits:** `c0c1e2a`, `be42d15`

**Step 1: Tambahkan audit log per field yang berubah**

Ganti blok `createAuditLog` tunggal (baris 33-41) dengan logika yang mencatat setiap field yang berubah secara terpisah.

```typescript
// Replace lines 33-41 with:
const changedFields: { field: string; oldValue: string; newValue: string }[] = [];

if (name !== undefined && name !== existing.name) {
  changedFields.push({ field: "name", oldValue: existing.name, newValue: name });
}
if (email !== undefined && email !== (existing.email ?? "")) {
  changedFields.push({ field: "email", oldValue: existing.email ?? "", newValue: email ?? "" });
}
if (phone !== undefined && phone !== (existing.phone ?? "")) {
  changedFields.push({ field: "phone", oldValue: existing.phone ?? "", newValue: phone ?? "" });
}

for (const entry of changedFields) {
  await createAuditLog({
    userId: session.user.id,
    action: "client.update",
    title: `Updated ${entry.field} for ${existing.name}`,
    entityType: "CLIENT",
    entityId: id,
    field: entry.field,
    oldValue: entry.oldValue || undefined,
    newValue: entry.newValue || undefined,
    organizationId: orgId,
  });
}
```

**Step 2: Format check**

Pastikan tidak ada TypeScript error:
```bash
cd /root/projects/project-bill && npx tsc --noEmit src/app/api/clients/\[id\]/route.ts 2>&1 | head -20
```
Expected: no errors (atau hanya pre-existing errors yang unrelated).

**Step 3: Commit**

```bash
git add src/app/api/clients/\[id\]/route.ts
git commit -m "fix: audit log for client.update now records each changed field (name/email/phone) with field label"
```

---

## Task 2: Fix settings dropdown — auto-populate default values ke form state ✅

**Objective:** Semua field provider config yang punya `defaultValue` di manifest otomatis masuk ke form state (`react-hook-form`), sehingga user tidak perlu memilih ulang dropdown untuk bisa save.

**Files:**
- Modify: `src/components/forms/email-provider-card.tsx`

**Status:** DONE
**Commit:** `6e83ce1`

**Step 1: Tambahkan useEffect untuk populate default values**

Tambahkan import `useEffect` (sudah ada `useState`), lalu tambahkan effect setelah baris 36 (setelah `selectedManifest` didefinisikan):

```typescript
// After line 36: const selectedManifest = clientProviderRegistry.getById(emailProvider);

// Auto-populate default values for provider fields that aren't yet in form state
useEffect(() => {
  if (!selectedManifest) return;
  const currentConfig = form.getValues(`providerConfig.${selectedManifest.id}`) || {};
  let hasChanges = false;
  const updatedConfig = { ...currentConfig };

  for (const field of selectedManifest.fields) {
    if (field.defaultValue !== undefined && currentConfig[field.id] === undefined) {
      updatedConfig[field.id] = field.defaultValue;
      hasChanges = true;
    }
  }

  if (hasChanges) {
    form.setValue(`providerConfig.${selectedManifest.id}`, updatedConfig);
  }
}, [selectedManifest, form]);
```

**Step 2: Verifikasi — periksa apakah import useEffect sudah ada**

File sudah meng-import `useState` dari React. Pastikan `useEffect` juga di-import:

```typescript
import { useState, useEffect } from "react";  // line 3, add useEffect
```

**Step 3: Format & type check**

```bash
cd /root/projects/project-bill && npx tsc --noEmit src/components/forms/email-provider-card.tsx 2>&1 | head -20
```
Expected: no new errors.

**Step 4: Commit**

```bash
git add src/components/forms/email-provider-card.tsx
git commit -m "fix: auto-populate provider config default values into react-hook-form state so dropdowns save without re-selection"
```

---

## Verification Checklist

### Bug 1 (Client Activity Log):
- [x] Edit client name → activity log shows `field: "name"` with old/new name
- [x] Edit client email (only) → activity log shows `field: "email"` with old/new email, name NOT shown
- [x] Edit client phone (only) → activity log shows `field: "phone"` with old/new phone
- [x] Edit multiple fields at once → activity log shows separate entries per changed field

### Bug 2 (Settings Dropdown):
- [x] Open Settings → pilih SMTP → Connection Security dropdown shows "STARTTLS" → langsung klik Save → success (no error)
- [x] Reject Unauthorized dropdown shows "Yes (secure)" → langsung Save → success
- [x] Ganti dropdown value secara manual → Save → value baru tersimpan
- [x] Pindah provider (SMTP → Resend → SMTP) → default values tetap ter-populate saat kembali ke SMTP

---

## Edge Cases

1. **Client update tanpa perubahan:** Jika user submit PATCH tanpa mengubah apapun (name/email/phone sama dengan existing), tidak ada audit log yang dibuat — ini expected behavior.
2. **Empty string vs null:** `email` dan `phone` bisa null di database, ditangani dengan `existing.email ?? ""`.
3. **Multiple rapid provider switches:** `useEffect` re-run setiap `selectedManifest` berubah, tidak masalah karena hanya populate field yang undefined.
4. **Config tanpa default value:** Resend dan Brevo tidak punya `defaultValue` di field-nya, `useEffect` no-op untuk provider tersebut.

---

## Post-Implementation Notes

### Code Quality Review — Approved ✅

Kedua task lulus spec compliance dan code quality review. Semua issue minor, tidak ada blocking.

### Pre-existing Issue Discovered (Not Fixed — Scope Creep)

Selama code quality review Task 1, ditemukan **cross-organization access vulnerability** di `src/app/api/clients/[id]/route.ts`:

- `prisma.client.findFirst({ where: { id } })` dan `prisma.client.update({ where: { id } })` **tidak** menyertakan filter `organizationId`
- User di Org A yang tahu UUID client dari Org B bisa membaca dan mengubah data client tersebut
- Vulnerability ini juga ada di handler `DELETE` pada file yang sama
- **Rekomendasi:** Fix terpisah — tambahkan `organizationId: orgId` di semua query Prisma pada endpoint tersebut

### Review Metrics

| Stage | Task 1 | Task 2 |
|-------|--------|--------|
| Implementasi | ✅ 103s | ✅ ~30s (manual) |
| Spec Review | ✅ PASS | ✅ PASS |
| Quality Review | ✅ APPROVED (dgn temuan) | ✅ APPROVED |
| Commits | `c0c1e2a`, `be42d15` | `6e83ce1` |
