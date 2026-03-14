# ProjectBill

ProjectBill is a web-based, self-hosted invoicing and project tracking application designed for freelancers and small agencies. It allows users to manage clients, track project stages via a Kanban board, and generate both down-payment (DP) and full-payment invoices with ease.

## Tech Stack
- **Framework:** Next.js 15+ (App Router)
- **Styling:** Tailwind CSS + Shadcn UI components (including modern Charts)
- **Database:** PostgreSQL (Containerized via Docker Compose)
- **ORM:** Prisma
- **Email:** React Email + Resend
- **Language:** TypeScript

## Current State: V1.5 Complete

The full MVP through V1.5 features have been successfully implemented:

1. **Infrastructure & Core Entity (Phase 1-2):**
   - Next.js 15+ App Router, Tailwind CSS, Shadcn UI setup.
   - Local PostgreSQL database running via `docker-compose.yml`.
   - Prisma ORM configured (Clients, Projects, Invoices).
   - CRUD for Clients and Projects. Dashboard Kanban.

2. **Invoicing Engine (Phase 3-4):**
   - Invoice Generation (DP / Full Payment) directly from a Project.
   - Invoice Management (`/invoices`) with paid/unpaid toggles.
   - Client-Facing public Invoice View (`/invoices/[id]`).

3. **Authentication & Security (Phase 5):**
   - Implemented NextAuth.js (Auth.js) v5.
   - Protected routes (`/clients`, `/projects`, `/`, `/invoices`) using Next.js Middleware.
   - Ensured the specific invoice public view `/invoices/[id]` remains accessible to clients.

4. **Payment Gateway Integration (Phase 6):**
   - Replaced manual bank transfers with automated online payments via **Mayar.id**.
   - Added a "Pay Now" button to the public invoice view (for IDR currencies).
   - Dynamic Payment Link generation logic via Mayar Headless API.
   - Implemented webhook receiver (`/api/webhook/payment`) with HMAC SHA256 Signature verification for automated `paid` status updates.

5. **Email / Communication System (Phase 7):**
   - Integrated email sending functionality via **Resend** and **React Email**.
   - Added a "Send" button to the Invoice Management table.
   - Built a Server Action (`send-invoice.ts`) that triggers a clean, professional React Email template to the client containing their invoice URL.

6. **Reporting & Analytics (Phase 8):**
   - Enhanced Dashboard page with financial insight cards (Total Paid Revenue, Pending Revenue, Active Clients, Unpaid Invoices).
   - Migrated to **Shadcn UI Charts** for modern, themeable visualizations with native Light/Dark mode support.
   - Revenue bar charts and project status donut charts rendered via `ChartContainer`, `ChartTooltip`, and `ChartLegend`.

7. **Export & PDF Generation (Phase 9):**
   - Built a flawless physical document output using optimized CSS `@media print` directives.
   - Added a "Download PDF / Print" feature directly to the native public invoice view.
   - Clean, A4-ready layouts that hide UI clutter automatically during print.

8. **Settings & Branding Customization (Phase 11):**
   - Created a central `Settings` singleton in the database (`id: "global"`).
   - UI settings panel (`/settings`) to configure Company Name, Address, and Contact Email.
   - Invoice view dynamically fetches company info from Settings.

9. **Invoice Detail Items & IDR Focus (V1.2 Patch):**
   - Public invoice view now renders individual project item line-items if the project has scope items.
   - Automatically shows a "Less: Down Payment" deduction row for balance invoices.
   - USD currency option temporarily disabled across the app (Projects, Dashboard charts).
   - Manual bank transfer payment removed entirely (UI, API, and DB schema cleaned up).
   - Email "Send" button auto-disabled for already-paid invoices.

10. **Task Board Completion Sequence (Sprint 6):**
    - Auto-invoice prompt dialog appears when moving a project to "Done".
    - Options: "Generate Invoice Now" or "Skip for Now".
    - Done cards styled with emerald accents, checkmark icons, and "Completed & Paid" badges.
    - Archive toggle hides fully-paid Done projects to keep the board clean.

11. **First-Run Setup & Admin Management (Sprint 7):**
    - Secure onboarding flow inspired by n8n: `/setup` route creates the first Admin user.
    - `/setup` auto-locks after the first user is registered, redirecting to `/login`.
    - Profile Settings form allows the logged-in admin to change their password securely.
    - Emergency CLI password reset tool: `npm run reset-password <email> <newPassword>`.

