# ProjectBill

ProjectBill is a web-based, self-hosted invoicing and project tracking application designed for freelancers and small agencies. It allows users to manage clients, track project stages via a Kanban board, and generate both down-payment (DP) and full-payment invoices with ease.

## Tech Stack
- **Framework:** Next.js 15+ (App Router)
- **Styling:** Tailwind CSS + Shadcn UI components
- **Database:** PostgreSQL (Containerized via Docker Compose)
- **ORM:** Prisma
- **Language:** TypeScript

## Current State: V1.2 Complete

The full MVP through V1.2 features have been successfully implemented:

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
   - Enhanced Dashboard page with financial insight cards.
   - Shows "Total Paid Revenue", "Pending Revenue", "Active Clients", and "Unpaid Invoices" counts.
   - Included Recharts visualizations to map revenue streams and project status distributions.

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

## Upcoming: Sprint 9 (Quality Assurance & Testing)
The immediate focus for the next development cycle is establishing a robust automated testing suite to cement the stability achieved in Sprint 8.
- **Unit Testing (Jest):** Coverage for critical financial calculations (late fees, DP deductions) and signature verification (`verifyMayarWebhook`).
- **Integration Testing (Vitest/Supertest):** API endpoint tests asserting Zod validation, auth rejection, and database mutation.
- **End-to-End Testing (Playwright):** Core user journey tests spanning Login -> Create Client -> Create Project -> Generate Invoice -> View Public Invoice.

## Future Development Plan (V2 & Beyond)

All planned features for V1.2 have been completed. Potential future enhancements:

- **Multi-Currency Payment Gateway** — Currently disabled. If needed, re-enable USD in `projects-client.tsx` and integrate Stripe Checkout for USD invoices.
- **Client Portal** — A dedicated login area for clients to view all their invoices and project status.
- **Recurring Invoices** — Auto-generate monthly invoices for retainer-based projects.
- **File Attachments** — Allow uploading deliverables or contracts to projects.

## Notes for the Next Agent
- All layout components and global CSS are already set up.
- Use Shadcn UI (`npx shadcn@latest add ...`) for any new UI components to maintain visual consistency.
- Ensure that any updates to `prisma/schema.prisma` are followed by `npx prisma db push` and `npx prisma generate`.
- Do NOT use `url` inside the `datasource` block in `schema.prisma`. This project uses Prisma 7, and the `url` must be defined inside `prisma.config.ts`.
- Standalone Node scripts (e.g. `scripts/reset-password.js`) must use the `pg` + `@prisma/adapter-pg` pattern to connect to the database, matching `src/lib/prisma.ts`.
- USD currency is temporarily disabled. The schema and logic still support it — re-enable the `SelectItem` in `projects-client.tsx` and uncomment USD chart data in `page.tsx` (dashboard) when ready.
- All payments are handled exclusively via **Mayar.id** (IDR). Manual bank transfer has been fully removed.
- All delete confirmation dialogs use the reusable `ConfirmDialog` component (`src/components/confirm-dialog.tsx`).
- The sidebar uses `collapsible="icon"` mode — it shrinks to icons when collapsed.
