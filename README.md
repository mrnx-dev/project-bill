<p align="center">
  <h1 align="center">📄 ProjectBill</h1>
  <p align="center">
    Self-hosted invoicing & project tracking for freelancers and small agencies.
    <br />
    <em>Manage clients, track projects on a Kanban board, send invoices, accept online payments — all in one place.</em>
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-18-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
</p>

---

## ✨ Features

### Core
- **Client Management** — Add, edit, archive, and soft-delete clients
- **Project Tracking** — Kanban board (Prospect → In Progress → Done) with drag-and-drop
- **Invoicing Engine** — Auto-generate Down Payment (DP) and Full Payment invoices with sequential numbering (`INV-YYYYMM-XXXX`)
- **Recurring Invoices** — Set up weekly / monthly / yearly retainer billing with an automated cron engine

### Payments & Finance
- **Online Payments** — Integrated with [Mayar.id](https://mayar.id) for real-time IDR payments
- **Webhook Sync** — Automatic paid status updates via HMAC-verified webhooks
- **Tax Support** — Per-project flexible tax (PPN, VAT, etc.) with auto-calculated amounts
- **Financial Locks** — DP amounts & scope items lock after first invoice to prevent tampering
- **Cost Estimator** — Built-in man-hours calculator with risk buffer to generate scope items

### Documents & Communication
- **PDF Generation** — Print-ready A4 invoices via CSS `@media print`
- **Digital Contracts (SOW)** — Markdown-based terms with mandatory scroll-to-bottom acceptance, digital signature audit trails
- **Email System** — Beautiful bilingual React Email templates (ID/EN) via [Resend](https://resend.com)
- **In-App Notifications** — Bell icon with real-time polling, full notification history page

### Security & Administration
- **Authentication** — NextAuth (Auth.js) v5 with protected routes
- **Role-Based Access** — Admin & Staff roles with granular API/UI guards
- **API Key Encryption** — AES-256-GCM at-rest encryption for sensitive credentials
- **XSS Protection** — All Markdown rendering sanitized via `rehype-sanitize`
- **Rate Limiting** — IP-based rate limiting on webhook & cron endpoints
- **Audit Logging** — Compliance-grade logging for financial & sensitive operations
- **Error Monitoring** — Opt-in Sentry/GlitchTip integration

### User Experience
- **Dark Mode** — Full light/dark theme support with Shadcn UI Charts
- **Mobile-First** — Responsive layouts with swipeable sidebar navigation
- **Bilingual** — Per-project language toggle (Indonesian / English) for invoices, SOWs, emails
- **Onboarding Wizard** — Guided first-run setup to configure company profile, integrations, and first client/project
- **Company Branding** — Custom logo, company name, address, WhatsApp on all documents

---

## 🏗️ Architecture

ProjectBill follows a **monolithic Next.js architecture** using the App Router for both frontend and backend.

```
src/
├── app/
│   ├── (dashboard)/   # Protected admin views (Clients, Projects, Settings, etc.)
│   ├── (public)/      # Client-facing views (Invoice, SOW)
│   └── api/           # REST endpoints, Webhooks, Cron jobs
├── components/        # Shadcn UI + custom components
├── emails/            # React Email templates (.tsx)
└── lib/               # Utilities (Auth, Crypto, Prisma, Mayar, etc.)
prisma/                # Database schema & seed scripts
```

```mermaid
graph LR
    A[Admin Dashboard] -->|Server Actions / REST| B(Next.js App Router)
    C[Public Invoice View] -->|Server Actions| B
    B --> D[PostgreSQL via Prisma]
    B --> E[Resend Email API]
    B --> F[Mayar.id Payments]
    F -->|Webhook| B
    G[External Cron] -->|Daily Trigger| B
```

---

## 🚀 Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 20.0.0 |
| PostgreSQL | 15+ |
| Docker *(optional)* | Latest |

### Option 1: Docker (Recommended)

The fastest way to run ProjectBill.

**1. Clone the repository**

```bash
git clone https://github.com/your-username/project-bill.git
cd project-bill
```

**2. Create your environment file**

```bash
cp .env.example .env    # or create .env manually
```

Add the following required variables to `.env`:

```env
# === REQUIRED ===
DATABASE_URL="postgresql://projectbill_user:projectbill_password@db:5432/projectbill_db"
AUTH_SECRET="your-random-secret-string"       # Run: openssl rand -base64 32
ENCRYPTION_KEY="your-64-char-hex-string"      # Run: openssl rand -hex 32

# === OPTIONAL ===
APP_URL="https://your-domain.com"             # Default: http://localhost:3000
CRON_SECRET="your-cron-bearer-token"          # For recurring invoice automation
SENTRY_DSN=""                                 # Sentry/GlitchTip error tracking (leave empty to disable)

# Docker Compose Postgres (defaults are fine for local dev)
POSTGRES_USER="projectbill_user"
POSTGRES_PASSWORD="projectbill_password"
POSTGRES_DB="projectbill_db"
```

> **Note:** API keys for Resend (email) and Mayar (payments) are configured in-app via the Settings page after setup.

**3. Start the application**

```bash
docker compose up -d
```

**4. Open the setup wizard**

Navigate to [http://localhost:3000/setup](http://localhost:3000/setup) to create your admin account and configure company settings.

---

### Option 2: Manual Setup

**1. Clone and install dependencies**

```bash
git clone https://github.com/your-username/project-bill.git
cd project-bill
npm install
```

**2. Configure environment variables**

Create a `.env` file at the project root with the variables listed above. Update `DATABASE_URL` to point to your PostgreSQL instance:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/projectbill_db"
```

**3. Initialize the database**

```bash
npx prisma db push
```

**4. Start the development server**

```bash
npm run dev
```

**5. Open the setup wizard**

Navigate to [http://localhost:3000/setup](http://localhost:3000/setup) to create your admin account.

---

## ⚙️ Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | NextAuth session encryption key |
| `ENCRYPTION_KEY` | ✅ | 64-char hex key for API key encryption (AES-256-GCM) |
| `APP_URL` | ❌ | Public base URL (default: `http://localhost:3000`) |
| `CRON_SECRET` | ❌ | Bearer token for cron endpoint authorization |
| `SENTRY_DSN` | ❌ | Error tracking DSN (Sentry or GlitchTip) |
| `AUTH_TRUST_HOST` | ❌ | Set to `true` when behind a reverse proxy |

---

## 🧰 Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Start production server (auto-runs `prisma db push`) |
| `npm test` | Run Jest unit tests |
| `npm run test:e2e` | Run Playwright end-to-end tests |
| `npm run test:seed` | Seed test user for E2E tests |
| `npm run reset-password <email> <newPassword>` | Emergency CLI password reset |

---

## 🔄 Recurring Invoices (Cron Setup)

To enable automated recurring invoice generation, set up an external cron job to call the endpoint **daily**:

```bash
# Example: cURL with Bearer token
curl -X POST https://your-domain.com/api/cron/recurring-invoices \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Recommended services:** [cron-job.org](https://cron-job.org), Vercel Cron, or a system crontab.

---

## 📦 Database Backups (Optional)

Uncomment the `db-backup` service in `docker-compose.yml` to enable automatic daily PostgreSQL backups:

```yaml
db-backup:
  image: prodrigestivill/postgres-backup-local:18
  # ... (pre-configured in docker-compose.yml)
```

**Retention policy:** 7 daily / 4 weekly / 6 monthly backups.

> Skip this if using a managed database (Supabase, Neon, etc.) that handles backups for you.

---

## 🧪 Testing

ProjectBill includes both unit and end-to-end tests:

- **Unit Tests (Jest)** — Webhook signature verification, financial calculations, IDR formatting
- **E2E Tests (Playwright)** — Full business journey: Login → Create Client → Create Project → Generate Invoice

```bash
# Run all unit tests
npm test

# Run E2E tests (requires dev server running on :3000)
npm run test:e2e
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router) |
| **Language** | [TypeScript 5](https://www.typescriptlang.org) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com) + [Shadcn UI](https://ui.shadcn.com) |
| **Database** | [PostgreSQL 18](https://www.postgresql.org) |
| **ORM** | [Prisma 7](https://www.prisma.io) |
| **Auth** | [Auth.js (NextAuth v5)](https://authjs.dev) |
| **Email** | [React Email](https://react.email) + [Resend](https://resend.com) |
| **Payments** | [Mayar.id](https://mayar.id) Headless API |
| **Charts** | [Recharts](https://recharts.org) via Shadcn UI Charts |
| **Error Tracking** | [Sentry](https://sentry.io) / [GlitchTip](https://glitchtip.com) (opt-in) |
| **Container** | [Docker](https://www.docker.com) + Docker Compose |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ for freelancers and small agencies
</p>
