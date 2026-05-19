# PRD: Organization RBAC & Security

> Version: 1.1 | Author: Naya | Date: 2026-05-18
> Changelog: v1.1 — Added FR-6 (critical auth/scoping fixes), FR-7 (invoice status protection), FR-8 (org switch persistence), extended permission matrix, notification scoping, fixed mark-sent AC reference.

## 1. Executive Summary

ProjectBill currently lacks centralized role-based access control. Every API route manually checks `membership.role` with inline if/else, MEMBER users can perform all data operations including financial final-state actions (mark paid) and org admin actions (settings, billing), and there is no shared utility enforcing org-scoped data queries—risking cross-org data leaks. Additionally, several critical routes have zero authentication, zero org-scoping, or mass-assignment vulnerabilities. The org switch is not persisted to the database, causing users to revert to their default org on re-login. Notifications are org-scoped only, causing cross-user interference. This PRD introduces a centralized RBAC system (`requireOrgRole()`), a permission matrix enforcement layer, an org-scoping query helper, role-based UI visibility, invoice status protection, critical auth/scoping emergency fixes, a dedicated Organization Settings page, org switch persistence, and notification user-scoping.

## 2. Problem Statement

**Current pain points:**

1. **Permission leak:** MEMBER users can create, edit, and delete invoices, clients, and projects—and critically, mark invoices as paid/sent, change company settings, and manage email config—without any role restriction. The only role-checked operations are org management (members, invites, deletion). All other write endpoints only check `organizationId`, not role.

2. **No centralized RBAC:** Every route handler duplicates role-check logic inline (`const membership = await...; if (membership.role !== 'OWNER') return 403`). Missing a check on even one route exposes a permission vulnerability. There is no `requireOrgRole()` helper that can be reused across all routes.

3. **Cross-org data leak risk:** Every route manually constructs `where: { organizationId: session.user.activeOrganizationId! }`. If a developer forgets the filter on a new route, cross-org data becomes accessible. Some routes already have missing orgId filters (recurring invoices GET, SOW templates GET, SSE events stream).

4. **No role-based UI visibility:** Sidebar navigation shows Team, Subscription, and Settings links to all roles—including MEMBER. The API blocks non-owners, but the UI doesn't hide or disable these nav items, creating a confusing "click then see error" experience.

5. **No Organization Settings page:** Org metadata (name, logo, slug) and the danger zone (delete org) have no UI. The `PUT /api/organizations/[id]` API exists but is unreachable from the frontend. OWNER has no way to manage their org's identity.

6. **Critical unauthenticated routes:** `POST /api/invoices/[id]/pay` has zero authentication and zero org-scoping—anyone with an invoice ID can create external payment links. `/api/events` SSE stream has zero auth and broadcasts all orgs' events to all connected clients.

7. **Invoice status bypass:** `PATCH /api/invoices/[id]` accepts `status` in the body without role checks—MEMBER can set `status: "PAID"` directly, completely bypassing the mark-paid gate. PAID invoices can be changed back to DRAFT. DELETE on PAID invoices has no role or status guard.

8. **Mass assignment vulnerability:** `PUT /api/recurring-invoices/[id]` passes raw request body directly to Prisma—any field including `organizationId`, `nextRunAt`, `isActive` can be overwritten.

9. **Org switch not persisted:** Switching org only updates the JWT client-side. On re-login or new device, user reverts to their default org—not the last one they accessed.

10. **Notification cross-user interference:** Notifications have `organizationId` but no `userId`—any member marking "mark all read" clears unread counts for all users in the org.

**Who experiences this:**
- **OWNER/ADMIN** — Cannot manage org identity visually; must use API directly
- **MEMBER** — Sees nav items they can't access; can perform actions they shouldn't (mark paid, change settings, send emails, delete PAID invoices)
- **Developers** — Must remember to add role checks and org filters on every new route; error-prone
- **All users** — Org switch doesn't persist; notification read state is shared across org members

**Existing alternatives & shortcomings:**
- Inline role checks in route handlers → inconsistent, easily missed
- No UI for org management → OWNER uses API or can't change org name/logo at all
- JWT-only org switch → reverts on session expiry

## 3. Goals & Success Metrics

