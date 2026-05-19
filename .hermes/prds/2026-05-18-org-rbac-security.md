# PRD: Organization RBAC & Security

> Version: 1.0 | Author: Naya | Date: 2026-05-18

## 1. Executive Summary

ProjectBill currently lacks centralized role-based access control. Every API route manually checks `membership.role` with inline if/else, MEMBER users can perform all data operations including financial final-state actions (mark paid) and org admin actions (settings, billing), and there is no shared utility enforcing org-scoped data queries—risking cross-org data leaks. This PRD introduces a centralized RBAC system (`requireOrgRole()`), a permission matrix enforcement layer, an org-scoping query helper, role-based UI visibility, and a dedicated Organization Settings page to close these security and UX gaps.

## 2. Problem Statement

**Current pain points:**

1. **Permission leak:** MEMBER users can create, edit, and delete invoices, clients, and projects—and critically, mark invoices as paid/sent, change company settings, and manage email config—without any role restriction. The only role-checked operations are org management (members, invites, deletion). All other write endpoints only check `organizationId`, not role.

2. **No centralized RBAC:** Every route handler duplicates role-check logic inline (`const membership = await...; if (membership.role !== 'OWNER') return 403`). Missing a check on even one route exposes a permission vulnerability. There is no `requireOrgRole()` helper that can be reused across all routes.

3. **Cross-org data leak risk:** Every route manually constructs `where: { organizationId: session.user.activeOrganizationId! }`. If a developer forgets the filter on a new route, cross-org data becomes accessible. There is no shared query helper that makes org-scoping automatic.

4. **No role-based UI visibility:** Sidebar navigation shows Team, Subscription, and Settings links to all roles—including MEMBER. The API blocks non-owners, but the UI doesn't hide or disable these nav items, creating a confusing "click then see error" experience.

5. **No Organization Settings page:** Org metadata (name, logo, slug) and the danger zone (delete org) have no UI. The `PUT /api/organizations/[id]` API exists but is unreachable from the frontend. OWNER has no way to manage their org's identity.

**Who experiences this:**
- **OWNER/ADMIN** — Cannot manage org identity visually; must use API directly
- **MEMBER** — Sees nav items they can't access; can perform actions they shouldn't (mark paid, change settings)
- **Developers** — Must remember to add role checks and org filters on every new route; error-prone

**Existing alternatives & shortcomings:**
- Inline role checks in route handlers → inconsistent, easily missed
- No UI for org management → OWNER uses API or can't change org name/logo at all

## 3. Goals & Success Metrics

| Goal Type | Description | KPI |
|-----------|-------------|-----|
| Security | MEMBER cannot access OWNER/ADMIN-only actions | Zero permission violations in manual testing |
| Security | No route can return cross-org data | Zero cross-org data leaks in testing |
| Developer | RBAC is a one-line call, not boilerplate | `requireOrgRole('OWNER')` ≤ 1 line per route |
| UX | Nav items hidden for unauthorized roles | MEMBER never sees 403 from clicking nav |
| UX | OWNER can edit org name, logo, slug from UI | Org edit flow complete without API calls |
| Reliability | No route ships without org-scoping | New routes automatically scoped via helper |

## 4. User Personas

- **Rina (OWNER):** Founder of a small agency. Created the org, manages billing, wants to rename the org and update logo without opening terminal. Frustrated that she can't see a dedicated org management page.

- **Dimas (ADMIN):** Project manager at the agency. Manages team members and day-to-day ops. Should be able to add/remove members and edit company settings, but shouldn't touch billing or delete the org.

- **Sari (MEMBER):** Freelancer working on projects. Creates invoices and manages clients. Should NOT be able to mark invoices as paid, change company settings, or access billing.

- **Developer (Dev):** Adds new API routes. Currently must remember to add role checks and org filters manually. Wants a one-liner that handles auth + role + scoping.

## 5. User Stories (Prioritized)

