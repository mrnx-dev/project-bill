# PRD: Organization RBAC & Security

> Version: 1.3 | Author: Naya | Date: 2026-05-18
> Changelog:
> - v1.1 — Added FR-6 (critical auth/scoping fixes), FR-7 (invoice status protection), FR-8 (org switch persistence), FR-9 (notification scoping), extended permission matrix
> - v1.2 — Added FR-10 (system context / cron-webhook exemption), FR-11 (invoice status standardization), FR-12 (client portal payment separation), FR-13 (server actions auth fix). Updated FR-6 (pay endpoint split), FR-7 (void endpoint), FR-8 (create org persistence).
> - v1.3 — Added Phase Plan (section 7), Fix: Mayar webhook status validation + cancelAtPeriodEnd clarification + getAuthContext specs + migration scripts section (section 9). Updated FR-7 (strip cancelAtPeriodEnd, use notes instead), FR-10 (getAuthContext prioritization), FR-11 (Mayar webhook transition validation).

## 1. Executive Summary

ProjectBill currently lacks centralized role-based access control. Every API route manually checks `membership.role` with inline if/else, MEMBER users can perform all data operations including financial final-state actions (mark paid) and org admin actions (settings, billing), and there is no shared utility enforcing org-scoped data queries—risking cross-org data leaks. Additionally, several critical routes have zero authentication, zero org-scoping, or mass-assignment vulnerabilities. The org switch is not persisted to the database, causing users to revert to their default org on re-login. Notifications are org-scoped only, causing cross-user interference. System-level operations (cron jobs, webhooks) run without user sessions and will break if RBAC is applied without exemption. The client portal payment flow is unauthenticated by design. Server Actions contain cross-org data leaks. Invoice status is a plain string with no transition rules or standardization. This PRD introduces: a centralized RBAC system (`requireOrgRole()`), a permission matrix enforcement layer, an org-scoping query helper, role-based UI visibility, invoice status protection and standardization, critical auth/scoping emergency fixes, a dedicated Organization Settings page, org switch persistence, notification user-scoping, system context exemptions for cron/webhook, client portal payment flow separation, and server actions auth fixes.

## 2. Problem Statement

**Current pain points:**

1. **Permission leak:** MEMBER users can create, edit, and delete invoices, clients, and projects—and critically, mark invoices as paid/sent, change company settings, and manage email config—without any role restriction. The only role-checked operations are org management (members, invites, deletion). All other write endpoints only check `organizationId`, not role.

2. **No centralized RBAC:** Every route handler duplicates role-check logic inline (`const membership = await...; if (membership.role !== 'OWNER') return 403`). Missing a check on even one route exposes a permission vulnerability. There is no `requireOrgRole()` helper that can be reused across all routes.

3. **Cross-org data leak risk:** Every route manually constructs `where: { organizationId: session.user.activeOrganizationId! }`. If a developer forgets the filter on a new route, cross-org data becomes accessible. Some routes already have missing orgId filters (recurring invoices GET, SOW templates GET, SSE events stream, countUnpaidInvoices, checkInvoiceStatus).

4. **No role-based UI visibility:** Sidebar navigation shows Team, Subscription, and Settings links to all roles—including MEMBER. The API blocks non-owners, but the UI doesn't hide or disable these nav items, creating a confusing "click then see error" experience.

5. **No Organization Settings page:** Org metadata (name, logo, slug) and the danger zone (delete org) have no UI. The `PUT /api/organizations/[id]` API exists but is unreachable from the frontend. OWNER has no way to manage their org's identity.

6. **Critical unauthenticated routes:** `POST /api/invoices/[id]/pay` has zero authentication and zero org-scoping—anyone with an invoice ID can create external payment links. `/api/events` SSE stream has zero auth and broadcasts all orgs' events to all connected clients.

7. **Invoice status bypass:** `PATCH /api/invoices/[id]` accepts `status` in the body without role checks—MEMBER can set `status: "PAID"` directly, completely bypassing the mark-paid gate. PAID invoices can be changed back to DRAFT. DELETE on PAID invoices has no role or status guard. Invoice status is a plain String with no defined transitions or standardization.

8. **Mass assignment vulnerability:** `PUT /api/recurring-invoices/[id]` passes raw request body directly to Prisma—any field including `organizationId`, `nextRunAt`, `isActive` can be overwritten.

9. **Org switch not persisted:** Switching org only updates the JWT client-side. On re-login or new device, user reverts to their default org—not the last one they accessed. Creating a new org also does not persist `defaultOrganizationId`.

10. **Notification cross-user interference:** Notifications have `organizationId` but no `userId`—any member marking "mark all read" clears unread counts for all users in the org.

11. **System context conflicts:** 6 cron endpoints and 2 webhook endpoints run without user sessions (auth via CRON_SECRET or webhook signature). Applying `requireOrgRole()` would break all system-level operations. Cron recurring-invoices already calls `sendInvoiceEmail` (a Server Action requiring auth) which silently fails.

12. **Client portal payment flow:** `POST /api/invoices/[id]/pay` is called from the unauthenticated public invoice page (`/invoices/[id]`). Adding auth would break the client payment flow. The endpoint needs to remain accessible to unauthenticated clients while being protected from abuse.

13. **Server Action auth gaps:** `countUnpaidInvoices` Server Action has zero auth and queries cross-org. `checkInvoiceStatus` has optional auth and queries without org-scope when unauthenticated. Both leak cross-org data.

14. **Mayar webhook missing org-scope:** Webhook updates invoice to PAID with `where: { id: invoiceId, status: "UNPAID" }` — no `organizationId` filter. While webhook signature verification exists, the query should still be org-scoped for defense-in-depth.

15. **No VOID/cancel invoice flow:** Invoice statuses "VOID" and "CANCELLED" are not defined. No endpoint exists to void or cancel an invoice. PRD references this but the endpoint must be created.

**Who experiences this:**
- **OWNER/ADMIN** — Cannot manage org identity visually; must use API directly
- **MEMBER** — Sees nav items they can't access; can perform actions they shouldn't (mark paid, change settings, send emails, delete PAID invoices)
- **Developers** — Must remember to add role checks and org filters on every new route; error-prone
- **All users** — Org switch doesn't persist; notification read state is shared across org members
- **System** — Cron jobs and webhooks will break if RBAC is applied without exemption mechanism
- **Clients** — Payment flow could break if auth is added to the pay endpoint without separation

## 3. Goals & Success Metrics

| Goal Type | Description | KPI |
|-----------|-------------|-----|
| Security | MEMBER cannot access OWNER/ADMIN-only actions | Zero permission violations in manual testing |
| Security | No route can return cross-org data | Zero cross-org data leaks in testing |
| Security | No unauthenticated route can modify financial data | Zero unauthenticated financial mutations |
| Security | Invoice status cannot be changed via PATCH bypass | PATCH /api/invoices cannot alter status field |
| Security | No mass-assignment vulnerability in any route | All write routes whitelist allowed fields |
| Security | System operations (cron/webhook) continue working | Zero cron/webhook failures after RBAC rollout |
| Reliability | Client portal payment flow works without user auth | Client can pay invoice without login |
| Developer | RBAC is a one-line call, not boilerplate | `requireOrgRole('OWNER')` ≤ 1 line per route |
| UX | Nav items hidden for unauthorized roles | MEMBER never sees 403 from clicking nav |
| UX | OWNER can edit org name, logo, slug from UI | Org edit flow complete without API calls |
| UX | Last accessed org persists across logins | User returns to same org after re-login/new device |
| UX | Each user has their own notification feed | Mark-read only affects own notifications |

## 4. User Personas

- **Rina (OWNER):** Founder of a small agency. Created the org, manages billing, wants to rename the org and update logo without opening terminal. Works across multiple orgs and expects the app to remember which org she was last using. Frustrated that she can't see a dedicated org management page.

- **Dimas (ADMIN):** Project manager at the agency. Manages team members and day-to-day ops. Should be able to add/remove members and edit company settings, but shouldn't touch billing or delete the org. Needs to approve milestones and mark payments as received.

- **Sari (MEMBER):** Freelancer working on projects. Creates invoices and manages clients. Should NOT be able to mark invoices as paid, change company settings, access billing, send emails to clients, or delete invoices.

- **Client (External):** Receives invoice link via email, views invoice on public page, clicks Pay to create payment link and pay. No user account needed — authenticates via magic link/token from client portal.

- **System (Cron/Webhook):** Automated processes that run without user sessions. Recurring invoice generation, payment reminders, usage resets, trial downgrades, Mayar payment callbacks. Must continue working after RBAC is applied.

