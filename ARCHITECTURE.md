## Architecture Spec: ProjectBill Core System

### System Overview
ProjectBill is a self-hosted B2B invoicing and project tracking application. The system follows a monolithic architecture built completely on the Next.js framework (App Router) to simplify deployment and integrate full-stack logic tightly. The backend relies on Next.js Server Actions and API routes, directly connected to a PostgreSQL database via Prisma ORM. Core external integrations include Mayar.id for payment processing (via async webhooks) and any SMTP server for transactional emails.

### Component Architecture Diagram
```mermaid
graph TD
    classDef clientUI fill:#bfdbfe,stroke:#3b82f6,stroke-width:2px,color:black
    classDef theBackend fill:#fca5a5,stroke:#ef4444,stroke-width:2px,color:black
    classDef theDatabase fill:#fef08a,stroke:#eab308,stroke-width:2px,color:black
    classDef externalAPI fill:#d9f99d,stroke:#84cc16,stroke-width:2px,color:black

    A[Admin Dashboard UI]:::clientUI
    C[Public Client Invoices]:::clientUI
    
    A -->|Server Actions / REST| B(Next.js App Router)
    C -->|Server Actions| B
    
    B:::theBackend
    
    B --> D{NextAuth Auth.js}:::theBackend
    B --> E[(PostgreSQL DB)]:::theDatabase
    E -->|Prisma ORM| B
    
    B --> F[SMTP Server]:::externalAPI
    B --> G[Mayar.id API]:::externalAPI
    G -->|Webhook| B
    
    H[External Cron Scheduler]:::externalAPI -->|Daily Trigger| B
```

### Stack & Technologies
- **Frontend**: Next.js 15+ (React), Tailwind CSS, Shadcn UI
- **Backend**: Next.js 15+ (App Router API & Server Actions)
- **Database**: PostgreSQL (Containerized via Docker) with Prisma ORM v7
- **Authentication**: Auth.js (NextAuth v5)
- **Emails**: React Email + SMTP (Nodemailer)
- **Payments**: Mayar.id Headless API 

### Database Schema (Core ERD)
```mermaid
erDiagram
    Client ||--o{ Project : has
    Project ||--o{ ProjectItem : contains
    Project ||--o{ Invoice : issues
    Project ||--o{ RecurringInvoice : manages
    Project ||--o| SOWTemplate : "template reference"

    Client {
        String id
        String name
        String email
        Boolean isArchived
    }
    Project {
        String id
        String title
        String status
        Decimal totalPrice
        DateTime termsAcceptedAt
    }
    Invoice {
        String invoiceNumber
        String type
        Decimal amount
        String status
        String emailStatus
    }
    User {
        String email
        String role
    }
```
**Key Sub-Models & Tables:**
- **`SOWTemplate`**: Reusable markdown agreements for projects.
- **`Settings`**: Global singleton (`id: "global"`) for company data and encrypted API keys.
- **`AuditLog`**: Compliance tracking for sensitive field updates.
- **`RecurringInvoice`**: Tracks cron jobs for periodic invoice duplication.

### API & External Communications
- **Webhook Handlers**: `POST /api/webhook/mayar` (Secured via HMAC SHA256 signature verification).
- **Cron Endpoints**: `POST /api/cron/recurring-invoices` (Secured via Bearer `CRON_SECRET`).
- **Internal APIs**: Guarded by NextAuth sessions and strict `user.role === "admin"` checks where necessary.

### Project Structure Conventions
The codebase follows standard Next.js App Router patterns, strictly separating authenticated and public scopes:
```text
src/
├── app/
│   ├── (dashboard)/   # Guarded admin views (Clients, Projects, Settings)
│   ├── (public)/      # Client-facing static/dynamic views (e.g., /invoices/[id])
│   ├── api/           # Backend REST endpoints, Cron Jobs, Webhook receivers
├── components/        # UI building blocks (Shadcn UI, Radix primitives, custom widgets)
├── emails/            # React Email templates (.tsx) rendered to HTML before SMTP delivery
└── lib/               # Utility libraries (Crypto, Auth, Prisma Client, Math)
prisma/                # Database schema, migrations, and seed scripts
```

### Deployment Architecture
- **Web Tier**: Designed to run optimally on **Vercel** or standard Node.js server environments (e.g., Docker `node:alpine`).
- **Database/Storage**: Uses **PostgreSQL** (can be hosted on Supabase, Neon, or self-hosted via `docker-compose.yml`).
- **Backup**: Ships with a ready-to-use Docker sidecar (`prodrigestivill/postgres-backup-local`) to automate daily cron `.sql.gz` backups.

### Security & Scaling Notes
- **API Key Storage**: Sensitive keys (SMTP password, Mayar) are symmetrically encrypted at rest (AES-256-GCM) via a custom `crypto.ts` module.
- **XSS Prevention**: Markdown rendering (Terms, projects) uses `rehype-sanitize` to strip script tags.
- **Rate Limiting**: Custom IP-based rate limiting on Cron/Webhook endpoints.
- **Cache Strategy**: Heavy utilisation of Next.js declarative caching (`revalidatePath()`) allowing efficient real-time polling sync with webhooks without crushing DB performance.
- **Idempotency**: Webhook parsing and Cron runner use strict DB state gating (`status === "unpaid"`) combined with `prisma.$transaction()` to avoid race conditions.