| Goal Type | Description | KPI |
|-----------|-------------|-----|
| Security | MEMBER cannot access OWNER/ADMIN-only actions | Zero permission violations in manual testing |
| Security | No route can return cross-org data | Zero cross-org data leaks in testing |
| Security | No unauthenticated route can modify financial data | Zero unauthenticated financial mutations |
| Security | Invoice status cannot be changed via PATCH bypass | PATCH /api/invoices cannot alter status field |
| Security | No mass-assignment vulnerability in any route | All write routes whitelist allowed fields |
| Developer | RBAC is a one-line call, not boilerplate | `requireOrgRole('OWNER')` ≤ 1 line per route |
| UX | Nav items hidden for unauthorized roles | MEMBER never sees 403 from clicking nav |
| UX | OWNER can edit org name, logo, slug from UI | Org edit flow complete without API calls |
| UX | Last accessed org persists across logins | User returns to same org after re-login/new device |
| UX | Each user has their own notification feed | Mark-read only affects own notifications |
| Reliability | No route ships without org-scoping | New routes automatically scoped via helper |

## 4. User Personas

- **Rina (OWNER):** Founder of a small agency. Created the org, manages billing, wants to rename the org and update logo without opening terminal. Works across multiple orgs and expects the app to remember which org she was last using. Frustrated that she can't see a dedicated org management page.

- **Dimas (ADMIN):** Project manager at the agency. Manages team members and day-to-day ops. Should be able to add/remove members and edit company settings, but shouldn't touch billing or delete the org. Needs to approve milestones and mark payments as received.

- **Sari (MEMBER):** Freelancer working on projects. Creates invoices and manages clients. Should NOT be able to mark invoices as paid, change company settings, access billing, send emails to clients, or delete invoices.

- **Developer (Dev):** Adds new API routes. Currently must remember to add role checks and org filters manually. Wants a one-liner that handles auth + role + scoping.

## 5. User Stories (Prioritized)

- **[P0]** As a OWNER, I want all MEMBER-restricted actions to be blocked server-side so that members cannot perform operations beyond their role.
- **[P0]** As a developer, I want a `requireOrgRole()` helper so that I can enforce role-based access in one line per route.
- **[P0]** As a developer, I want an org-scoping query helper so that every database query is automatically filtered by organization.
- **[P0]** As a user, I want no route to be accessible without authentication so that unauthenticated parties cannot access or modify my data.
- **[P0]** As a user, I want no route to return cross-org data so that my data is isolated from other organizations.
- **[P0]** As a MEMBER, I want unauthorized nav items to be hidden so that I don't see 403 errors from clicking them.
- **[P0]** As a user, I want invoice status to only be changeable through authorized endpoints so that financial records cannot be tampered with.
- **[P1]** As a OWNER, I want a `/settings/organization` page so that I can edit my org name, logo, and slug from the UI.
- **[P1]** As a OWNER, I want a danger zone in org settings so that I can delete my org with a confirmation flow.
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
| Change invoice status (mark paid, mark sent via emailStatus) | ✅ | ✅ | ❌ |
| Delete invoice | ✅ | ✅ | ❌ |
| Send invoice/receipt email | ✅ | ✅ | ❌ |
| Approve/unapprove milestone | ✅ | ✅ | ❌ |
| Recurring invoice create/edit/delete | ✅ | ✅ | ❌ |
| SOW template create/edit/delete | ✅ | ✅ | ❌ |
| View audit log | ✅ | ✅ | ❌ |
| Manage agent/AI config | ✅ | ✅ | ❌ |
| Create payment link | ✅ | ✅ | ❌ |
| Create/edit/delete invoice | ✅ | ✅ | ✅ |
| Create/edit/delete client | ✅ | ✅ | ✅ |
| Create/edit/delete project | ✅ | ✅ | ✅ |
| View dashboard, invoices, clients, projects | ✅ | ✅ | ✅ |
| View recurring invoices / SOW templates (read-only) | ✅ | ✅ | ✅ |
| View own notifications | ✅ | ✅ | ✅ |

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
- [ ] AC-17: CREATE PAYMENT LINK: `POST /api/invoices/[id]/pay` requires `requireOrgRole(session, ['OWNER', 'ADMIN'])` (plus auth + org-scope — see FR-6)
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
- [ ] AC-1: `POST /api/invoices/[id]/pay` — add `auth()` check, add org-scope (`where: { id, organizationId: orgId }`), add `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-2: `GET /api/events` SSE stream — add `auth()` check, filter emitted events by `organizationId` of the authenticated user's active org. Do NOT broadcast events from other orgs.
- [ ] AC-3: `GET /api/recurring-invoices` — add `where: { organizationId: orgId }` filter to the Prisma query (currently `where: {}` which returns all orgs' data)
- [ ] AC-4: `GET /api/sow-templates` — add `where: { organizationId: orgId }` filter to the Prisma query (currently `where: {}` which returns all orgs' data)
- [ ] AC-5: `PUT /api/recurring-invoices/[id]` — whitelist allowed fields: `name, amount, interval, intervalCount, nextRunAt, isActive, projectId, description, startNumber, prefix`. Do NOT pass raw JSON to Prisma. Explicitly reject `organizationId` in update data.
- [ ] AC-6: `POST /api/invoices/[id]/retry-email` — add `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-7: Verify all existing routes that have `auth()` but missing `organizationId` filter — fix any remaining cross-org leaks