- **Developer (Dev):** Adds new API routes. Currently must remember to add role checks and org filters manually. Wants a one-liner that handles auth + role + scoping.

## 5. User Stories (Prioritized)

- **[P0]** As a OWNER, I want all MEMBER-restricted actions to be blocked server-side so that members cannot perform operations beyond their role.
- **[P0]** As a developer, I want a `requireOrgRole()` helper so that I can enforce role-based access in one line per route.
- **[P0]** As a developer, I want an org-scoping query helper so that every database query is automatically filtered by organization.
- **[P0]** As a user, I want no route to be accessible without authentication so that unauthenticated parties cannot access or modify my data.
- **[P0]** As a user, I want no route to return cross-org data so that my data is isolated from other organizations.
- **[P0]** As a system, I want cron jobs and webhooks to be exempt from user-session-based RBAC so that automated operations continue working.
- **[P0]** As a client, I want to pay my invoice from a public page without needing a user account so that the payment flow is seamless.
- **[P0]** As a MEMBER, I want unauthorized nav items to be hidden so that I don't see 403 errors from clicking them.
- **[P0]** As a user, I want invoice status to only be changeable through authorized endpoints so that financial records cannot be tampered with.
- **[P1]** As a OWNER, I want a `/settings/organization` page so that I can edit my org name, logo, and slug from the UI.
- **[P1]** As a OWNER, I want a danger zone in org settings so that I can delete my org with a confirmation flow.
- **[P1]** As a OWNER/ADMIN, I want to void a PAID invoice so that I can reverse a payment recorded in error.
- **[P1]** As a user, I want my last accessed org to persist so that I return to the same org when I log in again.
- **[P1]** As a user, I want my own notification feed so that marking notifications as read doesn't affect other org members.
- **[P1]** As a OWNER/ADMIN, I want to see role badges on nav items so that I know which features are role-gated.
- **[P2]** As a ADMIN, I want the org settings page to clearly show which sections I cannot access (billing, delete) so that I understand my permissions.

## 6. Functional Requirements

### FR-1: Centralized Role-Based Access Control (`requireOrgRole()`)

**Description:** A reusable server-side helper that verifies the authenticated user's role in their active organization and returns the membership record or throws a 403. Replaces all inline role-check boilerplate across API routes and server actions.

**Acceptance Criteria:**
- [ ] AC-1: `requireOrgRole(session, 'OWNER')` returns `{ membership, organizationId }` when the user is OWNER of the active org, throws `AuthError(403)` otherwise
- [ ] AC-2: `requireOrgRole(session, ['OWNER', 'ADMIN'])` supports array for multi-role acceptance
- [ ] AC-3: When user is not a member of the active org at all, throws `AuthError(403)` with message "Not a member of this organization"
- [ ] AC-4: When user's role is below the required level, throws `AuthError(403)` with message "Requires OWNER role" (or whichever role was required)
- [ ] AC-5: When session is unauthenticated, throws `AuthError(401)` — never reaches the role check
- [ ] AC-6: Helper extracts `activeOrganizationId` from session, queries `OrganizationMember` once, caches result for the request lifetime
- [ ] AC-7: All existing inline role checks in API routes are replaced with `requireOrgRole()` calls
- [ ] AC-8: Helper is exported from `src/lib/auth/org-rbac.ts`
- [ ] AC-9: `requireOrgRole()` works in both API route handlers and Server Actions (both use `auth()` session)

**Edge Cases:**
- User's membership was deleted between JWT issuance and API call → 403 with clear message
- User session has stale `activeOrganizationId` for a soft-deleted org → 403
- Multiple concurrent requests with same session → each resolves independently (no shared mutable state)
- `activeOrganizationId` is null/undefined in session → 401 redirect
- Server Action calling `requireOrgRole()` → same behavior as route handler, throws error that client catches

### FR-2: Permission Matrix Enforcement

**Description:** Define and enforce a clear permission matrix so that each role can only perform authorized actions. The matrix is the single source of truth for what each role can do.

**Permission Matrix:**

| Action | OWNER | ADMIN | MEMBER |
|--------|-------|-------|--------|
| Org management (name, logo, slug, delete) | ✅ | ❌ | ❌ |
| Team management (add/remove members, change roles) | ✅ | ✅ | ❌ |
| Billing & subscription (view, modify, checkout) | ✅ | ❌ | ❌ |
| Export org data | ✅ | ❌ | ❌ |
| Company settings (company info, bank, email config) | ✅ | ✅ | ❌ |
| Change invoice status (mark paid, void) | ✅ | ✅ | ❌ |
| Delete invoice | ✅ | ✅ | ❌ |
| Send invoice/receipt email | ✅ | ✅ | ❌ |
| Approve/unapprove milestone | ✅ | ✅ | ❌ |
| Recurring invoice create/edit/delete | ✅ | ✅ | ❌ |
| SOW template create/edit/delete | ✅ | ✅ | ❌ |
| View audit log | ✅ | ✅ | ❌ |
| Manage agent/AI config | ✅ | ✅ | ❌ |
| Create payment link (internal) | ✅ | ✅ | ❌ |
| Create/edit/delete invoice | ✅ | ✅ | ✅ |
| Create/edit/delete client | ✅ | ✅ | ✅ |
| Create/edit/delete project | ✅ | ✅ | ✅ |
| View dashboard, invoices, clients, projects | ✅ | ✅ | ✅ |
| View recurring invoices / SOW templates (read-only) | ✅ | ✅ | ✅ |
| View own notifications | ✅ | ✅ | ✅ |

**Note:** System context (cron, webhooks) is exempt from this matrix. See FR-10.

**Acceptance Criteria:**
- [ ] AC-1: Permission matrix is defined as a configuration object in `src/lib/auth/permissions.ts` — not hardcoded switch/case in routes
- [ ] AC-2: Each API route that performs a restricted action calls `requireOrgRole()` with the appropriate role(s)
- [ ] AC-3: MARK PAID: `PATCH /api/invoices/[id]/mark-paid` requires `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-4: INVOICE EMAIL STATUS: `sendInvoiceEmail` and `sendReceiptEmail` Server Actions require `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-5: SETTINGS: `GET/PUT /api/settings` requires `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-6: BILLING: `GET/PUT /api/subscription`, `POST /api/subscription/checkout`, `GET /api/subscription/check` require `requireOrgRole(session, 'OWNER')`
- [ ] AC-7: EXPORT: `POST /api/organizations/[id]/export`, `GET /api/organizations/[id]/export/status` require `requireOrgRole(session, 'OWNER')`
- [ ] AC-8: ORG DELETE: already requires OWNER — verify and add `requireOrgRole()` call
- [ ] AC-9: ORG UPDATE: `PUT /api/organizations/[id]` requires `requireOrgRole(session, 'OWNER')` (currently allows ADMIN — tighten to OWNER per matrix)
- [ ] AC-10: INVOICE CREATE/EDIT (status-safe): accessible to all roles — no `requireOrgRole()` needed beyond org membership
- [ ] AC-11: DELETE INVOICE: `DELETE /api/invoices/[id]` requires `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-12: RECURRING INVOICE CUD: `POST/PUT/DELETE /api/recurring-invoices` requires `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-13: SOW TEMPLATE CUD: `POST/PUT/DELETE /api/sow-templates` requires `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-14: MILESTONE APPROVE: `POST /api/projects/[id]/milestones/[milestoneId]/approve` requires `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-15: MILESTONE UNAPPROVE: `POST /api/projects/[id]/milestones/[milestoneId]/unapprove` requires `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-16: MILESTONE MARK-PAID: `POST /api/projects/[id]/milestones/[milestoneId]/mark-paid` requires `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-17: CREATE PAYMENT LINK (INTERNAL): `POST /api/invoices/[id]/create-payment-link` requires `requireOrgRole(session, ['OWNER', 'ADMIN'])` — new internal endpoint, see FR-12
- [ ] AC-18: AUDIT LOG: `GET /api/audit-logs` requires `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-19: AGENT CONFIG: `GET/PUT /api/agent/config` requires `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-20: TEAM VIEW: `GET /api/organizations/[id]/members`, `GET /api/organizations/[id]/invites` require `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-21: A runtime helper `canPerform(action: Permission, role: string): boolean` exists to check permissions from the matrix config