- **[P0]** As a OWNER, I want all MEMBER-restricted actions to be blocked server-side so that members cannot perform operations beyond their role.
- **[P0]** As a developer, I want a `requireOrgRole()` helper so that I can enforce role-based access in one line per route.
- **[P0]** As a developer, I want an org-scoping query helper so that every database query is automatically filtered by organization.
- **[P0]** As a MEMBER, I want unauthorized nav items to be hidden so that I don't see 403 errors from clicking them.
- **[P1]** As a OWNER, I want a `/settings/organization` page so that I can edit my org name, logo, and slug from the UI.
- **[P1]** As a OWNER, I want a danger zone in org settings so that I can delete my org with a confirmation flow.
- **[P1]** As a OWNER/ADMIN, I want to see role badges on nav items so that I know which features are role-gated.
- **[P2]** As a ADMIN, I want the org settings page to clearly show which sections I cannot access (billing, delete) so that I understand my permissions.

## 6. Functional Requirements

### FR-1: Centralized Role-Based Access Control (`requireOrgRole()`)

**Description:** A reusable server-side helper that verifies the authenticated user's role in their active organization and returns the membership record or throws a 403. Replaces all inline role-check boilerplate across API routes.

**Acceptance Criteria:**
- [ ] AC-1: `requireOrgRole(session, 'OWNER')` returns `{ membership, organizationId }` when the user is OWNER of the active org, throws `AuthError(403)` otherwise
- [ ] AC-2: `requireOrgRole(session, ['OWNER', 'ADMIN'])` supports array for multi-role acceptance
- [ ] AC-3: When user is not a member of the active org at all, throws `AuthError(403)` with message "Not a member of this organization"
- [ ] AC-4: When user's role is below the required level, throws `AuthError(403)` with message "Requires OWNER role" (or whichever role was required)
- [ ] AC-5: When session is unauthenticated, throws `AuthError(401)` — never reaches the role check
- [ ] AC-6: Helper extracts `activeOrganizationId` from session, queries `OrganizationMember` once, caches result for the request lifetime
- [ ] AC-7: All existing inline role checks in API routes are replaced with `requireOrgRole()` calls
- [ ] AC-8: Helper is exported from `src/lib/auth/org-rbac.ts`

**Edge Cases:**
- User's membership was deleted between JWT issuance and API call → 403 with clear message
- User session has stale `activeOrganizationId` for a soft-deleted org → 403
- Multiple concurrent requests with same session → each resolves independently (no shared mutable state)
- `activeOrganizationId` is null/undefined in session → 401 redirect

### FR-2: Permission Matrix Enforcement

**Description:** Define and enforce a clear permission matrix so that each role can only perform authorized actions. The matrix is the single source of truth for what each role can do.

**Permission Matrix:**

| Action | OWNER | ADMIN | MEMBER |
|--------|-------|-------|--------|
| Org management (name, logo, slug, delete) | ✅ | ❌ | ❌ |
| Team management (add/remove members, change roles) | ✅ | ✅ | ❌ |
| Billing & subscription | ✅ | ❌ | ❌ |
| Export org data | ✅ | ❌ | ❌ |
| Company settings (company info, bank, email config) | ✅ | ✅ | ❌ |
| Mark invoice as paid/sent | ✅ | ✅ | ❌ |
| Create/edit/delete invoice | ✅ | ✅ | ✅ |
| Create/edit/delete client | ✅ | ✅ | ✅ |
| Create/edit/delete project | ✅ | ✅ | ✅ |
| View dashboard, invoices, clients, projects | ✅ | ✅ | ✅ |

**Acceptance Criteria:**
- [ ] AC-1: Permission matrix is defined as a configuration object in `src/lib/auth/permissions.ts` — not hardcoded switch/case in routes
- [ ] AC-2: Each API route that performs a restricted action calls `requireOrgRole()` with the appropriate role(s)
- [ ] AC-3: MARK PAID: `PATCH /api/invoices/[id]/mark-paid` requires `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-4: MARK SENT: `PATCH /api/invoices/[id]/mark-sent` requires `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-5: SETTINGS: `GET/PUT /api/settings` requires `requireOrgRole(session, ['OWNER', 'ADMIN'])`
- [ ] AC-6: BILLING: `GET/PUT /api/subscription` requires `requireOrgRole(session, 'OWNER')`
- [ ] AC-7: EXPORT: `POST /api/organizations/[id]/export` requires `requireOrgRole(session, 'OWNER')`
- [ ] AC-8: ORG DELETE: already requires OWNER — verify and add `requireOrgRole()` call
- [ ] AC-9: ORG UPDATE: `PUT /api/organizations/[id]` requires `requireOrgRole(session, 'OWNER')` (currently allows ADMIN — tighten to OWNER per matrix)
- [ ] AC-10: INVOICE CREATE/EDIT/DELETE: accessible to all roles — no `requireOrgRole()` needed beyond org membership verification
- [ ] AC-11: A runtime helper `canPerform(action: string, role: string): boolean` exists to check permissions from the matrix config

