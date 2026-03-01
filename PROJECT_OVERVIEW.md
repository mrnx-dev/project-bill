# ProjectBill

ProjectBill is a web-based, self-hosted invoicing and project tracking application designed for freelancers and small agencies. It allows users to manage clients, track project stages via a Kanban board, and generate both down-payment (DP) and full-payment invoices with ease.

## Tech Stack
- **Framework:** Next.js 15+ (App Router)
- **Styling:** Tailwind CSS + Shadcn UI components
- **Database:** PostgreSQL (Containerized via Docker Compose)
- **ORM:** Prisma
- **Language:** TypeScript

## Current State: Phase 1-11 (V1.1 Complete)

The Minimum Viable Product (MVP) and advanced V1.1 features have been successfully implemented:

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
   - Created a central `Settings` state in the database mapping to a singleton global configuration.
   - Developed a UI settings panel using `react-hook-form` to configure business Name, Address, Email, and Bank Details.
   - Integrated dynamic settings fetch into public invoices, abandoning generic hardcoded templates.

## Future Development Plan (V2 & Beyond)

To continue the development of ProjectBill, subsequent agents should focus on:

### Phase 10: Multi-Currency Payment Gateway
- **Goal:** Expand automatic payments to USD.
- **Tasks:** Wire up Stripe Checkout for invoices where `currency === 'USD'`, adding a separate webhook listener alongside Mayar.id.

## Notes for the Next Agent
- All layout components and global CSS are already set up.
- Use Shadcn UI (`npx shadcn@latest add ...`) for any new UI components to maintain visual consistency. 
- Ensure that any updates to `prisma/schema.prisma` are followed by `npx prisma db push` and `npx prisma generate`.
- Do NOT use `url` inside the `datasource` block in `schema.prisma`. This project uses Prisma 7, and the `url` must be defined inside `prisma.config.ts`.