12. **UI/UX & Aesthetics Polish (Sprint 7):**
    - Replaced all native `alert()`/`confirm()` dialogs with Shadcn `sonner` Toasts and `AlertDialog` components.
    - Implemented `react-number-format` for auto-formatted IDR currency inputs across Projects and Board views.
    - Added visually engaging Empty States with Lucide icons for Clients and Projects tables.
    - Company Logo URL support in Settings with live preview; displayed on public invoice view alongside company name.
    - Sidebar collapses to icon-only mode instead of disappearing completely.

13. **Architecture & Data Security (Sprint 7):**
    - Soft Delete for Clients: `isArchived` flag — clients with paid invoices are archived, not hard-deleted.
    - Database Indexing: `@@index([status])` on Project and Invoice, `@@index([clientId])` on Project.
    - API Security Layer: All internal `/api` routes secured with NextAuth `auth()` session checks.
    - Project deletion guard: Projects with unpaid invoices cannot be deleted.
    - All delete confirmations use proper `ConfirmDialog` (AlertDialog) component instead of native browser dialogs.

14. **Security, Hardening & Resilience (Sprint 8):**
    - **Zod Validation:** Strict runtime validation on API payloads (`POST /projects`, `POST /invoices`) and startup environment variables (`src/lib/env.ts`).
    - **Data Integrity:** `prisma.$transaction()` wraps multi-step financial operations (e.g., cron late fees). `Invoice` relation changed to `onDelete: Restrict` to prevent accidental financial record deletion.
    - **Endpoint Hardening:** Webhook signature verification uses `crypto.timingSafeEqual` and strictly denies invalid requests. Cron jobs enforce strict authorization checks. Plaintext password logging removed from authentication flow.
    - **Error Boundaries:** Implemented `global-error.tsx` (for layout crashes) and `error.tsx` (component boundaries) with user-friendly recovery UI.
    - **Performance & UX:** Parallelized data fetching on Dashboard using `Promise.all()`. Added elegant Skeleton Loading states (`loading.tsx`). Added `?page` and `?limit` pagination to List APIs.
    - **Invoice Numbering:** Fully sequential `INV-YYYYMM-XXXX` tracking system built into the database schema (`String @unique`).

15. **Quality Assurance & Automated Testing (Sprint 9):**
    - **Jest Unit Tests:** 8 passing tests covering `verifyMayarWebhook` signature verification (valid, invalid, empty secret, length mismatch) and financial calculations (late fee 5%, IDR formatting, DP deductions, zero DP).
    - **Playwright E2E Tests:** 3 passing tests — API auth rejection for unauthenticated requests, and a full Core Business Journey (Login → Create Client → Create Project → Generate Invoice → Verify Invoice).
    - **Test Infrastructure:** `jest.config.ts` with Next.js integration, `playwright.config.ts` targeting `localhost:3000`, and `scripts/seed-test-user.ts` for reproducible test data.
    - **NPM Scripts:** `npm test` (Jest), `npm run test:e2e` (Playwright), `npm run test:seed` (seed test user).

16. **Digital Contracts & Terms of Service (Sprint 10):**
    - **Database Extensions:** Added `terms` and `termsAcceptedAt` fields to `Project` model, and established the `SOWTemplate` table.
    - **Multi-Template Management:** Added a dedicated dashboard (`/settings/sow-template`) for Admins to create, edit, and manage multiple dynamically named SOW Templates.
    - **Project Integration:** Added a "Load from Template" dropdown to the Project Creation/Edit forms to instantly import saved terms.
    - **Rich Text Previews:** Integrated `react-markdown` with `@tailwindcss/typography` to elegantly format Markdown Headings, Lists, and Tables across the admin editor, pop-up contract views, and print layouts.
    - **Client Journey Enforcement:** The public invoice view hides the "Pay Now" button behind a mandatory Terms Agreement gate if terms were provided.
    - **Professional Signature Flow:** A "Digital Agreement Required" banner triggers a full-screen legal document modal. Clients must check an agreement box and accept terms.
    - **Public View Theming Guard:** `next-themes` dark mode is explicitly overridden on `/invoices/[id]` (forced light mode) to preserve the black-on-white paper aesthetic.

17. **SOW Legal Hardening & Audit Trails (Sprint 10):**
    - **Audit Trail Recording:** Captured `termsAcceptedUserAgent`, a unique `termsAcceptedSessionId`, and a sequential `termsVersionId` in the database to legally validate non-repudiation.
    - **Scroll-to-Bottom Enforcement:** Modified the Terms Modal UI so the "Accept" checkbox is disabled until the client actually scrolls to the very bottom of the document.
    - **Native Print Generation:** Replaced external PDF libraries with a native CSS `@media print` layout at `/invoices/[id]/sow/print` for flawless, responsive A4 document generation directly from the browser.
    - **Client Receipt:** Added a "Download / Print PDF" functionality to the success banner after the client accepts the digital contract, complete with an Audit Trail footer detailing the User Agent, Session ID, and timestamp.