**Edge Cases:**
- MEMBER tries to mark invoice paid via direct API call → 403 with "Requires OWNER or ADMIN role"
- MEMBER tries to delete invoice via direct API call → 403
- MEMBER tries to send invoice email via Server Action → 403
- ADMIN tries to delete org → 403 with "Requires OWNER role"
- ADMIN tries to access billing → 403 with "Requires OWNER role"
- MEMBER tries to update settings → 403
- OWNER in Org A (as MEMBER in Org B) switches to Org B and tries billing → 403, because role is checked against active org
- Downgrade from ADMIN to MEMBER while session is active → next API call reads fresh role from DB, not JWT cache
- MEMBER can view recurring invoices / SOW templates (read-only) but cannot create/edit/delete them

### FR-3: Centralized Org-Scoping Query Helper

**Description:** A helper that wraps Prisma queries to automatically inject `organizationId` filtering, eliminating the risk of forgetting the filter and exposing cross-org data.

**Acceptance Criteria:**
- [ ] AC-1: `orgQuery(orgId, prismaModel)` returns a scoped query builder where `findMany`, `findFirst`, `create`, `update`, `delete` automatically include `where: { organizationId: orgId }`
- [ ] AC-2: For `create` operations, `organizationId` is automatically set in `data` if not provided
- [ ] AC-3: For `update`/`delete`, the helper verifies the target record belongs to `orgId` before proceeding — throws `AuthError(404)` if record not found in org (not 403, to avoid info leak)
- [ ] AC-4: Helper is exported from `src/lib/auth/org-scoping.ts`
- [ ] AC-5: All existing direct Prisma calls in API routes that should be org-scoped are migrated to use this helper (phased migration — add helper first, migrate routes incrementally)
- [ ] AC-6: The helper works with Prisma 7 client APIs and TypeScript types

**Edge Cases:**
- Query on a model that doesn't have `organizationId` (e.g., User) → helper throws dev-time error
- `orgId` is null/undefined → helper throws early, before Prisma call
- `create` with explicit `organizationId` that differs from `orgId` → helper overrides with `orgId` to prevent injection
- `update` on a record that belongs to another org → 404, not 403 (prevents information leakage about record existence)

### FR-4: Role-Based UI Visibility

**Description:** Sidebar navigation and page-level components hide or disable items that the current user's role cannot access, eliminating the "click then 403" experience.

**Acceptance Criteria:**
- [ ] AC-1: Sidebar nav items gated by permission: Team (OWNER/ADMIN), Subscription (OWNER), Organization (OWNER), SOW Templates (OWNER/ADMIN for CUD, MEMBER for view), Agent/AI (OWNER/ADMIN)
- [ ] AC-2: MEMBER does NOT see Subscription, Organization nav items
- [ ] AC-3: MEMBER sees Settings nav item but only sees personal tabs (profile, password), not company/org/billing/agent tabs
- [ ] AC-4: ADMIN sees Team and Settings > Company, but NOT Subscription, NOT Organization
- [ ] AC-5: OWNER sees all nav items
- [ ] AC-6: Nav items hidden (not disabled/greyed out) — no "visible but inaccessible" pattern
- [ ] AC-7: Role information passed from server layout to client components via existing server props pattern (no new API calls)
- [ ] AC-8: Direct URL access to gated pages (e.g., `/settings/organization` as MEMBER) → page shows "Access Denied" inline message with redirect link, not 403 API error
- [ ] AC-9: SOW Templates page: MEMBER can view (read-only) but CUD buttons are hidden
- [ ] AC-10: Recurring invoices page: MEMBER can view (read-only) but CUD buttons are hidden

**Edge Cases:**
- User has role change while app is open → nav reflects stale role until next `router.refresh()`. Acceptable; server-side `requireOrgRole()` is the true guard.
- MEMBER bookmarks `/settings/organization` URL → server component checks role, shows access denied inline
- Single-org OWNER sees all nav items (no regression from current behavior)
- Mobile viewport → hidden nav items still hidden in mobile menu

### FR-5: Organization Settings Page (`/settings/organization`)

**Description:** A dedicated page for org identity management—edit name, logo, slug, and a danger zone for org deletion. Accessible only to OWNER. Follows the same pattern as the existing `/settings/team` page.

**Acceptance Criteria:**
- [ ] AC-1: Route `/settings/organization` renders org settings form with fields: name (text), logo (URL text input with future upload support), slug (text, read-only initially with edit toggle)
- [ ] AC-2: Name field pre-filled with current org name, editable
- [ ] AC-3: Logo URL field pre-filled with current `logoUrl`, editable
- [ ] AC-4: Slug field displays current slug; edit requires confirmation dialog ("Changing slug may break shared links. Continue?")
- [ ] AC-5: Save button calls `PUT /api/organizations/[id]` with updated fields
- [ ] AC-6: Success toast on save; error toast on failure
- [ ] AC-7: Danger zone section at the bottom with "Delete Organization" button
- [ ] AC-8: Delete button opens confirmation dialog requiring user to type org name to confirm
- [ ] AC-9: Delete calls `POST /api/organizations/[id]/delete` (existing endpoint)
- [ ] AC-10: After deletion, user is redirected to `/onboarding/organization` (auto-switch to next org handled by existing layout logic)
- [ ] AC-11: Page shows org metadata: creation date, member count, current plan
- [ ] AC-12: Page is only accessible to OWNER — enforced by `requireOrgRole('OWNER')` in server component
- [ ] AC-13: Sidebar shows "Organization" nav item under Settings section (visible to OWNER only)

**Edge Cases:**
- Slug already taken by another org → API returns 409 → show error "Slug already in use"
- Name is empty string → client-side validation prevents save
- Logo URL is invalid → client-side validation warns but allows save (URL may become valid later)
- OWNER is last member and tries to delete → allowed (existing endpoint handles this)
- Two OWNERs — one deletes org while other is editing → other gets "org not found" on save, auto-redirected
- Slug contains special characters → client sanitizes to kebab-case before sending
- Name change doesn't auto-change slug → they are independent fields

### FR-6: Critical Auth & Org-Scoping Fixes

**Description:** Emergency-level fixes for routes that currently have zero authentication, zero org-scoping, or other critical security vulnerabilities. These are the most severe gaps in the codebase and must be fixed before any other RBAC work.

