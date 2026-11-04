# ✅ ProjectBill — Development Todo

> Daftar tugas pengembangan berdasarkan [Future Development Roadmap](file:///home/mrndev/Projects/Web/ProjectBill/future_development_roadmap.md).

---

## 🎯 Current Sprint — Priority Order

1. ✅ 🤖 AI — Playwright E2E test + Dokploy deployment config — **DONE**
2. ✅ 🔐 Casdoor — Phase 5 (middleware) + Phase 6 (testing) — **DONE**
3. ✅ 💳 Partial Payments & Milestone Billing — **DONE**
4. ✅ 🌐 Client Portal — Multi-Tenant Org Isolation (Foundation) — **DONE**
5. 🔗 Stripe Integration — **NEXT**

---

## ✅ Completed

### 🔐 Subscription & Licensing System (Tiered Gating)

- [x] Desain strategi subscription 3-tier (Starter / Pro / Business)
- [x] Tambah `DEPLOYMENT_MODE` env var (`self-hosted` vs `managed`)
- [x] Buat model `Subscription` di Prisma schema
- [x] Buat `src/lib/subscription.ts` — plan limits, gate checks, usage tracking
- [x] Auto-create `Subscription` record untuk user baru
- [x] Gate check di `POST /api/clients` (count limit)
- [x] Gate check di `POST /api/projects` (count limit)
- [x] Gate check di `POST /api/invoices` & `/api/invoices/generate` (monthly counter)
- [x] Gate check di email sender `email.ts` (monthly counter)
- [x] Gate check di `POST /api/recurring-invoices` (count limit)
- [x] Gate check di `POST /api/sow-templates` (count limit)
- [x] Buat endpoint cron `/api/cron/reset-usage` + `CRON_SECRET` auth
- [x] Buat halaman `/settings/subscription` (progress bar usage)
- [x] Buat komponen `UpgradeDialog` (muncul saat limit tercapai)
- [x] Tambah watermark "Powered by ProjectBill" di invoice publik (free plan, managed cloud)
- [x] Buat API `GET /api/subscription` (fetch info langganan)
- [x] Buat API `PUT /api/subscription` (admin update plan manual)
- [x] Unit test `subscription.ts` (8 test cases, semua pass)
- [x] Fix dan update `mayar.test.ts` mock ke database settings
- [x] Semua 20 unit test project pass ✅

---

### 🔐 Fix Role System + Restrict Settings to OWNER Only (2026-05-15)

- [x] Tambah `activeOrganizationRole` ke NextAuth Session type declaration
- [x] Update JWT + session callbacks untuk propagate `activeOrganizationRole`
- [x] Fix `authorize()` di auth.ts — inject org-level role dari OrganizationMember
- [x] Update org-switch endpoint return `activeOrganizationRole`
- [x] Restrict settings API routes ke OWNER only (2 lokasi)
- [x] Restrict settings page ke OWNER only
- [x] Update invoice mark-paid ke OWNER or ADMIN (org-level role)
- [x] Update subscription route ke OWNER or ADMIN (org-level role)
- [x] Update notifications page ke OWNER or ADMIN (org-level role)
- [x] Fix client-side org-switch code update session dengan `activeOrganizationRole`

---

### 📧 Pluggable Email Provider System (2026-05-15)

- [x] Prisma migration: `EmailProviderConfig` table + `emailProvider` field
- [x] 9 provider files: types, base-provider, registry, resend/brevo/smtp (manifest+provider)
- [x] `lib/email.ts` refactor: `loadProviderConfig` + 7 functions → factory pattern
- [x] `send-link/route.ts` refactor: dynamic import → factory pattern
- [x] Settings API: GET nested `providerConfig`, PUT upsert + audit log, POST test-email
- [x] Settings UI: email-provider-card.tsx, client-registry.ts, schema, dropdown, test button
- [x] Cleanup: deprecated comment in schema, orphan SQL maintenance note
- [x] Build verified pass (1 pre-existing recharts dep warning)
- [x] 8 clean commits by concern

---

### 🔒 Organization RBAC & Security (2026-05-18)

- [x] **Phase 0 (11 task):** Schema foundation — voidedAt, notification userId, INVOICE_STATUS constants, VALID_TRANSITIONS, org-rbac (AuthError, requireOrgRole, getAuthContext), org-scoping (orgQuery), PERMISSIONS config (23 permissions), HMAC sign/verify, email utility extraction (sendInvoice, sendReceipt)
- [x] **Phase 1 (6 task):** System context fix — cron recurring-invoices → pure utility, cron reminders → orgId filter + logging, Mayar webhook → org-scope + isValidTransition, invoice status normalization migration (MIG-1), countUnpaidInvoices auth + org-scope, checkInvoiceStatus auth mandatory
- [x] **Phase 2 (27 task):** RBAC deploy — requireOrgRole di 27+ endpoint (sendInvoice, sendReceipt, invoices PATCH/DELETE, mark-paid, settings, test-email, subscription GET/PUT/checkout/check, org export/status, org update, milestones approve/unapprove/mark-paid, recurring invoices, SOW templates, audit-logs, agent config, org members)
- [x] **Phase 3 (8 task):** Critical fixes
- [x] **Phase 4 (9 task):** Org/UI enhancements
- [x] **Phase 5 (3 task):** Notifications scoping
- [x] Additional fixes: SMTP STARTTLS fallback, Zod resolver type cast, poller type fixes, onboarding modal resendApiKey cleanup, session null checks

---

### 🏢 Organisasi Maturity — Multi-Tenant Production Readiness (2026-05-18)

- [x] **Phase 1 (Task 1-12):** Subscription org-scoped — add nullable organizationId, backfill script, switch unique constraint dari userId ke organizationId, refaktor getSubscriptionByOrg, checkOrgLimit (direct orgId query + limit-deny logging), incrementOrgUsage (direct update), remove dead code (checkLimit, incrementUsage, getOrgOwnerId, old getSubscription)
- [x] **Phase 2 (Task 13-14):** Dashboard/settings data isolation — fix cross-org data leak
- [x] **Phase 3 (Task 15a-18):** OrgSwitcher enhancements — role badges, keyboard navigation, unsaved form warning
- [x] **Phase 4 (Task 19-23b):** Observability + polish
- [x] Total: 23 task, 19 commits

---

## 🤖 AI Financial Co-Pilot — Sprint 17

> An AI-powered assistant that proactively analyzes business data, answers natural language queries, and provides actionable financial insights. The first of its kind in the Indonesian invoicing market.

### Phase 1 — Infrastructure & Core (✅ Complete)
- [x] Database schema — `AgentConversation`, `AgentMessage`, `AgentMemory`, `AgentConfig` models
- [x] DTO types & interfaces (`src/lib/ai/types.ts`) — ChatMessage, BusinessContext, ProactiveInsight, etc.
- [x] Context builder (`src/lib/ai/context-builder.ts`) — Gathers real-time business data (stats, invoices, deadlines, top clients)
- [x] LLM provider abstraction (`src/lib/ai/provider.ts`) — Pluggable OpenRouter support, OpenAI/Anthropic/Local stubs
- [x] AI tool definitions (`src/lib/ai/tools.ts`) — `query_invoices`, `query_projects`, `analyze_cashflow`, `get_client_details`
- [x] System prompts (`src/lib/ai/prompts.ts`) — Bilingual (en/id) with structured business context + tool instructions
- [x] Agent orchestrator (`src/lib/ai/agent.ts`) — Chat (blocking) + streaming SSE + proactive insights engine
- [x] API route `/api/agent/chat` — SSE streaming endpoint with proper callback interface
- [x] API route `/api/agent/history` — Fetch conversation list & message history
- [x] API route `/api/agent/config` — GET/PUT agent settings (provider, model, temperature, locale, proactive mode)
- [x] Environment variable validation — `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` in `env.ts`

### Phase 2 — UI Components (✅ Complete)
- [x] `ai-chat-panel.tsx` — Main chat panel with conversation tabs, streaming SSE parsing, quick-actions
- [x] `ai-chat-input.tsx` — Textarea with Enter-to-send, disabled state during streaming
- [x] `ai-message-bubble.tsx` — Markdown rendering (bold, italic, code, lists, headers), typing indicator
- [x] `ai-insight-card.tsx` — Priority-colored cards for proactive insights (overdue, cashflow, reminders)
- [x] `ai-floating-chat.tsx` — Fixed FAB (bottom-right), slide-over panel, responsive (mobile full-width / desktop 420px)
- [x] `ai-toggle-button.tsx` — Sidebar toggle button with Bot icon
- [x] Settings page `/settings/agent` — Provider select, model input, temperature slider, locale toggle, proactive mode
- [x] Sidebar integration — "AI Assistant" menu item under Settings
- [x] Layout integration — `<AIFloatingChat />` mounted in dashboard layout
- [x] All strings translated to English

### Phase 3 — Tool Execution & Testing (✅ Complete)
- [x] Tool execution loop — AI calls tools, receives results, includes in response
- [x] Jest unit tests — `ai-tools.test.ts`, `context-builder.test.ts`
- [x] Playwright E2E test — `e2e/ai-chat.spec.ts` (open chat, send message, streaming)
- [x] Error handling — API key missing, rate limiting, LLM timeout fallback

### Phase 4 — Production & Polish (✅ Complete)
- [x] Dokploy deployment — docker-compose.yml updated with AI env vars, .env.example ready
- [x] Proactive insights on dashboard (show insight cards automatically)
- [x] Conversation persistence UI — "Continue previous conversation" on load
- [x] Markdown support in chat (react-markdown + rehype-sanitize)
- [x] Rate limiting on `/api/agent/chat` endpoint (20 req/hr per user)

---

## 🏆 Tier 1 — High Impact, High Feasibility

### 1. 🔐 Casdoor OIDC Integration (Managed Auth) — Sprint 16

> Integrasi Casdoor sebagai OIDC auth provider untuk `DEPLOYMENT_MODE=managed`, sementara tetap menggunakan Credentials auth (email/bcrypt) untuk `self-hosted`.
> Estimasi: **~13-18 jam (2-3 hari kerja)** | Kompleksitas: **Medium**

#### Phase 1 — Setup & Konfigurasi
- [x] Setup Casdoor instance (Docker / cloud hosted)
- [x] Konfigurasi Casdoor: buat Application, Organization, dan Roles
- [x] Tambah env vars baru di `env.ts`: `CASDOOR_ENDPOINT`, `CASDOOR_CLIENT_ID`, `CASDOOR_CLIENT_SECRET`
- [x] Update `.env.example` dengan variabel Casdoor baru

#### Phase 2 — Auth Provider Conditional
- [x] Modifikasi `src/auth.ts` — tambah Casdoor sebagai OIDC provider
- [x] Implementasi conditional provider: Credentials (self-hosted) vs Casdoor OIDC (managed)
- [x] Update `src/auth.config.ts` — pastikan JWT callbacks handle kedua mode (Casdoor user vs local user)
- [x] Pindahkan `isSelfHosted()` / `isManagedCloud()` ke utility terpisah (dari `subscription.ts`)

#### Phase 3 — Login Page & UX
- [x] Modifikasi `src/components/login-form.tsx` — conditional render:
  - Self-hosted: form email/password (existing)
  - Managed: tombol "Login with Casdoor" (OIDC redirect)
- [x] Update `src/app/(auth)/login/page.tsx` — handle login mode detection
- [x] Update `src/app/(auth)/login/actions.ts` — support Casdoor sign-in action
- [x] Modifikasi setup page (`/setup`) — skip atau adjust untuk managed mode

#### Phase 4 — User Provisioning & Sync
- [x] Implementasi auto-create `User` record di DB saat pertama login via Casdoor (di NextAuth callback)
- [x] Mapping role Casdoor → role ProjectBill (`admin`, `staff`, dll)
- [x] Handle user profile sync (name, email) dari Casdoor ke local DB
- [x] Pastikan `Subscription` auto-create juga berjalan untuk user Casdoor baru

#### Phase 5 — Route Protection & Middleware (✅ Complete)
- [x] Buat `src/middleware.ts` — centralized auth check (dashboard redirect, API 401, public route allow)
- [x] API routes (Server Actions) tetap aman di kedua mode via middleware
- [x] Proteksi Casdoor callback route (`/api/auth/callback/casdoor` via public path allowlist)

#### Phase 6 — Testing & Validasi (✅ Complete)
- [x] Unit test: conditional provider logic, role mapping, user provisioning (`__tests__/casdoor-auth.test.ts`)
- [x] Route protection tests (public vs protected paths)
- [x] Middleware validates auth for both self-hosted and managed modes

---

### 2. 🌐 Client Portal — Multi-Tenant Org Isolation (Foundation) — Sprint 17-18

> **✅ DONE** — Foundation layer untuk isolation data antar organisasi + Client Portal dengan magic link auth.

#### Phase 0 — Multi-Tenant Org Isolation ✅
- [x] Schema Prisma — `Organization`, `OrganizationMember`, `Invite` models
- [x] Row-Level Security — `src/lib/rls.ts` (tenant-aware data access) + `src/lib/prisma.ts` (Prisma extension auto-inject orgId)
- [x] Organization delete endpoint — `/api/organizations/[id]/delete/`
- [x] Organization export endpoint — `/api/organizations/[id]/export/`
- [x] Invite system — create, accept, reject flow — `/api/invites/`
- [x] Organization invites — `/api/organizations/[id]/invites/`
- [x] Public invite page — `src/app/(public)/invite/`
- [x] Cron purge orgs — `/api/cron/purge-orgs/`
- [x] Unit tests — `invites.test.ts`, `org-isolation.test.ts`
- [x] Integrasi org isolation ke semua resource (clients, projects, invoices)
- [x] Tenant-aware middleware untuk dashboard & API routes — `src/middleware.ts` (dual auth: NextAuth + JWT)

#### Phase 1 — Client Portal Auth & Dashboard ✅
- [x] Desain model `ClientAuth` (magic link ke email), terpisah dari model `User`
- [x] Buat schema Prisma untuk `ClientAuth`
- [x] Migrasi database — `add_client_auth_and_milestones`
- [x] Setup route group `/client/` di App Router
- [x] Buat middleware auth khusus client portal (verify JWT dari `client_session` cookie)
- [x] Buat halaman login client portal — `/client/login` (email-only, magic link)
- [x] Implementasi magic link auth flow — `send-link` → `verify` → `select-org` (multi-org support)
- [x] Buat dashboard klien — daftar invoice + tab project — `/client/dashboard`
- [x] Buat dashboard klien — status proyek + milestone progress bar
- [x] Buat halaman detail invoice — `/client/invoices/[id]`
- [x] Proteksi route client portal dengan middleware (JWT verification)
- [x] API routes: `/api/client-portal/auth/*`, `/api/client-portal/invoices`, `/api/client-portal/projects`, `/api/client-portal/settings`
- [x] Multi-org support — satu email bisa akses beberapa organisasi

### 3. 💳 Partial Payments & Milestone Billing — Sprint 17-18

> **✅ DONE** — Milestone-based payment schedule dengan auto-invoice generation.

- [x] Desain model `PaymentMilestone` (linked to `Project`, `Invoice`)
- [x] Buat schema Prisma: `name`, `percentage`, `amount`, `status`, `dueDate`, `invoiceId`, `sortOrder`
- [x] Migrasi database — `add_client_auth_and_milestones`
- [x] Buat UI timeline / progress bar di project detail (Payment Schedule tab)
- [x] Implementasi logika auto-generate invoice saat milestone di-approve (type=MILESTONE)
- [x] Buat form untuk mendefinisikan milestone (name, percentage, due date)
- [x] Integrasi milestone status dengan payment flow (PENDING → INVOICED → PAID)
- [x] FreshBooks-style reversibility: unapprove cascade (delete invoice jika masih UNPAID)
- [x] Mayar payment link auto-generate saat approve
- [x] Percentage validation: total milestones tidak boleh melebihi 100%
- [x] API: CRUD milestones, approve, unapprove, mark-paid (update linked invoice)
- [x] Audit logging untuk milestone create, update, delete, approve, mark-paid
- [x] Code review fix: status casing (lowercase), transaction safety, field whitelisting

### 4. ⏱️ Time Tracking & Hourly Billing — Sprint 18-19

- [ ] Desain model `TimeEntry` (`projectId`, `description`, `startTime`, `endTime`, `duration`, `billable`)
- [ ] Buat schema Prisma untuk `TimeEntry`
- [ ] Migrasi database
- [ ] Buat komponen UI stopwatch (start/stop/pause)
- [ ] Buat time log table per proyek
- [ ] Implementasi action "Convert to Invoice" (compile time entries → line items)
- [ ] Buat dashboard widget: total jam minggu ini
- [ ] Testing time tracking & invoice conversion

---

## 🥈 Tier 2 — High Impact, Medium Complexity

### 5. 📎 File Attachments & Deliverables (S3/R2) — Sprint 19

- [ ] Pilih storage provider (Cloudflare R2 / MinIO / AWS S3)
- [ ] Setup integrasi S3-compatible storage
- [ ] Desain model `Attachment` (`projectId`, `fileName`, `fileUrl`, `fileSize`, `isLocked`)
- [ ] Buat schema Prisma untuk `Attachment`
- [ ] Migrasi database
- [ ] Implementasi pre-signed URL generation untuk secure download
- [ ] Buat UI upload file di section "Deliverables" project board
- [ ] Implementasi lock/unlock logic berdasarkan invoice status
- [ ] Testing upload, download, dan akses kontrol

### 6. 📊 Advanced Reporting & Export — Sprint 19-20

- [ ] Buat halaman `/reports` dengan filter (tanggal, klien, status)
- [ ] Implementasi chart: Revenue trend (line chart)
- [ ] Implementasi chart: Client breakdown (pie chart)
- [ ] Implementasi chart: Aging invoice report (bar chart)
- [ ] Buat summary cards: Revenue MTD, YTD, Average Invoice Value
- [ ] Implementasi export CSV menggunakan library (`xlsx` / `exceljs`)
- [ ] Implementasi export XLSX
- [ ] Testing laporan dan export

### 7. 💬 WhatsApp Integration (Notifikasi) — Sprint 20

- [ ] Pilih WA provider (WhatsApp Business API / Fonnte / Wablas)
- [ ] Setup integrasi API WA provider
- [ ] Buat template message: invoice baru
- [ ] Buat template message: reminder pembayaran
- [ ] Buat template message: payment success
- [ ] Buat toggle di Settings: Email only / WhatsApp only / Both
- [ ] Implementasi rate limiting khusus untuk WA messages
- [ ] Testing pengiriman notifikasi WA

### 8. 👥 RBAC Expansion (Staff Roles & Permissions) — Sprint 20-21

- [ ] Extend `User.role` enum: `owner`, `admin`, `staff`, `viewer`
- [ ] Update schema Prisma
- [ ] Migrasi database
- [ ] Desain permission matrix per resource (clients, projects, invoices, settings)
- [ ] Implementasi permission checks di middleware per route
- [ ] Buat UI permission management di `/settings/team`
- [ ] Testing akses per role

---

## 🥉 Tier 3 — Medium Impact, Worth Building

### 9. 🌍 Multi-Currency & Stripe Integration — Sprint 21

**Multi-Currency: ✅ Complete** — 8 currencies (IDR, USD, EUR, GBP, SGD, MYR, JPY, AUD), centralized `src/lib/currency.ts`, dynamic UI, per-currency dashboard aggregation.

**Stripe: ⏳ Next**
- [ ] Integrasi Stripe Checkout (payment intent + webhook)
- [ ] Implementasi conditional payment gateway: Mayar (IDR) vs Stripe (USD/other)
- [ ] Tambahkan exchange rate display (optional, manual)
- [ ] Testing payment flow IDR & USD

### 10. 📧 Email Template Builder (Visual Editor) — Sprint 22

- [ ] Desain UI editor template email (drag-and-drop / field-based) di `/settings/email-templates`
- [ ] Store template config di Settings (JSON field)
- [ ] Implementasi apply config saat render React Email components
- [ ] Buat preview mode sebelum save
- [ ] Testing customized email output

### 11. 📱 Progressive Web App (PWA) — Sprint 22

- [ ] Setup PWA (`next-pwa` / manual Service Worker)
- [ ] Buat `manifest.json` dengan icon dan splash screen
- [ ] Implementasi Push Notification via Web Push API
- [ ] Buat offline fallback page
- [ ] Testing installability dan offline mode

### 12. 📋 Activity Log / Timeline — Sprint 23

- [ ] Desain model `ActivityLog` (atau extend `AuditLog`)
- [ ] Buat schema Prisma
- [ ] Migrasi database
- [ ] Buat komponen `<Timeline />` di project detail page
- [ ] Implementasi auto-capture events dari Server Actions
- [ ] Testing timeline per proyek

### 13. 🔄 Expense Tracking & Profit Calculator — Sprint 23-24

- [ ] Desain model `Expense` (`projectId`, `description`, `amount`, `category`, `date`, `receipt`)
- [ ] Buat schema Prisma
- [ ] Migrasi database
- [ ] Buat UI form input expense + daftar expense di project detail
- [ ] Buat dashboard cards: Gross Revenue vs Net Profit
- [ ] Implementasi chart: Profit margin per project
- [ ] Testing expense tracking & profit calculation

---

## 💡 Tier 4 — Nice to Have / Long-term Vision

### 14. 🤖 AI-Powered Features — Sprint 24

- [ ] Smart Pricing Suggestion: suggest harga per scope item berdasarkan histori invoice
- [ ] Invoice Copy Generator: AI-generated email copy berdasarkan konteks invoice
- [ ] Project Scope Estimator: AI-powered man-hours estimation

### 15. 📊 Client Satisfaction Survey

- [ ] Auto-kirim survey (NPS-style) setelah proyek selesai
- [ ] Track satisfaction score di dashboard

### 16. 🔗 Third-Party Integrations

- [ ] Export ke format akuntansi (Jurnal.id / Xero / QuickBooks)
- [ ] Sync 2-arah dengan Trello / Notion
- [ ] Google Calendar sync untuk deadline proyek

### 17. 🌐 Multi-Language Dashboard

- [ ] Full i18n untuk dashboard admin (ID / EN)
- [ ] Toggle bahasa di sidebar

### 18. 📈 Client Insights Dashboard

- [ ] Revenue per client (lifetime value)
- [ ] Payment behavior analysis (average days to pay)
- [ ] Client retention metrics