18. **Real-Time Webhook UI Sync & Auto-Delivery (Sprint 10):**
    - **Zero-Cost DB Polling:** Utilized Next.js Server Actions with lightweight Prisma queries (`select: { status: true }`) and `count()` functions to monitor database changes.
    - **Client-Side Poller Components:** Mounted invisible `<RealtimeInvoicePoller />` on unpaid invoices and `<GlobalInvoicePoller />` on admin dashboard lists to refresh the UI (`router.refresh()`) the exact second a successful webhook lands.
    - **Cache Revalidation:** Tied Next.js edge-caching (`revalidatePath()`) cleanly into the backend `api/webhooks/mayar/route.ts` architecture for 1-millisecond synchronization.
    - **Automated SOW Delivery:** Integrated Puppeteer to run a headless browser upon receiving a `payment.success` webhook. It captures a pixel-perfect Print PDF of the digital SOW and instantly attaches it to a "Payment Successful" receipt email via Resend natively inside Serverless logic.

19. **Mobile UI/UX Responsiveness (Sprint 10 Patch):**
    - **Swipeable Sidebar:** Implemented a native-feeling gesture allowing users to seamlessly swipe right from the left edge of their mobile screens to open the sidebar, bypassing the top navbar hamburger menu.
    - Added an invisible `touchAction: "pan-y"` intercept zone to prevent default mobile browser behaviors from blocking the gesture.

20. **Project-Level Localization (Sprint 9):**
    - **Granular Settings:** Moved from global to project-level language toggles (ID/EN).
    - **Dynamic Rendering:** Invoices, SOWs, and Print Views automatically adapt their labels and date formatting based on the project's specific locale.

21. **Refined Project Scopes & DP Locks (Sprint 9):**
    - **Qty & Rate Inputs:** Scope items now support `Quantity` and `Rate` fields with automatic `Amount` calculation.
    - **Anti-Tampering Lock:** The Down Payment (DP) amount is strictly locked both on UI and API levels once the first invoice has been generated for a project.

22. **Digital Contracts & SOW Templates Redesign (Sprint 10):**
    - **Premium UI Revamp:** The SOW Template management area features a complete redesign with modern gradients, card layouts, and enhanced edit forms.
    - **Markdown Editor:** Professional-grade template editor with toggleable side-by-side or fullscreen live previews.
    - **Audit Trails:** Legal non-repudiation tracking (IP, User Agent, Session ID) stored for every SOW acceptance.

23. **UI/UX Polish & Communication (Sprint 10):**
    - **Toast Notifications:** Replaced all remaining browser `alert()` and `confirm()` calls with high-fidelity `sonner` toasts, including "Copy Link" actions for manual email modes.
    - **Sidebar Logic:** Refined navigation highlighting to prevent overlapping active states between parent and sub-routes.
    - **Company WhatsApp:** Added business WhatsApp support in Settings, with automatic population on document headers.

24. **Payment Architecture & Dashboard Overhaul (Sprint 11):**
    - **Centralized Payment Helper:** Refactored `/api/invoices/[id]/pay/route.ts` to use the shared `createPaymentLink()` function from `src/lib/mayar.ts`, eliminating code duplication and ensuring consistency with `redirectUrl` and `expiredAt` parameters.
    - **Shadcn UI Charts Migration:** Replaced raw Recharts components with the modern Shadcn UI Chart library (`ChartContainer`, `ChartTooltip`, `ChartLegend`) for native Light/Dark theme support via CSS variables.
    - **Dashboard UI Polish:**
      - **Color Consistency:** Revenue bars now match card colors (emerald for Paid, amber for Pending) across all dashboard elements.
      - **Compact Y-Axis:** Revenue axis now displays abbreviated values (`10 Jt`, `500 Rb`, `1,2 M`) instead of raw numbers.
      - **Donut Center Label:** Project Status chart displays the total project count as a large centered number inside the donut ring.
      - **Card Enhancements:** Added `Wallet` and `Clock` icons to revenue cards for visual balance. Increased card padding for better breathing room.
    - **Environment Variable Cleanup:** Consolidated `NEXT_PUBLIC_APP_URL` to `APP_URL` across all server-side code (`env.ts`, `pay/route.ts`, `webhook/route.ts`, `pdf-generator.ts`).