**Acceptance Criteria:**
- [ ] AC-1: `POST /api/invoices/[id]/pay` — RENAMED to `POST /api/invoices/[id]/create-payment-link`. Add `auth()` check, add org-scope, add `requireOrgRole(session, ['OWNER', 'ADMIN'])`. This is the internal endpoint for creating payment links. See FR-12 for the client-facing public endpoint.
- [ ] AC-2: `GET /api/events` SSE stream — add `auth()` check, filter emitted events by `organizationId` of the authenticated user's active org. Do NOT broadcast events from other orgs.
- [ ] AC-3: `GET /api/recurring-invoices` — add `where: { organizationId: orgId }` filter to the Prisma query (currently `where: {}` which returns all orgs' data)
- [ ] AC-4: `GET /api/sow-templates` — add `where: { organizationId: orgId }` filter to the Prisma query (currently `where: {}` which returns all orgs' data)
- [ ] AC-5: `PUT /api/recurring-invoices/[id]` — whitelist allowed fields: `name, amount, interval, intervalCount, nextRunAt, isActive, projectId, description, startNumber, prefix`. Do NOT pass raw JSON to Prisma. Explicitly reject `organizationId` in update data.
- [ ] AC-6: `POST /api/invoices/[id]/retry-email` — add `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-7: Verify all existing routes that have `auth()` but missing `organizationId` filter — fix any remaining cross-org leaks
- [ ] AC-8: `countUnpaidInvoices` Server Action — add `auth()` + org-scope filter `where: { organizationId: orgId }` (currently queries ALL orgs)
- [ ] AC-9: `checkInvoiceStatus` Server Action — make auth mandatory (remove optional path), add org-scope `where: { id, organizationId: orgId }`

**Edge Cases:**
- `/api/events` SSE: If Redis is used, events are published to a global `system_events` channel. Solution: encode `organizationId` in the event payload, and filter on the subscriber side per connected client's orgId. Do NOT create per-org Redis channels (scalability issue).
- `/api/events` SSE: Client connects, then user's session changes org via switch → SSE stream should close and client reconnects (handle in frontend)
- Recurring invoice PUT: Field whitelist must be validated server-side regardless of what the client sends

### FR-7: Invoice Status Protection

**Description:** Prevent invoice status from being changed through unauthorized means. Currently `PATCH /api/invoices/[id]` accepts `status` in the body, allowing any user to set any status including PAID. PAID invoices can also be deleted without restriction.

**Acceptance Criteria:**
- [ ] AC-1: `PATCH /api/invoices/[id]` — remove `status` from accepted fields. The only accepted fields for PATCH are `notes` and `dueDate`. `cancelAtPeriodEnd` is NOT a field on the Invoice model (it belongs to Subscription) and must be removed from the PATCH handler entirely. Status changes must go through dedicated endpoints only.
- [ ] AC-2: `DELETE /api/invoices/[id]` — add `requireOrgRole(session, ['OWNER', 'ADMIN'])` role check. OWNER and ADMIN can delete, MEMBER cannot.
- [ ] AC-3: `DELETE /api/invoices/[id]` — add status guard: invoices with status `PAID` cannot be deleted. Return 409 with message "Cannot delete a paid invoice. Void the invoice first." OWNER/ADMIN must void first.
- [ ] AC-4: `sendInvoiceEmail` Server Action — add `requireOrgRole(session, ['OWNER', 'ADMIN'])`. Only OWNER/ADMIN can send invoice emails to clients.
- [ ] AC-5: `sendReceiptEmail` Server Action — add `requireOrgRole(session, ['OWNER', 'ADMIN'])`. Only OWNER/ADMIN can send receipt emails.
- [ ] AC-6: Invoice status transition rules enforced: see FR-11 for the complete definition. `UNPAID → PAID` only via mark-paid endpoint or milestone mark-paid or Mayar webhook; `PAID → VOID` only via void endpoint; no arbitrary status changes.

**Edge Cases:**
- MEMBER tries `PATCH /api/invoices/[id]` with `{ status: "PAID" }` → the `status` field is silently ignored, only `cancelAtPeriodEnd` is processed. Return success with updated invoice (status unchanged).
- OWNER tries to delete a PAID invoice → 409 "Cannot delete a paid invoice. Void the invoice first."
- ADMIN tries to delete a DRAFT/UNPAID invoice → allowed (204)
- Recurring invoice auto-generates a PAID invoice → auto-generated PAID invoices follow same delete protection
- Milestone mark-paid sets invoice to PAID → this is the authorized path, requires OWNER/ADMIN (per FR-2 AC-16)
- Invoice is VOID → ADMIN/OWNER can delete it (VOID = already reversed, not a financial record)

### FR-8: Org Switch Persistence

**Description:** Persist the user's last accessed organization to the database so that on re-login or login from a new device, the user is placed in the same org they last used — not their first org or a random default.

**Acceptance Criteria:**
- [ ] AC-1: `POST /api/organizations/[id]/switch` — after successful membership verification, update `User.defaultOrganizationId` to the target org's id in the database
- [ ] AC-2: `auth.config.ts` JWT callback — when creating the JWT, read `defaultOrganizationId` from the User record in the database. If set, use it as `activeOrganizationId`. If null, fall back to the user's first OWNER membership (existing behavior).
- [ ] AC-3: `auth.config.ts` JWT callback — also set `activeOrganizationRole` from the membership record corresponding to `defaultOrganizationId`
- [ ] AC-4: Multi-device sync: User switches org on device A → DB updated → user logs in on device B → gets the same org
- [ ] AC-5: When a user's membership in their `defaultOrganizationId` org is removed, the JWT callback falls back to the next available org (existing layout.tsx auto-switch logic handles redirect)
- [ ] AC-6: When `defaultOrganizationId` points to a soft-deleted org, fall back to next available org
- [ ] AC-7: Org switch endpoint response includes updated org info so client can update session immediately without extra fetch
- [ ] AC-8: `POST /api/organizations` (new org creation) — after creating new org, update `User.defaultOrganizationId` to the new org's id in the database, so the user lands on the new org on re-login

**Edge Cases:**
- User has no memberships at all → `defaultOrganizationId` is null → redirect to onboarding
- User removed from their default org → fallback finds next membership; if none, redirect to onboarding
- Race condition: User switches org rapidly on two devices → last write wins; both devices converge on next login
- `defaultOrganizationId` references an org where user is now MEMBER (was OWNER when set) → JWT callback reads actual role from DB, sets correct `activeOrganizationRole`
- Fresh user (just signed up) → no `defaultOrganizationId` yet → onboarding creates org → sets `defaultOrganizationId`
- User created new org via OrgSwitcher → `defaultOrganizationId` auto-set to new org in DB (AC-8)

### FR-9: Notification User-Scoping

**Description:** Add `userId` to the Notification model so each user has their own notification feed. Currently notifications are org-scoped only, causing cross-user interference when one member marks all as read.

**Acceptance Criteria:**
- [ ] AC-1: Add `userId String?` field to Notification model in `prisma/schema.prisma`
- [ ] AC-2: Add `@@index([userId])` and `user User? @relation(fields: [userId], references: [id])` relation
- [ ] AC-3: Generate migration: `npx prisma migrate dev --name add_user_id_to_notifications`
- [ ] AC-4: `GET /api/notifications` — filter by `where: { organizationId: orgId, userId: session.user.id }` (return current user's notifications) UNION org-wide notifications `where: { organizationId: orgId, userId: null }`
- [ ] AC-5: `PATCH /api/notifications` (mark as read) — only mark notifications belonging to `session.user.id`
- [ ] AC-6: `PATCH /api/notifications` (mark all as read) — only mark current user's unread notifications
- [ ] AC-7: `createNotification()` helper — accept `userId` parameter and set it when creating notifications. If notification is org-wide (e.g., "org settings changed"), set `userId: null`.
- [ ] AC-8: Backfill existing notifications: set `userId: null` for all existing rows (they become org-wide notifications visible to all members)
- [ ] AC-9: For notifications with `userId: null`, all org members can see them; for notifications with a specific `userId`, only that user sees them
- [ ] AC-10: `/api/events` SSE: filter notifications emitted to user by userId match OR userId = null (org-wide)
- [ ] AC-11: Org-wide notifications (userId=null): `isRead` is per-row. When user A marks it as read, it becomes read for user B too. Acceptable for MVP. A `NotificationReadStatus` junction table can be added later for true per-user read tracking on org-wide notifs.

**Edge Cases:**
- Existing notifications without userId → backfill to `null` → visible to all, mark-read affects all (acceptable for legacy data during transition)
- Org-wide notification (userId=null) marked as read by user A → shows as read for user B too. Accepted limitation for MVP.
- Notification created with userId → only that user sees it in their feed and can mark it read

### FR-10: System Context — Cron & Webhook Exemption

**Description:** Cron jobs and webhook endpoints operate without user sessions (auth via CRON_SECRET or webhook signature). RBAC `requireOrgRole()` requires a user session and would break all system-level operations. This FR defines how system-context operations bypass user-level RBAC while maintaining org-scoping where possible.

**System-context routes:**

| Route | Auth Method | Current Issue | Fix |
|-------|-------------|---------------|-----|
| `GET /api/cron/recurring-invoices` | CRON_SECRET | Calls `sendInvoiceEmail` Server Action which requires auth → fails silently | Extract email logic to utility, cron calls utility directly (FR-13) |
| `GET /api/cron/reminders` | CRON_SECRET | Modifies financial data without user auth; no org-scope | Add org-scope queries; system context bypasses RBAC; status transition via `isValidTransition()` |
| `GET /api/cron/reset-usage` | CRON_SECRET | Resets all orgs' counters | No fix needed (operates across all orgs by design) |
| `GET /api/cron/purge-orgs` | CRON_SECRET | Hard-deletes soft-deleted orgs | No fix needed (operates across all orgs by design) |
| `GET /api/cron/check-trials` | CRON_SECRET | Downgrades expired trials | No fix needed (operates across all orgs by design) |
| `POST /api/webhooks/mayar` | Webhook signature | Updates invoice PAID without org-scope; can overwrite VOID | Add org-scope + `isValidTransition()` check (FR-11 AC-9/AC-10) |
| `POST /api/webhooks/mayar-subscription` | Webhook signature | Upgrades subscription by paymentId | Less risky, no fix needed (finds by specific paymentId) |

**Acceptance Criteria:**
- [ ] AC-1: `requireOrgRole()` checks for session before proceeding. If no session exists AND the request is authenticated via CRON_SECRET or webhook signature, skip RBAC check (system context). This is handled by a `getAuthContext()` helper that returns either `{ type: 'user', session, orgId, role }` or `{ type: 'system', authMethod: 'cron' | 'webhook', orgId?: string }`.
- [ ] AC-2: System-context routes do NOT call `requireOrgRole()`. They use `verifyCronSecret()` or `verifyWebhookSignature()` instead.
- [ ] AC-3: `GET /api/cron/recurring-invoices` — refactor to call extracted email utility instead of Server Action. See FR-13.
- [ ] AC-4: `GET /api/cron/reminders` — add org-scope to invoice queries: `where: { status: "UNPAID", organizationId: { not: null }, dueDate: { not: null } }`. While cron processes all orgs, each invoice should belong to a valid org.
- [ ] AC-5: `POST /api/webhooks/mayar` — add `organizationId` to invoice update query for defense-in-depth: first find invoice by ID, verify it has a valid `organizationId`, then update with `where: { id: invoiceId, organizationId: invoice.organizationId, status: "UNPAID" }`.
- [ ] AC-6: All system-context routes log `[SYSTEM_ACTION]` with authMethod, action, and affected orgId(s) for audit trail.
- [ ] AC-7: New routes for system context must use `getAuthContext()` to explicitly declare their auth type, preventing accidental omission of auth checks.

**Edge Cases:**
- Attacker guesses CRON_SECRET → can trigger any cron endpoint. Mitigation: CRON_SECRET must be strong and rotated. This is pre-existing.
- Webhook replay attack → Mayar webhook already uses signature verification. No change needed.
- Cron recurring-invoices processes org A's invoices but email fails for org A → error for that org should not block processing for org B. Already handled per-template try/catch.
- Cron reminder adds late fee → this is a financial mutation normally requiring OWNER/ADMIN. System context bypasses this by design. Log `[SYSTEM_ACTION]` for audit.

### FR-11: Invoice Status Standardization

**Description:** Define invoice statuses as explicit constants with valid transition rules. Currently `Invoice.status` is a plain String with no constraints — any value is accepted, and there is no VOID or CANCELLED status defined.

**Invoice Status Constants:**
```typescript
// src/lib/invoice-status.ts
export const INVOICE_STATUS = {
  DRAFT: "DRAFT",
  UNPAID: "UNPAID",
  PAID: "PAID",
  VOID: "VOID",
} as const;

export type InvoiceStatus = typeof INVOICE_STATUS[keyof typeof INVOICE_STATUS];

// Valid transitions
export const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT:  ["UNPAID"],
  UNPAID: ["PAID", "VOID"],
  PAID:   ["VOID"],
  VOID:   [],  // terminal state — no further transitions
};
```

**Acceptance Criteria:**
- [ ] AC-1: Invoice status constants defined in `src/lib/invoice-status.ts` with `INVOICE_STATUS` and `VALID_TRANSITIONS`
- [ ] AC-2: All code that reads/writes invoice status uses `INVOICE_STATUS` constants, not string literals
- [ ] AC-3: `PATCH /api/invoices/[id]/mark-paid` — validate transition: current status must be `UNPAID` before setting to `PAID`. If not, return 409 "Cannot mark paid: invoice status is {current}"
- [ ] AC-4: New endpoint `POST /api/invoices/[id]/void` — OWNER/ADMIN only. Validates transition: current status must be `PAID` or `UNPAID`. Sets status to `VOID`, records `voidedAt` timestamp (add field to Invoice model).
- [ ] AC-5: `DELETE /api/invoices/[id]` — allow deletion only for `DRAFT`, `UNPAID`, and `VOID` invoices. `PAID` invoices cannot be deleted (must void first).
- [ ] AC-6: Migration: existing invoices with status `"unpaid"` (lowercase) must be migrated to `"UNPAID"` (uppercase). Add migration script.
- [ ] AC-7: Migration: add `voidedAt DateTime?` field to Invoice model
- [ ] AC-8: All status changes (mark-paid, void, milestone mark-paid) validate against `VALID_TRANSITIONS`
- [ ] AC-9: `POST /api/webhooks/mayar` — after webhook signature verification, call `isValidTransition(invoice.status, INVOICE_STATUS.PAID)` before updating. If invoice is already PAID → return 200 (idempotent, skip update). If invoice is VOID → return 200 (skip, log warning `[WEBHOOK] Skipping PAID for VOID invoice id=X`).
- [ ] AC-10: `POST /api/webhooks/mayar` — update query uses org-scoped lookup: `where: { id: invoiceId, organizationId: invoice.organizationId, status: "UNPAID" }` for defense-in-depth
- [ ] AC-11: VOID invoices: `amount` is preserved (for audit), but invoice is no longer counted in financial totals/reports.

**Edge Cases:**
- Existing data has lowercase status values ("unpaid", "paid") → migration normalizes to uppercase ("UNPAID", "PAID")
- Mayar webhook marks invoice as PAID when it's already PAID → `VALID_TRANSITIONS` check fails → webhook returns 200 but skips update (idempotent)
- Invoice is VOID → webhook comes in trying to mark as PAID → rejected by transition rules
- Milestone approve creates invoice as UNPAID → then mark-paid sets to PAID → valid transition
- `voidedAt` is null for non-voided invoices → query `where: { voidedAt: null }` to exclude voided

### FR-12: Client Portal Payment Flow Separation

**Description:** The current `POST /api/invoices/[id]/pay` endpoint serves dual purpose: (1) internal users creating payment links, and (2) client portal users paying invoices. These must be separated to allow RBAC on the internal endpoint while keeping the client-facing endpoint accessible.

**Architecture:**
- **Internal endpoint:** `POST /api/invoices/[id]/create-payment-link` — requires auth + `requireOrgRole(['OWNER', 'ADMIN'])`. Used from dashboard UI when OWNER/ADMIN wants to generate a payment link for an invoice.
- **Public endpoint:** `POST /api/invoices/[id]/pay` — remains public (no `auth()`) but adds HMAC signature verification. Used from the client portal invoice page. The payment link URL includes a signed token that validates the request.

**Acceptance Criteria:**
- [ ] AC-1: Create new `POST /api/invoices/[id]/create-payment-link` route — requires `auth()`, org-scope, `requireOrgRole(session, ['OWNER', 'ADMIN'])`. Creates Mayar payment link and returns it. Marks `paymentLink` on invoice.
- [ ] AC-2: Keep `POST /api/invoices/[id]/pay` as public endpoint — remove `auth()` requirement but add HMAC signature verification using `INVOICE_HMAC_SECRET` env var
- [ ] AC-3: HMAC signature is generated when payment link is first created: `sign(invoiceId + orgId, INVOICE_HMAC_SECRET)`. The signature is included in the PayButton URL as a query param: `/api/invoices/[id}/pay?sig={hmac}`
- [ ] AC-4: `POST /api/invoices/[id]/pay` verifies the HMAC signature. If invalid, returns 403. If valid, creates Mayar payment link.
- [ ] AC-5: OrgSwitcher create org flow updated: dashboard invoice actions use `/create-payment-link` instead of `/pay`
- [ ] AC-6: Public invoice page `PayButton` uses `/pay?sig={hmac}` (signature embedded in the public page data from server)
- [ ] AC-7: If `INVOICE_HMAC_SECRET` is not set, `/pay` endpoint logs warning and falls back to no-signature mode (backward compatibility for self-hosted without env var). Log: `[WARN] INVOICE_HMAC_SECRET not set — payment endpoint unprotected`

**Edge Cases:**
- Client shares pay link URL with someone else → HMAC signature is in URL, so recipient can also pay. This is acceptable — the invoice is meant to be paid.
- HMAC secret is rotated → old signatures become invalid → existing unpaid invoices need new payment links generated. OWNER can regenerate from dashboard.
- `INVOICE_HMAC_SECRET` not set → fallback to no-signature mode, same as current behavior. Self-hosted users who don't set the env var are no worse off than today.
- Attacker guesses invoice ID but doesn't have HMAC sig → 403. Invoice ID alone is not enough.
- Payment link already exists (invoice.paymentLink is set) → `/pay` endpoint redirects to existing payment link instead of creating new one

### FR-13: Server Actions Auth Fix & Refactoring

**Description:** Server Actions that modify data or access sensitive information must have proper auth and role checks. The cron recurring-invoices route currently calls `sendInvoiceEmail` (a Server Action requiring auth) which silently fails because cron has no user session. Email sending logic must be extracted into a reusable utility.

**Acceptance Criteria:**
- [ ] AC-1: Extract email sending core logic from `sendInvoiceEmail` into `src/lib/email/send-invoice-email.ts` — a plain utility function that does NOT call `auth()`. Accepts `{ invoiceId, orgId, isAutoGenerated, customNotes }` parameters.
- [ ] AC-2: Extract email sending core logic from `sendReceiptEmail` into `src/lib/email/send-receipt-email.ts` — a plain utility function. Accepts `{ invoiceId, orgId }` parameters.
- [ ] AC-3: `sendInvoiceEmail` Server Action becomes a thin wrapper: calls `auth()`, `requireOrgRole(['OWNER', 'ADMIN'])`, then delegates to `sendInvoiceEmailUtil()`
- [ ] AC-4: `sendReceiptEmail` Server Action becomes a thin wrapper: calls `auth()`, `requireOrgRole(['OWNER', 'ADMIN'])`, then delegates to `sendReceiptEmailUtil()`
- [ ] AC-5: `GET /api/cron/recurring-invoices` — calls `sendInvoiceEmailUtil()` directly (not the Server Action), passing orgId from the recurring invoice template
- [ ] AC-6: `GET /api/cron/reminders` — ensure it calls email utility directly, not Server Action
- [ ] AC-7: `countUnpaidInvoices` Server Action — add `auth()`, add org-scope `where: { organizationId: orgId, status: "UNPAID" }`. Currently zero auth and queries cross-org.
- [ ] AC-8: `checkInvoiceStatus` Server Action — make auth mandatory, add org-scope. Remove the optional "no session" path that queries by invoice ID only.
- [ ] AC-9: Audit all remaining Server Actions for auth/role gaps. Every Server Action that modifies data or reads sensitive info must have `auth()` + org-scope at minimum.

**Edge Cases:**
- Cron calls `sendInvoiceEmailUtil()` → no `auth()` check, no role check → works because cron is system context
- User calls `sendInvoiceEmail` Server Action from dashboard → thin wrapper checks auth + role → delegates to utility → works
- `sendInvoiceEmailUtil()` is called by both cron and Server Action → same business logic, different auth entry points
- Cron email fails (e.g., SMTP error) → caught per-template, logged, doesn't block other orgs' processing
- `countUnpaidInvoices` returns 0 for org with no unpaid invoices → valid result

## 7. Phase Plan (Execution Order)

**Goal:** One clear dependency-ordered plan so implementation does not deadlock.

```
LEGEND
└── → depends on (must be done first)
```

```
PHASE 0 — SCHEMA & FOUNDATION (independent)
├── Schema migration: add voidedAt to Invoice            ─── MIG-3
├── Schema migration: add userId to Notification         ─── FR-9
├── Create: src/lib/invoice-status.ts (constants + transitions)  ─── FR-11
├── Create: src/lib/auth/org-rbac.ts (requireOrgRole, AuthError)  ─── FR-1
├── Create: src/lib/auth/org-scoping.ts (orgQuery)       ─── FR-3
├── Create: src/lib/auth/permissions.ts (PERMISSIONS + canPerform)  ─── FR-2
├── Create: src/lib/auth/hmac.ts (sign + verify)         ─── FR-12
└── Create: src/lib/email/send-invoice-email.ts (utility) ─── FR-13 AC-1
    └── Create: src/lib/email/send-receipt-email.ts (utility) ─── FR-13 AC-2

PHASE 1 — SYSTEM CONTEXT (cron/webhook must keep working FIRST)
├── Update: verifyCronSecret() in cron routes             ─── FR-10
├── Update: GET /api/cron/recurring-invoices              ─── FR-10 AC-3, FR-13 AC-5
│   └── Replace Server Action call with sendInvoiceEmailUtil()
├── Update: GET /api/cron/reminders                       ─── FR-10 AC-4
├── Update: POST /api/webhooks/mayar                      ─── FR-10 AC-5, FR-11 AC-9/AC-10
│   └── Add org-scope + isValidTransition() check
├── Update: countUnpaidInvoices Server Action             ─── FR-6 AC-8
├── Update: checkInvoiceStatus Server Action              ─── FR-6 AC-9
└── Run: MIG-1 (invoice status normalization)             ─── scripts/migrate-invoice-status.ts

PHASE 2 — RBAC HELPER DEPLOYMENT (add requireOrgRole to ALL routes)
├── Refactor: sendInvoiceEmail Server Action → wrapper    ─── FR-13 AC-3
├── Refactor: sendReceiptEmail Server Action → wrapper    ─── FR-13 AC-4
├── Update: PATCH /api/invoices/[id] (strip status)       ─── FR-7 AC-1
├── Update: DELETE /api/invoices/[id] (add role + status guard) ─── FR-7 AC-2/AC-3
├── Update: GET/PUT /api/settings (add requireOrgRole)    ─── FR-2 AC-5
├── Update: subscription routes (add requireOrgRole)      ─── FR-2 AC-6
├── Update: export routes (add requireOrgRole)            ─── FR-2 AC-7
├── Update: org routes (PUT, DELETE)                      ─── FR-2 AC-8/AC-9
├── Update: milestone approve/unapprove/mark-paid         ─── FR-2 AC-14/15/16
├── Update: recurring invoice CUD                         ─── FR-2 AC-12
├── Update: SOW template CUD                              ─── FR-2 AC-13
├── Update: audit log, agent config, team view            ─── FR-2 AC-18/19/20
└── Search: verify ALL remaining API routes + Server Actions    ─── FR-1 AC-7

PHASE 3 — CRITICAL SECURITY FIXES
├── Update: GET /api/recurring-invoices (add orgId filter) ─── FR-6 AC-3
├── Update: GET /api/sow-templates (add orgId filter)     ─── FR-6 AC-4
├── Update: PUT /api/recurring-invoices (field whitelist)  ─── FR-6 AC-5
├── Update: POST /api/invoices/[id]/retry-email           ─── FR-6 AC-6
├── Update: GET /api/events SSE (auth + org filter)       ─── FR-6 AC-2
├── Create: POST /api/invoices/[id]/create-payment-link   ─── FR-12 AC-1
│   └── Auth + requireOrgRole + Mayar payment link logic
├── Update: POST /api/invoices/[id]/pay (HMAC sig)        ─── FR-12 AC-2/3/4/7
└── Create: POST /api/invoices/[id]/void                  ─── FR-11 AC-4

PHASE 4 — ORG PERSISTENCE & SETTINGS UI
├── Update: POST /api/organizations/[id]/switch            ─── FR-8 AC-1
├── Update: POST /api/organizations (create)               ─── FR-8 AC-8
├── Update: auth.config.ts JWT callback                    ─── FR-8 AC-2/3
├── Create: /settings/organization page                    ─── FR-5
├── Update: sidebar nav items (role-based visibility)      ─── FR-4
└── Run: MIG-2 (notification userId backfill)              ─── FR-9

PHASE 5 — NOTIFICATION SCOPING (independent, can be last)
├── Schema + migration: add userId to Notification         ─── FR-9 AC-1/2/3
├── Update: GET /api/notifications (user-scoped filter)    ─── FR-9 AC-4
├── Update: PATCH /api/notifications (user-scoped mark)    ─── FR-9 AC-5/6
├── Update: createNotification() helper                    ─── FR-9 AC-7
└── Run: MIG-2 (backfill existing rows to userId=null)     ─── FR-9 AC-8
```

**Dependency summary:**
- Phase 0 (schema + new files) → ALL other phases depend on it
- Phase 1 (system context) → must be done before Phase 2 (so cron/webhook don't break when RBAC is added)
- Phase 2 (RBAC deploy) → depends on Phase 0 files existing
- Phase 3 (critical fixes) → can run parallel to Phase 2
- Phase 4 (org persistence + UI) → depends on Phase 2 RBAC helper for role checks
- Phase 5 (notification scoping) → independent, can run any time after Phase 0

**Phase 0 dependencies can be created in parallel:**
- `src/lib/invoice-status.ts` — no imports from other new files
- `src/lib/auth/org-rbac.ts` — no imports from other new files  
- `src/lib/auth/org-scoping.ts` — no imports from other new files
- `src/lib/auth/permissions.ts` — no imports from other new files
- `src/lib/auth/hmac.ts` — no imports from other new files
- `src/lib/email/send-invoice-email.ts` — no imports from other new files (extracted from existing Server Action)

## 8. Non-Functional Requirements

- **Performance:** `requireOrgRole()` must add ≤5ms overhead per request (single Prisma query by org+userId with compound unique index)
- **Security:** Org-scoping helper must prevent ALL cross-org data leaks — no route can return data from another org even with crafted parameters
- **Security:** Membership verification must always read from DB (not JWT), so role changes take effect on next API call
- **Security:** 404 (not 403) returned when a record doesn't belong to the user's org — prevents enumeration of other orgs' record IDs
- **Security:** All write routes must whitelist allowed fields — no raw request body passed to Prisma
- **Security:** SSE stream must not leak events from other organizations
- **Security:** No route that modifies financial data (create payment links, mark paid, approve milestones) may be accessible without authentication — except the client portal `/pay` endpoint which requires HMAC signature verification
- **Security:** HMAC signature for payment endpoint uses constant-time comparison to prevent timing attacks
- **Reliability:** Cron jobs and webhooks must continue working after RBAC is applied — system context is exempt from user-session RBAC
- **Accessibility:** Keyboard navigation to all org settings form fields; ARIA labels on danger zone
- **Platform:** Works with existing Next.js 16 App Router, Prisma 7, Auth.js v5, shadcn/ui
- **Backward compatibility:** Self-hosted mode behavior unchanged — RBAC still applies (MEMBER restrictions are valuable even in self-hosted)
- **Observability:** Every 403 from `requireOrgRole()` logs `[RBAC_DENY] userId=X orgId=Y requiredRole=Z actualRole=W action=ActionName`
- **Observability:** Every system-context action logs `[SYSTEM_ACTION] authMethod=X action=Y orgId=Z`

## 9. High-Level Architecture

### Tech Stack
- Server helper: `src/lib/auth/org-rbac.ts` — `requireOrgRole()`, `getAuthContext()`
- Permission config: `src/lib/auth/permissions.ts` — permission matrix definition + `canPerform()`
- Org-scoping helper: `src/lib/auth/org-scoping.ts` — `orgQuery()`
- Invoice status: `src/lib/invoice-status.ts` — `INVOICE_STATUS`, `VALID_TRANSITIONS`, `isValidTransition()`
- Email utilities: `src/lib/email/send-invoice-email.ts`, `src/lib/email/send-receipt-email.ts`
- HMAC utility: `src/lib/auth/hmac.ts` — `signInvoicePay()`, `verifyInvoicePaySig()`
- UI: shadcn/ui components (Card, Form, Dialog, Button, Input)
- Route: `/settings/organization` — Server Component + Client Component pattern (same as `/settings/team`)

### Key Integration Points
- `requireOrgRole()` replaces inline role checks in all existing API routes AND Server Actions
- `getAuthContext()` used by shared utilities to determine if request is user-context or system-context
- `orgQuery()` wraps Prisma calls for automatic org scoping
- Permission config drives both server-side `canPerform()` and client-side nav visibility
- `/settings/organization` page uses `PUT /api/organizations/[id]` (existing) and `POST /api/organizations/[id]/delete` (existing)
- Server layout passes `activeOrganizationRole` to client components for nav gating (existing session field)
- Org switch endpoint + org creation endpoint update `User.defaultOrganizationId` in DB
- `auth.config.ts` JWT callback reads `defaultOrganizationId` from DB on sign-in
- Cron routes call email/reminder utilities directly, not Server Actions
- Client portal `/pay` uses HMAC signature; dashboard uses `/create-payment-link` with auth

### Data Model Changes

**Schema Change 1: Notification model — add `userId`**
```prisma
model Notification {
  id             String       @id @default(uuid())
  title          String
  message        String
  type           String
  isRead         Boolean      @default(false)
  linkUrl        String?
  organizationId String
  userId         String?       // NEW: null = org-wide, specific = user-scoped
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  organization   Organization  @relation(fields: [organizationId], references: [id])
  user           User?         @relation(fields: [userId], references: [id])  // NEW

  @@index([organizationId])
  @@index([userId])           // NEW
}
```

**Schema Change 2: Invoice model — add `voidedAt`**
```prisma
model Invoice {
  // ... existing fields ...
  voidedAt       DateTime?    // NEW: timestamp when invoice was voided
  // ... existing fields ...
}
```

**Schema Change 3: User model — `defaultOrganizationId` already exists**
The `User.defaultOrganizationId` field already exists in the schema. Current usage: set during onboarding. New usage: updated on every org switch and org creation, read on JWT creation to set `activeOrganizationId`.

**No other schema changes required.**

### Permission Matrix Config Shape
```typescript
// src/lib/auth/permissions.ts
export const PERMISSIONS = {
  org_manage:            ['OWNER'],
  team_manage:           ['OWNER', 'ADMIN'],
  billing:               ['OWNER'],
  export:                ['OWNER'],
  settings:              ['OWNER', 'ADMIN'],
  mark_paid:             ['OWNER', 'ADMIN'],
  change_invoice_status: ['OWNER', 'ADMIN'],
  void_invoice:          ['OWNER', 'ADMIN'],
  delete_invoice:        ['OWNER', 'ADMIN'],
  send_email:            ['OWNER', 'ADMIN'],
  milestone_approve:     ['OWNER', 'ADMIN'],
  recurring_invoice_cud: ['OWNER', 'ADMIN'],
  sow_template_cud:      ['OWNER', 'ADMIN'],
  view_audit_log:        ['OWNER', 'ADMIN'],
  agent_config:          ['OWNER', 'ADMIN'],
  create_payment_link:   ['OWNER', 'ADMIN'],
  invoice_crud:          ['OWNER', 'ADMIN', 'MEMBER'],
  client_crud:           ['OWNER', 'ADMIN', 'MEMBER'],
  project_crud:          ['OWNER', 'ADMIN', 'MEMBER'],
  dashboard_view:        ['OWNER', 'ADMIN', 'MEMBER'],
  view_recurring:        ['OWNER', 'ADMIN', 'MEMBER'],
  view_sow_template:     ['OWNER', 'ADMIN', 'MEMBER'],
  view_own_notifications:['OWNER', 'ADMIN', 'MEMBER'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function canPerform(permission: Permission, role: string): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}
```

### `requireOrgRole()` & `getAuthContext()` Shape
```typescript
// src/lib/auth/org-rbac.ts
export class AuthError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

export type AuthContext =
  | { type: 'user'; session: Session; orgId: string; role: string; membership: OrganizationMember }
  | { type: 'system'; authMethod: 'cron' | 'webhook'; orgId?: string };

export async function requireOrgRole(
  session: Session | null,
  requiredRoles: string | string[]
): Promise<{ membership: OrganizationMember; organizationId: string }> {
  // 1. If no session → throw AuthError(401, "Unauthorized")
  // 2. Extract activeOrganizationId from session
  // 3. If null → throw AuthError(401, "No active organization")
  // 4. Query OrganizationMember where { userId, organizationId }
  // 5. If not found → throw AuthError(403, "Not a member of this organization")
  // 6. If role not in requiredRoles → throw AuthError(403, "Requires X role")
  // 7. Return { membership, organizationId }
}

export async function getAuthContext(request: Request): Promise<AuthContext> {
  // PRIORITY 1: user session always wins (user context can coexist with CRON_SECRET headers)
  const session = await auth();
  if (session?.user?.id) {
    const orgId = session.user.activeOrganizationId!;
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } },
    });
    if (!membership) throw new AuthError(403, "Not a member of this organization");
    return { type: 'user', session, orgId, role: membership.role, membership };
  }

  // PRIORITY 2: CRON_SECRET header
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    const url = new URL(request.url);
    return { type: 'system', authMethod: 'cron', orgId: url.searchParams.get('orgId') ?? undefined };
  }

  // PRIORITY 3: webhook path detection + signature verification
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/webhooks/')) {
    // Delegate to specific webhook verifier (each webhook has its own signature logic)
    return { type: 'system', authMethod: 'webhook', orgId: undefined };
  }

  // No valid auth found
  throw new AuthError(401, "Unauthorized");
}
```

### Invoice Status Constants Shape
```typescript
// src/lib/invoice-status.ts
export const INVOICE_STATUS = {
  DRAFT:  "DRAFT",
  UNPAID: "UNPAID",
  PAID:   "PAID",
  VOID:   "VOID",
} as const;