**Edge Cases:**
- MEMBER tries to mark invoice paid via direct API call → 403 with "Requires OWNER or ADMIN role"
- ADMIN tries to delete org → 403 with "Requires OWNER role"
- ADMIN tries to access billing → 403 with "Requires OWNER role"
- MEMBER tries to update settings → 403
- OWNER in Org A (as MEMBER in Org B) switches to Org B and tries billing → 403, because role is checked against active org
- Downgrade from ADMIN to MEMBER while session is active → next API call reads fresh role from DB, not JWT cache

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
- [ ] AC-1: Sidebar nav items gated by permission: Team (OWNER/ADMIN), Subscription (OWNER), Settings > Company (OWNER/ADMIN), Settings > Organization (OWNER)
- [ ] AC-2: MEMBER does NOT see Subscription nav item
- [ ] AC-3: MEMBER sees Settings nav item but only sees personal tabs (profile, password), not company/org/billing tabs
- [ ] AC-4: ADMIN sees Team and Settings > Company, but NOT Subscription
- [ ] AC-5: OWNER sees all nav items
- [ ] AC-6: Nav items hidden (not disabled/greyed out) — no "visible but inaccessible" pattern
- [ ] AC-7: Role information passed from server layout to client components via existing server props pattern (no new API calls)
- [ ] AC-8: Direct URL access to gated pages (e.g., `/settings/organization` as MEMBER) → page shows "Access Denied" inline message with redirect link, not 403 API error

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

## 7. Non-Functional Requirements

- **Performance:** `requireOrgRole()` must add ≤5ms overhead per request (single Prisma query by org+userId with compound unique index)
- **Security:** Org-scoping helper must prevent ALL cross-org data leaks — no route can return data from another org even with crafted parameters
- **Security:** Membership verification must always read from DB (not JWT), so role changes take effect on next API call
- **Security:** 404 (not 403) returned when a record doesn't belong to the user's org — prevents enumeration of other orgs' record IDs
- **Accessibility:** Keyboard navigation to all org settings form fields; ARIA labels on danger zone
- **Platform:** Works with existing Next.js 16 App Router, Prisma 7, Auth.js v5, shadcn/ui
- **Backward compatibility:** Self-hosted mode behavior unchanged — RBAC still applies (MEMBER restrictions are valuable even in self-hosted)
- **Observability:** Every 403 from `requireOrgRole()` logs `[RBAC_DENY] userId=X orgId=Y requiredRole=Z actualRole=W action=ActionName`

## 8. High-Level Architecture

### Tech Stack
- Server helper: `src/lib/auth/org-rbac.ts` — `requireOrgRole()`, `canPerform()`
- Permission config: `src/lib/auth/permissions.ts` — permission matrix definition
- Org-scoping helper: `src/lib/auth/org-scoping.ts` — `orgQuery()`
- UI: shadcn/ui components (Card, Form, Dialog, Button, Input)
- Route: `/settings/organization` — Server Component + Client Component pattern (same as `/settings/team`)

### Key Integration Points
- `requireOrgRole()` replaces inline role checks in all existing API routes
- `orgQuery()` wraps Prisma calls for automatic org scoping
- Permission config drives both server-side `canPerform()` and client-side nav visibility
- `/settings/organization` page uses `PUT /api/organizations/[id]` (existing) and `POST /api/organizations/[id]/delete` (existing)
- Server layout passes `activeOrganizationRole` to client components for nav gating (existing session field)