25. **Email System Overhaul & Internationalization (Sprint 12):**
    - **React Email Migration:** Replaced all raw HTML email templates in `email.ts` with proper React Email components under `src/emails/`. File reduced from ~365 lines of inline HTML to ~190 lines of clean rendering logic.
    - **Shared Component Architecture:** Built `EmailLayout.tsx` as a shared wrapper with reusable sub-components (`StatusBadge`, `InvoiceCard`, `DetailRow`, `CtaButton`). All email types (`InvoiceEmail`, `ReminderEmail`, `PaymentSuccessEmail`) extend this layout for design consistency.
    - **Dynamic Company Settings:** Email header, sender `from:` field, and footer support email now read from the `Settings` database table (`companyName`, `companyLogoUrl`, `companyEmail`). If a logo URL is set, it renders as an image in the header; otherwise, the company name is displayed as text.
    - **Bilingual Email Templates (ID/EN):** All email components accept a `lang` prop sourced from `project.language`. Greeting text, body copy, status badges (e.g., BELUM BAYAR / UNPAID), card labels (Tagihan Kepada / Billed To), CTA buttons (Lihat Invoice & Bayar / View Invoice & Pay), and email subject lines are fully translated.
    - Unified Email Types: 7 email types consolidated into 3 React Email components: `InvoiceEmail` (manual + auto-generated), `ReminderEmail` (pre_due, overdue_d1, overdue_d3, late_fee), and `PaymentSuccessEmail` (with optional SOW PDF attachment).

26. **Flexible Tax & Financial Protections (Sprint 12 Patch):**
    - **Single Flexible Tax:** Projects now support an optional `taxName` (e.g., PPN, VAT) and `taxRate` (percentage). The tax amount is dynamically calculated and added to the Total Price gracefully.
    - **Financial & SOW Locks:** Once a client has signed a project's SOW (`termsAcceptedAt`), the entire project is locked from further modifications. Additionally, when an invoice is generated, critical financial fields (`Currency`, `Language`, `Total Price`, `DP Amount`) and Project Scope Items are strictly locked via UI disablers and robust API validation (`403 Forbidden`). 
    - **Invoice Deletion & Auto-Unlock:** Invoices list (`/invoices`) now features a `Delete` action for Unpaid status invoices, guarded by a custom `ConfirmDialog`. Deleting the last existing invoice for a project automatically drops the SOW signature (`termsAcceptedAt = null`), unlocking the project for further editing.
    - **Mobile Layout Polish:** Refactored line item grids and financial metadata containers into vertically stacked flexible/responsive grids on mobile displays for optimal data entry and readability.
    - **SOW Full-Screen Editor:** Added a dedicated "Full Screen Edit" modal for Terms & Conditions (SOW) on the Project form, complete with side-by-side Markdown writing and live rendering preview logic.

27. **API Key Security Hardening (Sprint 13):**
    - **AES-256-GCM Encryption:** Sensitive API keys (`resendApiKey`, `mayarApiKey`, `mayarWebhookSecret`) are now encrypted at rest in the database using AES-256-GCM via a dedicated `src/lib/crypto.ts` utility. Requires `ENCRYPTION_KEY` environment variable (64-char hex).
    - **Masked API Responses:** The `GET /api/settings` endpoint returns only masked values (e.g., `****abcd`) for sensitive fields. The backend detects unchanged masked values on `PUT` to avoid unnecessary re-encryption.
    - **Audit Logging:** An `AuditLog` model tracks all changes to sensitive API key fields, recording the user, action, field name, and masked old/new values for compliance and forensic review.
    - **Legacy Compatibility:** The `decrypt()` function gracefully handles pre-encryption plaintext values, ensuring a smooth migration without data loss.

28. **Bug Fixes & Stability (Sprint 13):**
    - **Postgres Concurrency Fix:** Replaced `Promise.all([findMany, count])` with sequential `await` calls in paginated API routes (`/api/invoices`, `/api/projects`, `/api/clients`) to resolve the `pg@9.0` deprecation warning about concurrent `client.query()` calls.
    - **Hydration Mismatch Fix:** Added `suppressHydrationWarning` to the `<body>` tag in `layout.tsx` to suppress DarkReader browser extension injecting mismatched SVG attributes during hydration.
    - **Taskboard Button Color:** Added explicit `text-white` to the "Generate Invoice" confirmation button in the completion dialog for proper dark mode visibility.
    - **Unified Invoice Email Pipeline:** The `/api/invoices/generate` route now calls the centralized `sendInvoiceEmail` Server Action directly (instead of duplicated inline logic), ensuring invoice number, due date, and subject are always consistent across all email dispatch paths.
    - **Default Due Date:** Invoices created from the invoice table without a specified due date now default to `today + 7 days` instead of `null`.
    - **Email Subject Sync:** Invoice email subjects now include the invoice number and follow a bilingual pattern: `Invoice [INV-XXX] untuk [Project] - Diperlukan Tindakan` (ID) / `Invoice [INV-XXX] for [Project] - Action Required` (EN).
    - **Email Logo Styling:** Added `borderRadius: 8px` to the company logo `<Img>` in `EmailLayout.tsx` for a more modern appearance.

