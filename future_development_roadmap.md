# 🚀 ProjectBill — Future Development Roadmap

> Dokumen ini adalah analisis komprehensif fitur-fitur yang bisa dikembangkan selanjutnya dari ProjectBill, berdasarkan review mendalam terhadap [PROJECT_OVERVIEW.md](file:///home/mrndev/Projects/Web/ProjectBill/PROJECT_OVERVIEW.md), [ARCHITECTURE.md](file:///home/mrndev/Projects/Web/ProjectBill/ARCHITECTURE.md), dan database schema (Prisma).

---

## 📊 Ringkasan Kondisi Saat Ini (V1.8)

ProjectBill sudah memiliki fondasi yang **sangat kuat** sebagai self-hosted invoicing platform:

| Area | Status |
|------|--------|
| Client & Project CRUD | ✅ Complete |
| Kanban Board | ✅ Complete |
| Invoice (DP, Full, Recurring) | ✅ Complete |
| Payment Gateway (Mayar.id) | ✅ Complete |
| Email System (React Email + Resend) | ✅ Complete |
| Authentication (NextAuth v5) | ✅ Complete |
| SOW / Digital Contract | ✅ Complete |
| Dashboard & Analytics | ✅ Complete |
| PDF Export | ✅ Complete |
| Notification System | ✅ Complete |
| RBAC Foundation (admin/staff) | ✅ Foundation |
| Audit Logging | ✅ Complete |
| Security (Encryption, XSS, Rate Limit) | ✅ Complete |

---

## 🎯 Fitur yang Bisa Dikembangkan

Diurutkan berdasarkan **business value × feasibility** (RICE framework).

---

### 🏆 Tier 1 — High Impact, High Feasibility

#### 1. 🌐 Client Portal (Multitenant Dashboard)

> **Sudah ada di roadmap Sprint 17**

**Deskripsi:** Area login khusus untuk klien, di mana mereka bisa melihat semua invoice, status proyek, dan download SOW dari satu layar.

**User Stories:**
- *Sebagai klien*, saya ingin login ke portal sendiri untuk melihat semua tagihan saya tanpa harus menghubungi freelancer.
- *Sebagai admin*, saya ingin klien bisa self-service agar mengurangi beban komunikasi.

**Scope Teknis:**
- Model `ClientAuth` (magic link atau password) — terpisah dari `User` yang sudah ada
- Route group `(client-portal)/` di bawah App Router
- Dashboard klien: daftar invoice, status proyek, download SOW
- Middleware baru untuk auth klien (terpisah dari admin auth)

**Estimasi:** Sprint 17-18 (2 sprint)

---

#### 2. 💳 Partial Payments & Milestone Billing

> **Sudah ada di roadmap Sprint 17**

**Deskripsi:** Ekspansi dari DP + Balance menjadi multi-stage payment terms (misal: 30% Design → 40% Development → 30% Launch).

**User Stories:**
- *Sebagai freelancer*, saya ingin membuat jadwal pembayaran bertahap agar cash flow lebih terjaga.
- *Sebagai klien*, saya ingin membayar sesuai milestone yang sudah selesai.

**Scope Teknis:**
- Model baru `PaymentMilestone` (linked to `Project`)
- Fields: `name`, `percentage`, `amount`, `status`, `dueDate`, `invoiceId`
- UI timeline/progress bar di project detail
- Auto-generate invoice ketika milestone di-approve

**Estimasi:** Sprint 17-18 (2 sprint)

---

#### 3. ⏱️ Time Tracking & Hourly Billing

> **Sudah ada di roadmap Sprint 17**

**Deskripsi:** Stopwatch in-app yang terhubung ke proyek, otomatis mengcompile jam kerja menjadi line-item invoice di akhir bulan.

**User Stories:**
- *Sebagai freelancer*, saya ingin mencatat waktu kerja per proyek agar bisa menagih berdasarkan jam.
- *Sebagai klien*, saya ingin melihat breakdown waktu yang dihabiskan di proyek saya.

**Scope Teknis:**
- Model baru `TimeEntry` (`projectId`, `description`, `startTime`, `endTime`, `duration`, `billable`)
- UI komponen stopwatch + time log table
- Action "Convert to Invoice" yang mengumpulkan entries menjadi line items
- Dashboard widget: total jam minggu ini

**Estimasi:** Sprint 18-19 (2 sprint)

---

### 🥈 Tier 2 — High Impact, Medium Complexity

#### 4. 📎 File Attachments & Deliverables (S3/R2)

> **Sudah ada di roadmap Sprint 17**

**Deskripsi:** Section "Deliverables" di project board untuk upload file (ZIP, video, dsb.) yang baru bisa diakses klien setelah pembayaran selesai.

**User Stories:**
- *Sebagai freelancer*, saya ingin mengupload hasil kerja di satu tempat yang aman.
- *Sebagai klien*, saya ingin mengakses deliverable setelah saya bayar.

**Scope Teknis:**
- Integrasi S3-compatible storage (Cloudflare R2, MinIO, atau AWS S3)
- Model `Attachment` (`projectId`, `fileName`, `fileUrl`, `fileSize`, `isLocked`)
- Pre-signed URL generation untuk secure download
- Lock/unlock logic berdasarkan invoice status

**Estimasi:** Sprint 19 (1 sprint)

---

#### 5. 📊 Advanced Reporting & Export

**Deskripsi:** Laporan keuangan yang lebih detail: profit/loss per periode, laporan per klien, aging invoice report, dan export ke Excel/CSV.

**User Stories:**
- *Sebagai freelancer*, saya ingin melihat laporan pendapatan bulanan/tahunan untuk keperluan pajak.
- *Sebagai admin*, saya ingin mengexport data invoice ke Excel untuk rekonsiliasi.

**Scope Teknis:**
- Halaman `/reports` dengan filter tanggal, klien, status
- Chart: Revenue trend (line chart), Client breakdown (pie), Aging report (bar)
- Export CSV/XLSX menggunakan library seperti `xlsx` atau `exceljs`
- Summary cards: Revenue MTD, YTD, Average Invoice Value

**Estimasi:** Sprint 19-20 (2 sprint)

---

#### 6. 💬 WhatsApp Integration (Notifikasi)

**Deskripsi:** Kirim notifikasi invoice dan reminder pembayaran via WhatsApp selain email, mengingat dominasi WhatsApp di Indonesia.

**User Stories:**
- *Sebagai freelancer*, saya ingin klien menerima notifikasi tagihan via WhatsApp karena lebih sering dibaca.
- *Sebagai klien*, saya ingin menerima reminder pembayaran langsung di WA.

**Scope Teknis:**
- Integrasi WhatsApp Business API (atau Fonnte/Wablas sebagai provider lokal)
- Template message untuk: invoice baru, reminder, payment success
- Toggle di Settings: Email only / WhatsApp only / Both
- Rate limiting khusus untuk WA messages

**Estimasi:** Sprint 20 (1 sprint)

---

#### 7. 👥 RBAC Expansion (Staff Roles & Permissions)

**Deskripsi:** Ekspansi dari foundation admin/staff menjadi permission system yang lebih granular.

**User Stories:**
- *Sebagai pemilik agency*, saya ingin staff saya bisa mengakses project tanpa bisa mengubah settings atau melihat API keys.
- *Sebagai staff*, saya ingin mengupdate status proyek tanpa akses ke data keuangan sensitif.

**Scope Teknis:**
- Extend `User.role` menjadi enum: `owner`, `admin`, `staff`, `viewer`
- Permission matrix per resource (clients, projects, invoices, settings)
- UI permission management di `/settings/team`
- Middleware checks per route

**Estimasi:** Sprint 20-21 (2 sprint)

---

### 🥉 Tier 3 — Medium Impact, Worth Building

#### 8. 🌍 Multi-Currency & Stripe Integration

> **Sudah ada sebagai catatan, USD disabled sementara**

**Deskripsi:** Re-enable USD support dan integrasi Stripe Checkout untuk klien internasional.

**User Stories:**
- *Sebagai freelancer dengan klien internasional*, saya ingin menagih dalam USD dan menerima pembayaran via Stripe.

**Scope Teknis:**
- Re-enable USD select di project form
- Integrasi Stripe Checkout (payment intent + webhook)
- Conditional payment gateway: Mayar (IDR) vs Stripe (USD/other)
- Exchange rate display (optional, bisa manual)

**Estimasi:** Sprint 21 (1 sprint)

---

#### 9. 📧 Email Template Builder (Visual Editor)

**Deskripsi:** Admin bisa mengcustomize template email (warna, logo placement, copy) tanpa harus edit code.

**User Stories:**
- *Sebagai admin*, saya ingin mengubah warna dan wording email invoice tanpa bantuan developer.

**Scope Teknis:**
- UI drag-and-drop sederhana atau field-based editor di `/settings/email-templates`
- Store template config di Settings (JSON field)
- Apply config saat render React Email components
- Preview mode sebelum save

**Estimasi:** Sprint 22 (1 sprint)

---

#### 10. 📱 Progressive Web App (PWA)

**Deskripsi:** Jadikan ProjectBill installable sebagai PWA agar bisa diakses offline dan mendapat push notification.

**User Stories:**
- *Sebagai freelancer*, saya ingin mengakses ProjectBill dari home screen HP saya tanpa buka browser.
- *Sebagai admin*, saya ingin menerima push notification ketika ada pembayaran masuk.

**Scope Teknis:**
- `next-pwa` atau manual Service Worker registration
- `manifest.json` dengan icon dan splash screen
- Push notification via Web Push API
- Offline fallback page

**Estimasi:** Sprint 22 (1 sprint)

---

#### 11. 📋 Activity Log / Timeline

**Deskripsi:** Timeline visual per proyek yang mencatat semua events: dibuat, status berubah, invoice dikirim, pembayaran diterima, SOW ditandatangani.

**User Stories:**
- *Sebagai admin*, saya ingin melihat histori lengkap sebuah proyek dalam satu timeline.

**Scope Teknis:**
- Extend `AuditLog` atau buat `ActivityLog` model baru yang lebih user-friendly
- Komponen `<Timeline />` di project detail page
- Auto-capture events dari Server Actions

**Estimasi:** Sprint 23 (1 sprint)

---

#### 12. 🔄 Expense Tracking & Profit Calculator

**Deskripsi:** Catat pengeluaran per proyek (software licenses, subcontractor, hosting) dan hitung profit margin otomatis.

**User Stories:**
- *Sebagai freelancer*, saya ingin tahu berapa profit sebenarnya dari setiap proyek setelah dikurangi biaya.

**Scope Teknis:**
- Model `Expense` (`projectId`, `description`, `amount`, `category`, `date`, `receipt`)
- UI form + daftar expense di project detail
- Dashboard cards: Gross Revenue vs Net Profit
- Chart: Profit margin per project

**Estimasi:** Sprint 23-24 (2 sprint)

---

### 💡 Tier 4 — Nice to Have / Long-term Vision

#### 13. 🤖 AI-Powered Features
- **Smart Pricing Suggestion:** Berdasarkan histori invoice, suggest harga per scope item
- **Invoice Copy Generator:** AI-generated email copy berdasarkan konteks invoice
- **Project Scope Estimator:** AI-powered man-hours estimation (upgrade dari manual calculator)

#### 14. 📊 Client Satisfaction Survey
- Auto-kirim survey setelah proyek selesai (NPS-style)
- Track satisfaction score di dashboard

#### 15. 🔗 Third-Party Integrations
- **Accounting:** Export ke format Jurnal.id, Xero, atau QuickBooks
- **Project Management:** Sync 2-arah dengan Trello/Notion
- **Calendar:** Google Calendar sync untuk deadline proyek

#### 16. 🌐 Multi-Language Dashboard
- Full i18n untuk dashboard admin (bukan hanya invoice/email)
- Toggle bahasa di sidebar: ID / EN

#### 17. 📈 Client Insights Dashboard
- Revenue per client (lifetime value)
- Payment behavior analysis (average days to pay)
- Client retention metrics

---

## 📅 Suggested Sprint Roadmap

| Sprint | Focus | Key Deliverables |
|--------|-------|-----------------|
| **17** | Client Portal | Client login, invoice list, project status view |
| **18** | Partial Payments | Milestone model, progress UI, auto-invoice |
| **19** | Time Tracking + File Attachments | Stopwatch, time log, S3 upload, deliverables |
| **20** | WhatsApp + Advanced Reports | WA notif, financial reports, CSV export |
| **21** | RBAC + Multi-Currency | Permission matrix, Stripe integration |
| **22** | Email Builder + PWA | Visual email editor, offline support |
| **23** | Activity Log + Expense | Timeline, expense tracking, profit calc |
| **24** | AI Features + Polish | Smart pricing, AI estimator, final QA |

---

## 💡 Rekomendasi Prioritas

> [!IMPORTANT]
> **3 fitur yang paling berdampak untuk segera dikembangkan:**

1. **🌐 Client Portal** — Ini adalah game-changer terbesar. Klien bisa self-service, mengurangi beban komunikasi, dan memberikan kesan profesional yang sangat tinggi.

2. **💳 Partial Payments** — Fitur ini langsung berdampak pada cash flow freelancer. Banyak proyek besar yang butuh pembayaran bertahap, dan saat ini ProjectBill hanya support DP + Balance.

3. **📊 Advanced Reporting** — Untuk keperluan pajak dan business analysis, laporan keuangan yang bisa di-export adalah kebutuhan mendasar yang belum terpenuhi.

> [!TIP]
> Fitur **WhatsApp Integration** sangat relevan untuk pasar Indonesia karena open rate WA jauh lebih tinggi dari email. Ini bisa jadi quick win dengan impact besar.