**Edge Cases:**
- `/api/events` SSE: If Redis is used, events are published to a global `system_events` channel. Solution: encode `organizationId` in the event payload, and filter on the subscriber side per connected client's orgId. Do NOT create per-org Redis channels (scalability issue).
- `/api/events` SSE: Client connects, then user's session changes org via switch → SSE stream should close and client reconnects (handle in frontend)
- Invoice `pay` route: After adding auth, client-portal payment flow must still work — verify if this route is called from client portal (unauthenticated). If yes, add a separate client-facing auth mechanism (e.g., client_session cookie check).
- Recurring invoice PUT: Field whitelist must be validated server-side regardless of what the client sends

### FR-7: Invoice Status Protection

**Description:** Prevent invoice status from being changed through unauthorized means. Currently `PATCH /api/invoices/[id]` accepts `status` in the body, allowing any user to set any status including PAID. PAID invoices can also be deleted without restriction.

**Acceptance Criteria:**
- [ ] AC-1: `PATCH /api/invoices/[id]` — remove `status` from accepted fields. The only accepted field for PATCH is `cancelAtPeriodEnd`. Status changes must go through dedicated endpoints only.
- [ ] AC-2: `DELETE /api/invoices/[id]` — add `requireOrgRole(session, ['OWNER', 'ADMIN'])` role check. OWNER and ADMIN can delete, MEMBER cannot.
- [ ] AC-3: `DELETE /api/invoices/[id]` — add status guard: invoices with status `PAID` cannot be deleted. Return 409 with message "Cannot delete a paid invoice". OWNER must void/cancel first.
- [ ] AC-4: `sendInvoiceEmail` Server Action — add `requireOrgRole(session, ['OWNER', 'ADMIN'])`. Only OWNER/ADMIN can send invoice emails to clients.
- [ ] AC-5: `sendReceiptEmail` Server Action — add `requireOrgRole(session, ['OWNER', 'ADMIN'])`. Only OWNER/ADMIN can send receipt emails.
- [ ] AC-6: Invoice status transition rules enforced at the database/action level: `DRAFT/unpaid → PAID` only via mark-paid endpoint or milestone mark-paid; `PAID → void/cancel` only via explicit cancel action (not PATCH); no arbitrary status changes.

**Edge Cases:**
- MEMBER tries `PATCH /api/invoices/[id]` with `{ status: "PAID" }` → the `status` field is silently ignored, only `cancelAtPeriodEnd` is processed. Return success with updated invoice (status unchanged).
- OWNER tries to delete a PAID invoice → 409 "Cannot delete a paid invoice"
- ADMIN tries to delete a DRAFT invoice → allowed (204)
- Recurring invoice auto-generates a PAID invoice → auto-generated PAID invoices follow same delete protection
- Milestone mark-paid sets invoice to PAID → this is the authorized path, requires OWNER/ADMIN (per FR-2 AC-16)
- What about `VOID` status? If invoice is VOID, it should still not be deletable by MEMBER, but ADMIN/OWNER can delete it.

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

**Edge Cases:**
- User has no memberships at all → `defaultOrganizationId` is null → redirect to onboarding
- User removed from their default org → fallback finds next membership; if none, redirect to onboarding
- Race condition: User switches org rapidly on two devices → last write wins; both devices converge on next login
- `defaultOrganizationId` references an org where user is now MEMBER (was OWNER when set) → JWT callback reads actual role from DB, sets correct `activeOrganizationRole`
- Fresh user (just signed up) → no `defaultOrganizationId` yet → onboarding creates org → sets `defaultOrganizationId`
- User created new org via OrgSwitcher → `defaultOrganizationId` auto-set to new org (since they switch to it immediately)