29. **Mobile-First Scope Dialog (Sprint 13):**
    - **Responsive Redesign:** The Project Details / Scope Items dialog (`project-details-dialog.tsx`) has been redesigned with a mobile-first approach. On small screens, items display as vertically stacked cards with clear labels; on desktop (≥`md`), they revert to a clean tabular row layout.
    - **Touch-Friendly Actions:** The delete button is always visible on mobile (no hover dependency), and input fields are taller (`h-9`) with better touch targets.
    - **Scrollable Content:** Added `max-h-[60vh] overflow-y-auto` to the items container to prevent the dialog from overflowing on screens with many scope items.

## Current State: V1.6 Complete

30. **Recurring Invoices / Retainer Billing (Sprint 14):**
    - **Database Schema:** New `RecurringInvoice` model linked to `Project` with fields for `title`, `amount`, `frequency` (monthly/weekly/yearly), `dayOfMonth`, `startDate`, `endDate`, `nextRunAt`, and `isActive` toggle. Added `notes` (Text) field to `Invoice` model for recurring descriptions.
    - **CRUD API:** Full REST endpoints at `/api/recurring-invoices` (GET, POST) and `/api/recurring-invoices/[id]` (PUT, DELETE with soft-deactivate). Input validation via Zod (`recurringInvoiceSchema`).
    - **Cron Job Engine:** Secure daily endpoint `/api/cron/recurring-invoices` protected by `CRON_SECRET` Bearer token. Logic: query due templates → generate `Invoice` (type: `"recurring"`) → send email → advance `nextRunAt` → auto-pause if `endDate` reached. Handles missed cycles by looping until `nextRunAt > today`.
    - **Dedicated Email Template:** `RecurringInvoiceEmail.tsx` (separate from `InvoiceEmail.tsx`) with tailored copy: "Ini adalah pemberitahuan bahwa tagihan rutin Anda..." (ID) / "This is a notification that your recurring invoice..." (EN). Includes a **Type: Tagihan Rutin** detail row and renders the recurring template's `description` as italic text in the email body.
    - **Invoice Detail Display:** Invoices with `type === "recurring"` now render a **single clean line item** showing the recurring description and amount (via `notes` field), instead of confusingly listing all project scope items. Badge displays `RECURRING`.
    - **Dashboard UI:** Full management page at `/recurring-invoices` with table listing, create/edit modal dialog, status toggle (Active/Paused), and delete confirmation. Sidebar navigation added with `CalendarClock` icon.

31. **Cost Estimator — Man-hours Calculator (Sprint 14):**
    - **Formula:** `Total = Σ(Hours per task × Rate/Hour) × Risk Buffer`. Risk Buffer adjustable from 1.0x to 2.0x via Slider (default 1.5x).
    - **Dialog Popup UI:** Mobile-first responsive `Dialog` component (not inline collapsible). Trigger button placed next to "Project Scope / Items" label.
    - **Scope Integration:** Clicking "Apply Value" generates structured line items (description, quantity=hours, rate=adjusted rate, price) from the estimation and injects them directly into the project's items list. For existing projects, items are created via API and the total price is updated automatically.
    - **Client-Side Only:** No database storage for man-hours data — purely a calculation helper. Generated items persist as normal `ProjectItem` records.

32. **Invoice & Email Localization Fixes (Sprint 14):**
    - **PayButton Localization:** The "Online Payment Available" section on the public invoice view now fully supports Indonesian: "Pembayaran Online Tersedia" / "Bayar [amount] Sekarang".
    - **DP Deduction Row Fix:** The "Dikurangi: Uang Muka" deduction row no longer appears when `dpAmount` is `0`, preventing phantom `-Rp 0` entries on invoices.

## Current State: V1.7 Complete