### Data Model
No schema changes required. Uses existing:
- `OrganizationMember` — role per user per org
- `Organization` — name, slug, logoUrl
- Session — `activeOrganizationId`, `activeOrganizationRole`

### Permission Matrix Config Shape
```typescript
// src/lib/auth/permissions.ts
export const PERMISSIONS = {
  org_manage:     ['OWNER'],
  team_manage:    ['OWNER', 'ADMIN'],
  billing:        ['OWNER'],
  export:         ['OWNER'],
  settings:       ['OWNER', 'ADMIN'],
  mark_paid:      ['OWNER', 'ADMIN'],
  mark_sent:      ['OWNER', 'ADMIN'],
  invoice_crud:   ['OWNER', 'ADMIN', 'MEMBER'],
  client_crud:    ['OWNER', 'ADMIN', 'MEMBER'],
  project_crud:   ['OWNER', 'ADMIN', 'MEMBER'],
  dashboard_view: ['OWNER', 'ADMIN', 'MEMBER'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function canPerform(permission: Permission, role: string): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}
```

### `requireOrgRole()` Shape
```typescript
// src/lib/auth/org-rbac.ts
export async function requireOrgRole(
  session: Session,
  requiredRoles: string | string[]
): Promise<{ membership: OrganizationMember; organizationId: string }> {
  // 1. Verify authenticated
  // 2. Extract activeOrganizationId from session
  // 3. Query OrganizationMember where { userId, organizationId }
  // 4. If not found → 403 "Not a member"
  // 5. If role not in requiredRoles → 403 "Requires X role"
  // 6. Return membership + orgId
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

## 9. Constraints & Assumptions

- **No new roles:** OWNER/ADMIN/MEMBER is sufficient for small agencies. VIEWER role is out of scope.
- **No schema changes:** This PRD uses existing `OrganizationMember.role` and session fields. No migration needed.
- **Role reads from DB:** `requireOrgRole()` always queries the database for current role, not JWT. This means role changes take effect on the very next API call, even if the JWT hasn't refreshed.
- **Phased migration:** Org-scoping helper added first, routes migrated incrementally. `requireOrgRole()` can be applied to all routes in one pass since it's a direct replacement for existing inline checks.
- **Self-hosted mode:** RBAC still applies. Even with one user, the role system works (single OWNER). No special bypass.
- **Existing API contracts:** `PUT /api/organizations/[id]` currently allows ADMIN — this PRD tightens it to OWNER only.

## 10. Out of Scope (This PRD)

1. **VIEWER role** — not needed for small agencies; defer until user demand
2. **Custom permission per user** — matrix is role-based, not per-user overrides
3. **Permission audit trail logging** — already covered by `AuditLog` model; logging RBAC denys is in NFRs but full audit trail of permission checks is future work
4. **Org-scoping auto-migration for ALL existing routes** — helper is created, high-risk routes migrated, but low-risk read-only routes can be migrated later
5. **Rate limiting on 403 responses** — standard API rate limiting is separate concern
6. **Owner transfer flow** — deferred to Batch 3 (Tier 3 in gap analysis)
7. **Invite revocation** — deferred to Batch 2 (Tier 2 in gap analysis)  
8. **Org switch persistence to DB** — deferred to Batch 2 (Tier 2 in gap analysis)

## 11. Success Criteria

- [ ] `requireOrgRole()` is used in ALL API routes that perform restricted actions — zero inline role checks remain
- [ ] MEMBER receives 403 when attempting to mark invoice paid/sent, change company settings, access billing, or delete org
- [ ] ADMIN receives 403 when attempting to access billing, delete org, or change org name/logo/slug
- [ ] OWNER can perform all actions listed in the permission matrix
- [ ] No API route returns data from a different organization than `activeOrganizationId`
- [ ] MEMBER does not see Subscription or Organization nav items in sidebar
- [ ] OWNER can navigate to `/settings/organization`, edit name/logo/slug, and see org metadata
- [ ] OWNER can delete org from `/settings/organization` with confirmation dialog
- [ ] Direct URL access to gated pages shows inline "Access Denied" message (not blank page or API error)
- [ ] Every RBAC denial logs `[RBAC_DENY]` with userId, orgId, requiredRole, actualRole, and action