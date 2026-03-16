# ✅ ProjectBill — Development Todo

> Daftar tugas pengembangan berdasarkan [Future Development Roadmap](file:///home/mrndev/Projects/Web/ProjectBill/future_development_roadmap.md).

---

## 🏆 Tier 1 — High Impact, High Feasibility

### 1. 🌐 Client Portal (Multitenant Dashboard) — Sprint 17-18

- [ ] Desain model `ClientAuth` (magic link ke email), terpisah dari model `User`
- [ ] Buat schema Prisma untuk `ClientAuth`
- [ ] Migrasi database
- [ ] Setup route group `(client-portal)/` di App Router
- [ ] Buat middleware auth khusus client portal (terpisah dari admin auth)
- [ ] Buat halaman login client portal
- [ ] Implementasi magic link / password auth flow
- [ ] Buat dashboard klien — daftar invoice
- [ ] Buat dashboard klien — status proyek
- [ ] Buat dashboard klien — download SOW
- [ ] Proteksi route client portal dengan middleware
- [ ] Testing end-to-end client portal

### 2. 💳 Partial Payments & Milestone Billing — Sprint 17-18

- [ ] Desain model `PaymentMilestone` (linked to `Project`)
- [ ] Buat schema Prisma: `name`, `percentage`, `amount`, `status`, `dueDate`, `invoiceId`
- [ ] Migrasi database
- [ ] Buat UI timeline / progress bar di project detail
- [ ] Implementasi logika auto-generate invoice saat milestone di-approve
- [ ] Buat form untuk mendefinisikan milestone (misal: 30% Design → 40% Dev → 30% Launch)
- [ ] Integrasi milestone status dengan payment flow
- [ ] Testing partial payment flow

### 3. ⏱️ Time Tracking & Hourly Billing — Sprint 18-19

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

### 4. 📎 File Attachments & Deliverables (S3/R2) — Sprint 19

- [ ] Pilih storage provider (Cloudflare R2 / MinIO / AWS S3)
- [ ] Setup integrasi S3-compatible storage
- [ ] Desain model `Attachment` (`projectId`, `fileName`, `fileUrl`, `fileSize`, `isLocked`)
- [ ] Buat schema Prisma untuk `Attachment`
- [ ] Migrasi database
- [ ] Implementasi pre-signed URL generation untuk secure download
- [ ] Buat UI upload file di section "Deliverables" project board
- [ ] Implementasi lock/unlock logic berdasarkan invoice status
- [ ] Testing upload, download, dan akses kontrol

### 5. 📊 Advanced Reporting & Export — Sprint 19-20

- [ ] Buat halaman `/reports` dengan filter (tanggal, klien, status)
- [ ] Implementasi chart: Revenue trend (line chart)
- [ ] Implementasi chart: Client breakdown (pie chart)
- [ ] Implementasi chart: Aging invoice report (bar chart)
- [ ] Buat summary cards: Revenue MTD, YTD, Average Invoice Value
- [ ] Implementasi export CSV menggunakan library (`xlsx` / `exceljs`)
- [ ] Implementasi export XLSX
- [ ] Testing laporan dan export

### 6. 💬 WhatsApp Integration (Notifikasi) — Sprint 20

- [ ] Pilih WA provider (WhatsApp Business API / Fonnte / Wablas)
- [ ] Setup integrasi API WA provider
- [ ] Buat template message: invoice baru
- [ ] Buat template message: reminder pembayaran
- [ ] Buat template message: payment success
- [ ] Buat toggle di Settings: Email only / WhatsApp only / Both
- [ ] Implementasi rate limiting khusus untuk WA messages
- [ ] Testing pengiriman notifikasi WA

### 7. 👥 RBAC Expansion (Staff Roles & Permissions) — Sprint 20-21

- [ ] Extend `User.role` enum: `owner`, `admin`, `staff`, `viewer`
- [ ] Update schema Prisma
- [ ] Migrasi database
- [ ] Desain permission matrix per resource (clients, projects, invoices, settings)
- [ ] Implementasi permission checks di middleware per route
- [ ] Buat UI permission management di `/settings/team`
- [ ] Testing akses per role

---

## 🥉 Tier 3 — Medium Impact, Worth Building

### 8. 🌍 Multi-Currency & Stripe Integration — Sprint 21

- [ ] Re-enable USD select di project form
- [ ] Integrasi Stripe Checkout (payment intent + webhook)
- [ ] Implementasi conditional payment gateway: Mayar (IDR) vs Stripe (USD/other)
- [ ] Tambahkan exchange rate display (optional, manual)
- [ ] Testing payment flow IDR & USD

### 9. 📧 Email Template Builder (Visual Editor) — Sprint 22

- [ ] Desain UI editor template email (drag-and-drop / field-based) di `/settings/email-templates`
- [ ] Store template config di Settings (JSON field)
- [ ] Implementasi apply config saat render React Email components
- [ ] Buat preview mode sebelum save
- [ ] Testing customized email output

### 10. 📱 Progressive Web App (PWA) — Sprint 22

- [ ] Setup PWA (`next-pwa` / manual Service Worker)
- [ ] Buat `manifest.json` dengan icon dan splash screen
- [ ] Implementasi Push Notification via Web Push API
- [ ] Buat offline fallback page
- [ ] Testing installability dan offline mode

### 11. 📋 Activity Log / Timeline — Sprint 23

- [ ] Desain model `ActivityLog` (atau extend `AuditLog`)
- [ ] Buat schema Prisma
- [ ] Migrasi database
- [ ] Buat komponen `<Timeline />` di project detail page
- [ ] Implementasi auto-capture events dari Server Actions
- [ ] Testing timeline per proyek

### 12. 🔄 Expense Tracking & Profit Calculator — Sprint 23-24

- [ ] Desain model `Expense` (`projectId`, `description`, `amount`, `category`, `date`, `receipt`)
- [ ] Buat schema Prisma
- [ ] Migrasi database
- [ ] Buat UI form input expense + daftar expense di project detail
- [ ] Buat dashboard cards: Gross Revenue vs Net Profit
- [ ] Implementasi chart: Profit margin per project
- [ ] Testing expense tracking & profit calculation

---

## 💡 Tier 4 — Nice to Have / Long-term Vision

### 13. 🤖 AI-Powered Features — Sprint 24

- [ ] Smart Pricing Suggestion: suggest harga per scope item berdasarkan histori invoice
- [ ] Invoice Copy Generator: AI-generated email copy berdasarkan konteks invoice
- [ ] Project Scope Estimator: AI-powered man-hours estimation

### 14. 📊 Client Satisfaction Survey

- [ ] Auto-kirim survey (NPS-style) setelah proyek selesai
- [ ] Track satisfaction score di dashboard

### 15. 🔗 Third-Party Integrations

- [ ] Export ke format akuntansi (Jurnal.id / Xero / QuickBooks)
- [ ] Sync 2-arah dengan Trello / Notion
- [ ] Google Calendar sync untuk deadline proyek

### 16. 🌐 Multi-Language Dashboard

- [ ] Full i18n untuk dashboard admin (ID / EN)
- [ ] Toggle bahasa di sidebar

### 17. 📈 Client Insights Dashboard

- [ ] Revenue per client (lifetime value)
- [ ] Payment behavior analysis (average days to pay)
- [ ] Client retention metrics