33. **Robustness, Security & Production Readiness (Sprint 15):**
    - **Rate Limiting:** In-memory IP-based rate limiter (`src/lib/rate-limit.ts`) applied to Webhook and Cron endpoints to mitigate DDoS/abuse.
    - **Cron Idempotency:** Recurring invoice generation wrapped in `prisma.$transaction` with atomic `nextRunAt` bump, preventing duplicate invoices if the cron fires multiple times.
    - **Webhook Replay Prevention:** Mayar webhook handler uses `prisma.invoice.updateMany` with `status: "unpaid"` guard for atomic idempotent processing.
    - **Error Monitoring (Opt-In):** Integrated `@sentry/nextjs` with opt-in activation via a single `SENTRY_DSN` environment variable. Compatible with **GlitchTip** (self-hosted) or Sentry Cloud. Client-side DSN auto-forwarded via `next.config.ts env` mapping. Global Error Boundary (`global-error.tsx`) reports crashes automatically.
    - **XSS Sanitization:** Added `rehype-sanitize` plugin to all 4 `ReactMarkdown` rendering instances (`terms-agreement.tsx`, `projects-client.tsx`, `sow/print/page.tsx`, `sow-template/[id]/page.tsx`) to prevent Cross-Site Scripting attacks via malicious Markdown input.
    - **Database Backup (Docker Sidecar):** Added optional `db-backup` container in `docker-compose.yml` using `prodrigestivill/postgres-backup-local`. Automatic daily `pg_dump` with 7-day/4-week/6-month retention policy. Backups stored in `./backups/` (gitignored).
    - **Email Status Tracking:** Added `emailStatus` field (`pending`, `sent`, `failed`) to the Invoice model. Email sending failures are caught and recorded. UI displays status badges on invoice lists with a "Retry" action for failed emails via `POST /api/invoices/[id]/retry-email`.
    - **Audit Trails:** Created centralized `createAuditLog()` utility (`src/lib/audit-logger.ts`) logging `userId`, `action`, `entityType`, `entityId`, `oldValue`, `newValue`. Injected into Invoice CRUD routes and Project SOW acceptance endpoint.
    - **Dashboard Optimization:** Replaced in-memory array mapping with `prisma.invoice.aggregate({ _sum })` queries for revenue calculations, offloading computation to PostgreSQL.
    - **Role-Based Access Control (Foundation):** Added `role` field to `User` model (`admin` | `staff`). Extended NextAuth JWT/Session callbacks to include `user.role`. Settings API routes and UI enforce `role === "admin"` authorization checks. Non-admin users see an "Access Denied" page.

## Current State: V1.8 Complete