export type InvoiceStatus = typeof INVOICE_STATUS[keyof typeof INVOICE_STATUS];

export const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT:  ["UNPAID"],
  UNPAID: ["PAID", "VOID"],
  PAID:   ["VOID"],
  VOID:   [],  // terminal state
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
```

### Client Portal Payment HMAC Shape
```typescript
// src/lib/auth/hmac.ts
import { createHmac, timingSafeEqual } from 'crypto';

const HMAC_ALGORITHM = 'sha256';

export function signInvoicePay(invoiceId: string, orgId: string): string {
  const secret = process.env.INVOICE_HMAC_SECRET;
  if (!secret) return '';
  return createHmac(HMAC_ALGORITHM, secret).update(`${invoiceId}:${orgId}`).digest('hex');
}

export function verifyInvoicePaySig(invoiceId: string, orgId: string, sig: string): boolean {
  const secret = process.env.INVOICE_HMAC_SECRET;
  if (!secret) return true; // fallback: no secret = no verification
  const expected = createHmac(HMAC_ALGORITHM, secret).update(`${invoiceId}:${orgId}`).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
```

## 9. Migration Scripts

### MIG-1: Invoice Status Normalization (lowercase → uppercase)

**Purpose:** Existing data has `"unpaid"` and `"paid"` (lowercase). PRD requires `"UNPAID"` and `"PAID"` (uppercase). New values `"DRAFT"`, `"VOID"` are introduced.

**Script:** `scripts/migrate-invoice-status.ts`
```typescript
import { prisma } from "@/lib/prisma";

async function migrate() {
  console.log("[MIGRATE] Normalizing invoice status to uppercase...");

  // Step 1: lowercase → uppercase
  const [unpaid, paid] = await Promise.all([
    prisma.invoice.updateMany({
      where: { status: "unpaid" },
      data: { status: "UNPAID" },
    }),
    prisma.invoice.updateMany({
      where: { status: "paid" },
      data: { status: "PAID" },
    }),
  ]);
  console.log(`  → ${unpaid.count} invoices: unpaid → UNPAID`);
  console.log(`  → ${paid.count} invoices: paid → PAID`);

  // Step 2: any remaining unrecognized statuses → set to UNPAID (safe default)
  const remaining = await prisma.invoice.count({
    where: { status: { notIn: ["UNPAID", "PAID", "DRAFT", "VOID"] } },
  });
  if (remaining > 0) {
    const result = await prisma.invoice.updateMany({
      where: { status: { notIn: ["UNPAID", "PAID", "DRAFT", "VOID"] } },
      data: { status: "UNPAID" },
    });
    console.log(`  → ${result.count} unrecognized statuses → UNPAID`);
  }

  console.log("[MIGRATE] Done.");
}

migrate().catch(console.error);
```

**Rollback:** Reverse the update (but data may have already changed state). Acceptable risk — status normalization is one-time correction.

### MIG-2: Notification UserId Backfill

**Purpose:** Existing Notification rows have no `userId`. All become org-wide notifications (`userId: null`).

**Script:** Run after schema migration `add_user_id_to_notifications` is applied.
```typescript
import { prisma } from "@/lib/prisma";

async function migrate() {
  console.log("[MIGRATE] Backfilling notification userId to null...");
  const result = await prisma.notification.updateMany({
    where: { userId: null },
    data: { userId: undefined },  // stays null — Prisma ignores undefined on optional fields
  });
  console.log(`  → ${result.count} notifications: already null (no-op)`);
  console.log("[MIGRATE] Done. No changes needed — new field defaults to null.");
}
```

**Note:** This is a no-op migration if schema already defaults to `null`. Included for completeness and runbook consistency.

### MIG-3: Invoice VoidedAt Field

**Purpose:** Add `voidedAt DateTime?` to Invoice model. New field defaults to null. No data backfill needed.

**Run via Prisma:**
```bash
npx prisma migrate dev --name add_voided_at_to_invoice
```

**Rollback:** `npx prisma migrate down` or revert migration file.

### Acceptance Criteria
- [ ] MIG-1: All lowercase status values (`"unpaid"`, `"paid"`) are normalized to uppercase (`"UNPAID"`, `"PAID"`)
- [ ] MIG-1: Any unrecognized status values are set to `"UNPAID"` (safe default)
- [ ] MIG-1: Script is idempotent (running twice should not cause errors)
- [ ] MIG-2: Existing Notification rows keep `userId: null` (no data loss)
- [ ] MIG-3: `voidedAt` field exists on Invoice, defaults to null

## 10. Constraints & Assumptions

- **No new roles:** OWNER/ADMIN/MEMBER is sufficient for small agencies. VIEWER role is out of scope.
- **Schema changes:** Three schema changes required: (1) add `userId` to Notification model, (2) add `voidedAt` to Invoice model, (3) User model already has `defaultOrganizationId` (no migration needed, just new usage).
- **Role reads from DB:** `requireOrgRole()` always queries the database for current role, not JWT. This means role changes take effect on the very next API call, even if the JWT hasn't refreshed.
- **Phased migration:** Org-scoping helper added first, routes migrated incrementally. `requireOrgRole()` can be applied to all routes in one pass since it's a direct replacement for existing inline checks.
- **Self-hosted mode:** RBAC still applies. Even with one user, the role system works (single OWNER). No special bypass.
- **Existing API contracts:** `PUT /api/organizations/[id]` currently allows ADMIN — this PRD tightens it to OWNER only.
- **SSE filtering approach:** Filter on subscriber side (not Redis channel splitting) to maintain scalability.
- **Notification MVP approach:** For org-wide notifications (userId=null), `isRead` is a simple boolean per row. Mark-read by one user affects all. A `NotificationReadStatus` junction table can be added later for true per-user tracking. Accepted for MVP.
- **Client portal payment:** HMAC signature is optional (backward compatible). Self-hosted users who don't set `INVOICE_HMAC_SECRET` fall back to current behavior (no signature check).
- **Cron exemption:** System-context routes are explicitly exempt from `requireOrgRole()`. They use `CRON_SECRET` or webhook signatures. This is by design — these operations run without user sessions.
- **Invoice status migration:** Existing lowercase status values ("unpaid", "paid") must be normalized to uppercase in a migration. New status values (DRAFT, VOID) are introduced.

## 11. Out of Scope (This PRD)

1. **VIEWER role** — not needed for small agencies; defer until user demand
2. **Custom permission per user** — matrix is role-based, not per-user overrides
3. **Permission audit trail logging** — full audit trail of permission checks is future work (RBAC deny logging is in NFRs)
4. **Org-scoping auto-migration for ALL existing routes** — helper is created, high-risk routes migrated, but low-risk read-only routes can be migrated later
5. **Rate limiting on 403 responses** — standard API rate limiting is separate concern
6. **Owner transfer flow** — deferred to future batch
7. **Invite revocation** — deferred to future batch
8. **Client portal auth rewrite** — `/api/client-portal/auth/*` routes are public by design. Token validation improvements are noted but deferred.
9. **NotificationReadStatus junction table** — per-user read tracking on org-wide notifications. Can be added later if needed.
10. **Export download route** — the `downloadUrl` 404 issue is a separate bug, not RBAC-related
11. **CRON_SECRET rotation mechanism** — secret management is a separate concern

## 12. Success Criteria

- [ ] `requireOrgRole()` is used in ALL API routes AND Server Actions that perform restricted actions — zero inline role checks remain
- [ ] MEMBER receives 403 when attempting to mark invoice paid/sent, change company settings, access billing, delete org, delete invoices, send emails, approve milestones, CRUD recurring invoices, CRUD SOW templates
- [ ] ADMIN receives 403 when attempting to access billing, delete org, or change org name/logo/slug
- [ ] OWNER can perform all actions listed in the permission matrix
- [ ] No API route returns data from a different organization than `activeOrganizationId`
- [ ] `POST /api/invoices/[id]/create-payment-link` requires authentication and OWNER/ADMIN role
- [ ] `POST /api/invoices/[id]/pay` remains public with HMAC signature verification
- [ ] `/api/events` SSE stream requires authentication and only emits events for the user's active org
- [ ] `GET /api/recurring-invoices` and `GET /api/sow-templates` return only org-scoped data
- [ ] `PUT /api/recurring-invoices/[id]` whitelists update fields — no mass assignment possible
- [ ] `PATCH /api/invoices/[id]` cannot change invoice status — status field is stripped
- [ ] `DELETE /api/invoices/[id]` requires OWNER/ADMIN and blocks deletion of PAID invoices
- [ ] `POST /api/invoices/[id]/void` exists and requires OWNER/ADMIN, validates status transitions
- [ ] Invoice statuses use `INVOICE_STATUS` constants, transitions validated against `VALID_TRANSITIONS`
- [ ] MEMBER does not see Subscription or Organization nav items in sidebar
- [ ] OWNER can navigate to `/settings/organization`, edit name/logo/slug, and see org metadata
- [ ] OWNER can delete org from `/settings/organization` with confirmation dialog
- [ ] Direct URL access to gated pages shows inline "Access Denied" message (not blank page or API error)
- [ ] Every RBAC denial logs `[RBAC_DENY]` with userId, orgId, requiredRole, actualRole, and action
- [ ] User switches org → logs out → logs back in → lands on the same org (not default)
- [ ] User creates new org → `defaultOrganizationId` updated in DB → re-login lands on new org
- [ ] User logs in from a new device → lands on their `defaultOrganizationId` org
- [ ] Notifications are user-scoped — marking read only affects own notifications
- [ ] All 6 cron routes and 2 webhook routes continue working after RBAC is applied
- [ ] Cron recurring-invoices successfully sends emails (no silent failure from Server Action auth)
- [ ] `countUnpaidInvoices` and `checkInvoiceStatus` Server Actions have auth + org-scope
- [ ] Email logic extracted to utilities — cron and Server Actions share same code
- [ ] System-context actions log `[SYSTEM_ACTION]` for audit trail