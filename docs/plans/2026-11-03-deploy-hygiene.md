# Deploy hygiene: secrets out of the image, clean build log

> **Goal:** Hilangkan tiga kelas temuan dari log deploy: (1) `.env` ikut ke image, (2) `[ioredis] Unhandled error event ENOTFOUND` saat `next build`, (3) `npm warn EBADENGINE` karena base image terlalu tua.
> **Architecture:** Semua perubahan ada di lapisan build/runtime app, tanpa menyentuh logika bisnis. Build tidak lagi punya side-effect jaringan; secret hanya masuk lewat environment variable Dokploy saat runtime.
> **Tech Stack:** Next.js 16 (standalone), Prisma 7, ioredis, Docker multi-stage, Dokploy.

## Task 1 — `.dockerignore` (secret `.env` tidak lagi masuk image)

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1:** Buat `.dockerignore` yang mengecualikan `.env`/`.env.*`, `.git`, `node_modules`, `.next`, log, dan berkas non-build (docs/README).
  Expected: `docker build` tidak lagi menyalin `.env` ke build context; `next build` tidak lagi mencetak `- Environments: .env`; `/app/.env` tidak ada di image final.

- [ ] **Step 2:** Pastikan build tetap jalan tanpa `.env` (semua env build-time yang dibutuhkan sudah tidak ada; `NEXT_PUBLIC_*` tidak dipakai).
  Expected: `npm ci` + `prisma generate` + `next build` sukses.

## Task 2 — base image `node:22.13-alpine` (hilangkan EBADENGINE)

**Files:**
- Modify: `Dockerfile` (baris `FROM node:22.12-alpine AS base`)

- [ ] **Step 1:** Naikkan ke `node:22.13-alpine` (tag sudah diverifikasi ada di registry).
  Expected: `npm warn EBADENGINE eslint-visitor-keys@5.0.1` hilang (butuh `^22.13.0`).

## Task 3 — Redis lazy + error handler + build-phase guard

**Files:**
- Modify: `src/lib/event-emitter.ts`
- Modify: `src/app/api/events/route.ts` (pemakaian `redisSub` → `getRedisSub()`)

- [ ] **Step 1:** Ganti inisialisasi module-scope `new Redis(...)` menjadi fungsi lazy `getRedisPub()` / `getRedisSub()`.
  Syarat: `lazyConnect: true`, `maxRetriesPerRequest: 2`, `retryStrategy` dibatasi, dan `client.on('error', …)` selalu terpasang (tanpa listener, EventEmitter melempar "Unhandled error event").
- [ ] **Step 2:** Tambah guard `process.env.NEXT_PHASE === "phase-production-build"` → kembalikan `undefined` saat build.
  Expected: tidak ada percobaan koneksi dari container builder.
- [ ] **Step 3:** `dispatchEvent` memakai `getRedisPub()`; route SSE memakai `getRedisSub()` dengan perilaku sama seperti sebelumnya (subscribe `system_events`, cleanup on abort).
  Expected: logika tenant filtering dan fallback `localEmitter` tidak berubah.

## Verifikasi (wajib, bukan opsional)

- [ ] `docker build` → log bersih: tanpa EBADENGINE, tanpa `ENOTFOUND`, tanpa `Environments: .env`.
- [ ] `docker run --rm --entrypoint sh <image> -c 'ls -la /app/.env'` → no such file.
- [ ] Container uji di `dokploy-network` dengan env staging → `No pending migrations` + `Ready in <x>ms`.
- [ ] Uji Redis mati (`REDIS_URL` ke host tak terjangkau) → proses tetap hidup, log menampilkan pesan error yang ter-handle, bukan unhandled event.