34. **In-App Notification System (Sprint 16):**
    - **Database Schema:** New `Notification` model with `title`, `message`, `type` (`payment`, `sow_signed`, `system`), `isRead`, `linkUrl`, timestamps. Indexed on `isRead` and `createdAt`.
    - **Server Utility:** Centralized `createNotification()` in `src/lib/notifications.ts` for consistent server-side notification creation.
    - **REST API:** `/api/notifications` — `GET` (paginated with `?page` & `?limit`, includes `unreadCount`) and `PATCH` (mark single or all as read). Role-based `admin` authorization enforced.
    - **Event Triggers:** Auto-creates notifications on `payment.success` webhook (links to invoice) and SOW acceptance (links to `/projects` list).
    - **Notification Bell:** `src/components/notifications/notification-bell.tsx` mounted in the dashboard header. Uses `swr` polling every 15 seconds with optimistic UI for mark-as-read. Displays unread badge counter (capped at `99+`).
    - **Real-Time Toasts:** Integrated `sonner` in `layout.tsx` with `position="top-right"` to alert users of new notifications instantly.
    - **Full History Page:** Dedicated `/notifications` route with server-side pre-fetching and client-side SWR pagination (`Previous` / `Next` controls). Type-specific icons and badges (Payment = emerald, Document = blue). Individual "Mark as read" and "View Details" actions per notification.
    - **Global Onboarding Setup Assistant:** Built a mobile-first, multi-step Setup Assistant modal (`<OnboardingModal />`) that intercepts new users on the dashboard if `onboardingCompleted` is false.
      - Includes 7 distinct wizard steps: Welcome, Company Profile, Bank Details, Integrations, Create First Client, Create First Project, and Celebration.
      - Uses forced-completion logic (cannot be dismissed by clicking outside or pressing ESC), ensuring users configure mandatory billing settings before using the app.
      - Saves data progressively step-by-step to the database (Settings, Clients, Projects) so progress isn't lost.
    - **Hydration-Safe i18n:** Browser locale detection extracted to `src/lib/i18n.ts` (`getBrowserLocale()`). Uses `useState` + `useEffect` pattern to prevent Next.js server/client hydration mismatches. Supports `id` (Indonesian) and `en` (English) date-fns locales.
    - **NextAuth SessionProvider:** Added global `<Providers>` wrapper (`src/components/providers.tsx`) in root `layout.tsx` to provide `useSession` context to all client components.
    - **"View all" Link:** Notification Bell popover footer includes a persistent link to the full `/notifications` history page.
  
 35. **Code Quality & Stability Patches (Sprint 16 Patch):**
     - **Reusable Form Architecture:** Extracted Zod validation schemas (`src/lib/validations/settings.ts`) and built highly modular, reusable React components (`CompanyProfileFields`, `BankDetailsFields`, `IntegrationsFields`). These are now shared seamlessly between the `/settings` page and the initial `/setup` Onboarding Wizard, eliminating boilerplate.
     - **Settings API Upsert (P2025 Fix):** Refactored `PUT /api/settings` to use `prisma.settings.upsert` instead of `update`. This ensures the global settings record is safely initialized even if the database was completely cleared, resolving the `P2025 Record not found` Prisma error during onboarding.
     - **Recharts Deprecation Refactor:** Completely removed usage of the deprecated `<Cell />` component in `OverviewCharts` (protecting against the upcoming Recharts 4.0 removal). Refactored `<Bar />` charts to use the `shape` prop with custom `<Rectangle />` rendering, and refactored `<Pie />` charts by injecting `fill` properties directly into the data array.
     - **Dashboard Empty State Hardening:** Fixed a fatal `TypeError` crash in Recharts when project/revenue data was entirely empty. Ensured that "No Projects" placeholder data is hidden from the legend hover tooltip and correctly excluded from the "Total Projects" center calculation (shows 0 instead of 1).

 36. **UI Polish, Auth Fixes & Tech Debt Cleanup (Sprint 16 Patch 2):**
     - **Settings Route Stabilization:** Converted the `/settings` page from a Client Component to a Server Component using `auth()` to resolve stale session states that caused "Access Denied" errors immediately after initial onboarding.
     - **Onboarding Modal Form Upgrade:** Refactored the Client and Project creation steps inside `<OnboardingModal />` to fully utilize ShadcnUI `FormField`, `FormItem`, and `Select` components, backed by strict Zod schemas and `react-hook-form` for robust validation.
     - **Sidebar Aesthetics:** Enhanced the collapsible sidebar so the header gracefully hides text and retains only the company logo when compressed into icon mode, keeping the UI uncluttered.
     - **Recurring Invoice Email Template:** The server action `send-invoice.ts` now dynamically detects if `invoice.type === "recurring"` and routes the email through the specialized `RecurringInvoiceEmail.tsx` template, featuring custom messaging for subscription billing.
     - **Knip Core Cleanup:** Resolved technical debt by configuring `knip.json` to properly ignore valid ShadcnUI exports and raw React Email templates, eliminating false-positive bloat. Removed completely unused packages (e.g., `jest-mock-extended`) to lighten `.node_modules` footprint.

 37. **Core Reliability & Visual Consistency Patches (Sprint 16 Patch 3):**
     - **URL Generator Robustness:** Centralized all absolute URL generation across PDF rendering and Email links into a safe `getBaseUrl()` utility, robustly handling `APP_URL`, `VERCEL_URL`, and `localhost` fallbacks while sanitizing trailing slashes to prevent `ERR_INVALID_URL` crashes during automated background tasks.
     - **Custom Email Identity:** Integrated the dynamic `companyName` and `companyEmail` from global settings directly into the Resend `from:` field, ensuring clients receive communications from a matching branded sender identity instead of a generic default.
     - **Skeleton UI Standardization:** Synchronized loading state skeletons across the entire dashboard (`/`, `/clients`, `/invoices`, `/projects`, `/board`) to exactly match the rendered components' layouts, eliminating jarring layout shifts (Cumulative Layout Shift) during data fetching.
     - **Notification Routing Fix:** Corrected the `linkUrl` for manual "Mark as Paid" notifications to use the immutable database UUID instead of the display invoice number, preventing 404 errors when admins click the notification bell alert.

## Upcoming: Sprint 17 (V2 Feature Expansion)
The next development cycle will focus on expanding core functionality. Potential candidates:

1. **Client Portal (Multitenant Dashboards)** — A dedicated login area or permanent token link for clients to view all their past invoices, project status, and download SOWs from a single unified screen.
2. **File Attachments (S3/R2 Integration)** — Enabling a "Deliverables" section on the Project board where agencies can upload result files (ZIPs, Videos) that unlock for the client only after payment is complete.
3. **Partial Payments & Milestones** — Expanding beyond DP & Balance to support multi-stage payment terms (e.g., 30% Design, 40% Develop, 30% Launch).
4. **Time-Tracking & Hourly Billing** — An in-app stopwatch linked to projects that automatically compiles hours worked into billable invoice line-items at the end of the month.
- **Multi-Currency Payment Gateway** — Currently disabled. If international clients are targeted, re-enable USD in `projects-client.tsx` and integrate Stripe Checkout for USD invoices alongside Mayar (IDR).