### FR-9: Notification User-Scoping

**Description:** Add `userId` to the Notification model so each user has their own notification feed. Currently notifications are org-scoped only, causing cross-user interference when one member marks all as read.

**Acceptance Criteria:**
- [ ] AC-1: Add `userId String?` field to Notification model in `prisma/schema.prisma`
- [ ] AC-2: Add `@@index([userId])` and `user User? @relation(fields: [userId], references: [id])` relation
- [ ] AC-3: Generate migration: `npx prisma migrate dev --name add_user_id_to_notifications`
- [ ] AC-4: `GET /api/notifications` — filter by `where: { organizationId: orgId, userId: session.user.id }` (return only current user's notifications within the org)
- [ ] AC-5: `PATCH /api/notifications` (mark as read) — only mark notifications belonging to `session.user.id`
- [ ] AC-6: `PATCH /api/notifications` (mark all as read) — only mark current user's unread notifications
- [ ] AC-7: `createNotification()` helper — accept `userId` parameter and set it when creating notifications. If notification is org-wide (e.g., "org settings changed"), set `userId: null` and display to all org members.
- [ ] AC-8: Backfill existing notifications: set `userId: null` for all existing rows (they become org-wide notifications visible to all members)
- [ ] AC-9: For notifications with `userId: null`, all org members can see them; for notifications with a specific `userId`, only that user sees them
- [ ] AC-10: `/api/events` SSE: filter notifications emitted to user by userId match OR userId = null (org-wide)

**Edge Cases:**
- Notification with `userId: null` (org-wide) → mark-read by one user should NOT mark it as read for other users. Solution: org-wide notifications need a per-user read tracking mechanism (e.g., `NotificationRead` junction table) OR simply treat `userId: null` notifications as always-read-once-seen (less ideal). Preferred approach: for MVP, org-wide notifications appear as read/unread independently per user — requires a `NotificationReadStatus` junction table with `userId + notificationId + isRead`.
- If junction table approach is too complex for MVP, simpler alternative: all new notifications have a `userId` set. Org-wide announcements can be handled separately later.
- Existing notifications without userId → backfill to `null` → visible to all, mark-read affects all (acceptable for legacy data during transition)

## 7. Non-Functional Requirements

- **Performance:** `requireOrgRole()` must add ≤5ms overhead per request (single Prisma query by org+userId with compound unique index)
- **Security:** Org-scoping helper must prevent ALL cross-org data leaks — no route can return data from another org even with crafted parameters
- **Security:** Membership verification must always read from DB (not JWT), so role changes take effect on next API call
- **Security:** 404 (not 403) returned when a record doesn't belong to the user's org — prevents enumeration of other orgs' record IDs
- **Security:** All write routes must whitelist allowed fields — no raw request body passed to Prisma
- **Security:** SSE stream must not leak events from other organizations
- **Security:** No route that modifies financial data (create payment links, mark paid, approve milestones) may be accessible without authentication
- **Accessibility:** Keyboard navigation to all org settings form fields; ARIA labels on danger zone
- **Platform:** Works with existing Next.js 16 App Router, Prisma 7, Auth.js v5, shadcn/ui
- **Backward compatibility:** Self-hosted mode behavior unchanged — RBAC still applies (MEMBER restrictions are valuable even in self-hosted)
- **Observability:** Every 403 from `requireOrgRole()` logs `[RBAC_DENY] userId=X orgId=Y requiredRole=Z actualRole=W action=ActionName`

## 8. High-Level Architecture

### Tech Stack
- Server helper: `src/lib/auth/org-rbac.ts` — `requireOrgRole()`
- Permission config: `src/lib/auth/permissions.ts` — permission matrix definition + `canPerform()`
- Org-scoping helper: `src/lib/auth/org-scoping.ts` — `orgQuery()`
- UI: shadcn/ui components (Card, Form, Dialog, Button, Input)
- Route: `/settings/organization` — Server Component + Client Component pattern (same as `/settings/team`)

### Key Integration Points
- `requireOrgRole()` replaces inline role checks in all existing API routes AND Server Actions
- `orgQuery()` wraps Prisma calls for automatic org scoping
- Permission config drives both server-side `canPerform()` and client-side nav visibility
- `/settings/organization` page uses `PUT /api/organizations/[id]` (existing) and `POST /api/organizations/[id]/delete` (existing)
- Server layout passes `activeOrganizationRole` to client components for nav gating (existing session field)
- Org switch endpoint updates `User.defaultOrganizationId` in DB
- `auth.config.ts` JWT callback reads `defaultOrganizationId` from DB on sign-in

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
  organization   Organization  @relation(fields: [organizationId], references: [id])
  user           User?         @relation(fields: [userId], references: [id])  // NEW

  @@index([organizationId])
  @@index([userId])           // NEW
}
```

**Schema Change 2: User model — `defaultOrganizationId` already exists**
The `User.defaultOrganizationId` field already exists in the schema. Current usage: set during onboarding. New usage: updated on every org switch, read on JWT creation to set `activeOrganizationId`.

**No other schema changes required.** Uses existing:
- `OrganizationMember` — role per user per org
- `Organization` — name, slug, logoUrl
- Session — `activeOrganizationId`, `activeOrganizationRole` (now derived from `User.defaultOrganizationId`)

### Permission Matrix Config Shape
```typescript
// src/lib/auth/permissions.ts
export const PERMISSIONS = {
  org_manage:         ['OWNER'],
  team_manage:        ['OWNER', 'ADMIN'],
  billing:            ['OWNER'],
  export:             ['OWNER'],
  settings:           ['OWNER', 'ADMIN'],
  mark_paid:          ['OWNER', 'ADMIN'],
  change_invoice_status: ['OWNER', 'ADMIN'],
  delete_invoice:     ['OWNER', 'ADMIN'],
  send_email:         ['OWNER', 'ADMIN'],
  milestone_approve:  ['OWNER', 'ADMIN'],
  recurring_invoice_cud: ['OWNER', 'ADMIN'],
  sow_template_cud:   ['OWNER', 'ADMIN'],
  view_audit_log:     ['OWNER', 'ADMIN'],
  agent_config:       ['OWNER', 'ADMIN'],
  create_payment_link: ['OWNER', 'ADMIN'],
  invoice_crud:       ['OWNER', 'ADMIN', 'MEMBER'],
  client_crud:        ['OWNER', 'ADMIN', 'MEMBER'],
  project_crud:       ['OWNER', 'ADMIN', 'MEMBER'],
  dashboard_view:     ['OWNER', 'ADMIN', 'MEMBER'],
  view_recurring:     ['OWNER', 'ADMIN', 'MEMBER'],
  view_sow_template:  ['OWNER', 'ADMIN', 'MEMBER'],
  view_own_notifications: ['OWNER', 'ADMIN', 'MEMBER'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function canPerform(permission: Permission, role: string): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}
```

### `requireOrgRole()` Shape
```typescript
// src/lib/auth/org-rbac.ts
export class AuthError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

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
```

### `orgQuery()` Shape
```typescript
// src/lib/auth/org-scoping.ts
export function orgQuery(orgId: string) {
  return {
    findMany: <T>(model: any, args?: any) => model.findMany({ ...args, where: { ...args?.where, organizationId: orgId } }),
    findFirst: <T>(model: any, args?: any) => model.findFirst({ ...args, where: { ...args?.where, organizationId: orgId } }),
    create: (model: any, args: any) => model.create({ ...args, data: { ...args.data, organizationId: orgId } }),
    // update/delete verify record belongs to org first
  };
}
```

### SSE Event Filtering Shape
```typescript
// In /api/events/route.ts
// After auth check, extract orgId from session
// Filter: only emit events where event.data.organizationId === session.user.activeOrganizationId
// Or where event.data.userId === session.user.id (for user-scoped notifications)
// Or where event.data.userId === null (for org-wide events)
if (eventOrgId === userOrgId || eventUserId === userId || eventUserId === null) {
  controller.enqueue(encoded);
}
```

### Org Switch Persistence Flow
```
Client clicks org in OrgSwitcher
  → POST /api/organizations/[id]/switch
    → verify membership (existing)
    → update User.defaultOrganizationId = targetOrgId (NEW)
    → update JWT via session.update() (existing)
    → return success with role
  → Client receives success
    → router.refresh()
    → Layout reads new activeOrganizationId from JWT

On next login:
  → auth.config.ts JWT callback
    → read User.defaultOrganizationId from DB
    → if set, find membership, set activeOrganizationId + activeOrganizationRole
    → if null, fall back to first OWNER membership (existing behavior)
```

## 9. Constraints & Assumptions

- **No new roles:** OWNER/ADMIN/MEMBER is sufficient for small agencies. VIEWER role is out of scope.
- **Schema changes:** Two schema changes required: (1) add `userId` to Notification model, (2) User model already has `defaultOrganizationId` (no migration needed, just new usage).
- **Role reads from DB:** `requireOrgRole()` always queries the database for current role, not JWT. This means role changes take effect on the very next API call, even if the JWT hasn't refreshed.
- **Phased migration:** Org-scoping helper added first, routes migrated incrementally. `requireOrgRole()` can be applied to all routes in one pass since it's a direct replacement for existing inline checks.
- **Self-hosted mode:** RBAC still applies. Even with one user, the role system works (single OWNER). No special bypass.
- **Existing API contracts:** `PUT /api/organizations/[id]` currently allows ADMIN — this PRD tightens it to OWNER only.
- **SSE filtering approach:** Filter on subscriber side (not Redis channel splitting) to maintain scalability.
- **Notification MVP approach:** For org-wide notifications (userId=null), use simple read tracking. A junction table `NotificationReadStatus` can be added later for per-user read tracking on org-wide notifications. For MVP, org-wide notifications are treated as read-once-seen by each user (simpler).
- **Invoice pay route:** Must verify if this endpoint is called from client portal (unauthenticated). If so, need a separate client auth mechanism for portal access. For now, assume internal-only (authenticated) and add auth + role gate.

## 10. Out of Scope (This PRD)

1. **VIEWER role** — not needed for small agencies; defer until user demand
2. **Custom permission per user** — matrix is role-based, not per-user overrides
3. **Permission audit trail logging** — full audit trail of permission checks is future work (RBAC deny logging is in NFRs)
4. **Org-scoping auto-migration for ALL existing routes** — helper is created, high-risk routes migrated, but low-risk read-only routes can be migrated later
5. **Rate limiting on 403 responses** — standard API rate limiting is separate concern
6. **Owner transfer flow** — deferred to future batch
7. **Invite revocation** — deferred to future batch
8. **Client portal auth rewrite** — `/api/client-portal/auth/*` routes are public by design. Token validation improvements are noted but deferred. Only the `/orgs` endpoint enumeration risk should be mitigated (add rate limiting — separate concern).
9. **NotificationReadStatus junction table** — per-user read tracking on org-wide notifications. For MVP, org-wide notifs are simple. Can be added later if needed.
10. **Export download route** — the `downloadUrl` 404 issue is a separate bug, not RBAC-related

## 11. Success Criteria

- [ ] `requireOrgRole()` is used in ALL API routes AND Server Actions that perform restricted actions — zero inline role checks remain
- [ ] MEMBER receives 403 when attempting to mark invoice paid/sent, change company settings, access billing, delete org, delete invoices, send emails, approve milestones, CRUD recurring invoices, CRUD SOW templates
- [ ] ADMIN receives 403 when attempting to access billing, delete org, or change org name/logo/slug
- [ ] OWNER can perform all actions listed in the permission matrix
- [ ] No API route returns data from a different organization than `activeOrganizationId`
- [ ] `POST /api/invoices/[id]/pay` requires authentication and OWNER/ADMIN role
- [ ] `/api/events` SSE stream requires authentication and only emits events for the user's active org
- [ ] `GET /api/recurring-invoices` and `GET /api/sow-templates` return only org-scoped data
- [ ] `PUT /api/recurring-invoices/[id]` whitelists update fields — no mass assignment possible
- [ ] `PATCH /api/invoices/[id]` cannot change invoice status — status field is stripped
- [ ] `DELETE /api/invoices/[id]` requires OWNER/ADMIN and blocks deletion of PAID invoices
- [ ] MEMBER does not see Subscription or Organization nav items in sidebar
- [ ] OWNER can navigate to `/settings/organization`, edit name/logo/slug, and see org metadata
- [ ] OWNER can delete org from `/settings/organization` with confirmation dialog
- [ ] Direct URL access to gated pages shows inline "Access Denied" message (not blank page or API error)
- [ ] Every RBAC denial logs `[RBAC_DENY]` with userId, orgId, requiredRole, actualRole, and action
- [ ] User switches org → logs out → logs back in → lands on the same org (not default)
- [ ] User logs in from a new device → lands on their `defaultOrganizationId` org
- [ ] Notifications are user-scoped — marking read only affects own notifications