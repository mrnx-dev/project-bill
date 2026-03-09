# ProjectBill

ProjectBill is a web-based, self-hosted invoicing and project tracking application designed for freelancers and small agencies. It allows users to manage clients, track project stages via a Kanban board, and generate both down-payment (DP) and full-payment invoices with ease.

## Tech Stack
- **Framework:** Next.js 15+ (App Router)
- **Styling:** Tailwind CSS + Shadcn UI components (including modern Charts)
- **Database:** PostgreSQL (Containerized via Docker Compose)
- **ORM:** Prisma
- **Email:** React Email + Resend
- **Language:** TypeScript

## Current State: V1.4 Complete

The full MVP through V1.4 features have been successfully implemented:

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
    - **Financial Field Locks:** Once an invoice is generated for a project, critical financial fields (`Currency`, `Language`, `Total Price`, `DP Amount`) and Project Scope Items are strictly locked via UI disablers and robust API validation (`403 Forbidden`). Unpaid invoices must be deleted to unlock modifications.
    - **Invoice Deletion UI:** Invoices list (`/invoices`) now features a `Delete` action for Unpaid status invoices, guarded by a custom `ConfirmDialog`.
    - **Mobile Layout Polish:** Refactored line item grids and financial metadata containers into vertically stacked flexible/responsive grids on mobile displays for optimal data entry and readability.
    - **SOW Full-Screen Editor:** Added a dedicated "Full Screen Edit" modal for Terms & Conditions (SOW) on the Project form, complete with side-by-side Markdown writing and live rendering preview logic.

## Upcoming: Sprint 13 (V2 Feature Expansion)
The next development cycle will focus on expanding core functionality to support a wider array of business models and improving overall client journey Quality of Life. Potential candidates for Sprint 13:

1. **Client Portal (Multitenant Dashboards)** — A dedicated login area or permanent token link for clients to view all their past invoices, project status, and download SOWs from a single unified screen.
2. **Recurring Invoices (Retainers)** — Auto-generate and send monthly invoices for retainer-based projects via scheduled Cron jobs.
3. **File Attachments (S3/R2 Integration)** — Enabling a "Deliverables" section on the Project board where agencies can upload result files (ZIPs, Videos) that unlock for the client only after payment is complete.
4. **Partial Payments & Milestones** — Expanding beyond DP & Balance to support multi-stage payment terms (e.g., 30% Design, 40% Develop, 30% Launch).
5. **Time-Tracking & Hourly Billing** — An in-app stopwatch linked to projects that automatically compiles hours worked into billable invoice line-items at the end of the month.

## Future Development Plan (V2 & Beyond)

All planned features for V1.4 have been completed.
- **Multi-Currency Payment Gateway** — Currently disabled. If international clients are targeted, re-enable USD in `projects-client.tsx` and integrate Stripe Checkout for USD invoices alongside Mayar (IDR).
## Notes for the Next Agent
- All layout components and global CSS are already set up.
- Use Shadcn UI (`npx shadcn@latest add ...`) for any new UI components to maintain visual consistency.
- Ensure that any updates to `prisma/schema.prisma` are followed by `npx prisma db push` and `npx prisma generate`.
- Do NOT use `url` inside the `datasource` block in `schema.prisma`. This project uses Prisma 7, and the `url` must be defined inside `prisma.config.ts`.
- Standalone Node scripts (e.g. `scripts/reset-password.js`) must use the `pg` + `@prisma/adapter-pg` pattern to connect to the database, matching `src/lib/prisma.ts`.
- USD currency is temporarily disabled. The schema and logic still support it — re-enable the `SelectItem` in `projects-client.tsx` and uncomment USD chart data in `page.tsx` (dashboard) when ready.
- All payments are handled exclusively via **Mayar.id** (IDR). Manual bank transfer has been fully removed.
- **Email components** live in `src/emails/`. All templates extend `EmailLayout.tsx` for shared styling. Adding a new email type: create a component in `src/emails/`, add a sender function in `src/lib/email.ts` that calls `render()` + `resend.emails.send()`.
- To preview and develop email components locally, run: `npx react-email dev --dir src/emails --port 3333`.
- Email language is determined by `project.language` (`"id"` or `"en"`). Always pass `lang` when calling email sender functions.
- Payment link creation is centralized in `src/lib/mayar.ts` via `createPaymentLink()`. Do NOT duplicate Mayar API calls in route handlers.
- Use `APP_URL` (not `NEXT_PUBLIC_APP_URL`) for server-side base URL resolution.
- All delete confirmation dialogs use the reusable `ConfirmDialog` component (`src/components/confirm-dialog.tsx`).
- The sidebar uses `collapsible="icon"` mode — it shrinks to icons when collapsed.