## Notes for the Next Agent
- All layout components and global CSS are already set up.
- Use Shadcn UI (`npx shadcn@latest add ...`) for any new UI components to maintain visual consistency.
- Ensure that any updates to `prisma/schema.prisma` are followed by `npx prisma db push` and `npx prisma generate`.
- Do NOT use `url` inside the `datasource` block in `schema.prisma`. This project uses Prisma 7, and the `url` must be defined inside `prisma.config.ts`.
- Standalone Node scripts (e.g. `scripts/reset-password.js`) must use the `pg` + `@prisma/adapter-pg` pattern to connect to the database, matching `src/lib/prisma.ts`.
- USD currency is temporarily disabled. The schema and logic still support it — re-enable the `SelectItem` in `projects-client.tsx` and uncomment USD chart data in `page.tsx` (dashboard) when ready.
- **API Key Encryption:** All sensitive keys are encrypted using AES-256-GCM. Requires `ENCRYPTION_KEY` in `.env`. Use `crypto.ts` helpers (`encrypt`, `decrypt`, `maskSecret`, `isMaskedValue`) for any new sensitive fields.
- **Avoid Prisma `Promise.all`:** Do NOT use `Promise.all` with multiple Prisma queries sharing the same connection — use sequential `await` calls to avoid the `pg@9.0` concurrency deprecation.
- All payments are handled exclusively via **Mayar.id** (IDR). Manual bank transfer has been fully removed.
- **Email components** live in `src/emails/`. All templates extend `EmailLayout.tsx` for shared styling. Adding a new email type: create a component in `src/emails/`, add a sender function in `src/lib/email.ts` that calls `render()` + `resend.emails.send()`.
- To preview and develop email components locally, run: `npx react-email dev --dir src/emails --port 3333`.
- Email language is determined by `project.language` (`"id"` or `"en"`). Always pass `lang` when calling email sender functions.
- Payment link creation is centralized in `src/lib/mayar.ts` via `createPaymentLink()`. Do NOT duplicate Mayar API calls in route handlers.
- Use `APP_URL` (not `NEXT_PUBLIC_APP_URL`) for server-side base URL resolution.
- All delete confirmation dialogs use the reusable `ConfirmDialog` component (`src/components/confirm-dialog.tsx`).
- The sidebar uses `collapsible="icon"` mode — it shrinks to icons when collapsed.
- **Recurring Invoices:** The cron endpoint `/api/cron/recurring-invoices` requires `CRON_SECRET` env variable. Deploy with an external scheduler (Vercel Cron, cron-job.org) hitting this endpoint daily with `Authorization: Bearer <CRON_SECRET>`.
- **Recurring Invoice Type:** Invoices generated by the cron use `type: "recurring"` and store the template description in the `notes` field. The public invoice view renders a single line item for this type instead of project scope items.
- **Cost Estimator:** The `CostEstimator` component (`src/components/cost-estimator.tsx`) is a client-side-only man-hours calculator. It generates `ProjectItem` records but does not store estimation data in the DB.
- **Email Templates:** Recurring invoices use `RecurringInvoiceEmail.tsx` (separate from `InvoiceEmail.tsx`). The `sendInvoiceEmail()` action accepts `isRecurring` and `recurringDescription` optional params.
- **Error Monitoring:** Sentry/GlitchTip is opt-in. Set `SENTRY_DSN` in `.env` to enable. If empty, error tracking is silently disabled. The DSN is auto-forwarded to client-side via `next.config.ts`.
- **Audit Logging:** Use `createAuditLog()` from `src/lib/audit-logger.ts` for any new financial or destructive operations. It silently fails (console.error) to avoid blocking parent operations.
- **RBAC:** `session.user.role` is available in all authenticated contexts. Use `role === "admin"` checks on sensitive API routes. The Settings page has both API and UI guards.
- **Docker Backup:** The `db-backup` sidecar in `docker-compose.yml` is optional. Users on managed DBs (Supabase, Neon, Dockploy) should remove it.
- **Markdown Sanitization:** All `<ReactMarkdown>` components must include `rehypePlugins={[rehypeSanitize]}` to prevent XSS. Always add this when creating new Markdown rendering instances.
- **Notification System:** Use `createNotification()` from `src/lib/notifications.ts` to trigger notifications from any server-side code. Supported types: `payment`, `sow_signed`, `system`. The `/api/notifications` route supports `?page` and `?limit` query params for pagination.
- **i18n Locale Detection:** Browser locale detection lives in `src/lib/i18n.ts` (`getBrowserLocale()`). Always use the `useState` + `useEffect` pattern in client components to avoid Next.js hydration mismatches. Currently supports `id` and `en` locales.
- **NextAuth SessionProvider:** The global `<Providers>` wrapper in `src/components/providers.tsx` provides NextAuth `SessionProvider` context. Any client component using `useSession()` must be rendered within this provider (already handled in root `layout.tsx`).
