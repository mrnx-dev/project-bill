import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { OrganizationMember, Session } from "next-auth";
import { NextRequest } from "next/server";

export class AuthError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export type AuthContext =
  | { type: "user"; session: Session; orgId: string; role: string; membership: OrganizationMember }
  | { type: "system"; authMethod: "cron" | "webhook"; orgId?: string };

/**
 * Verify user has the required role in their active organization.
 * Always reads membership from DB — never from JWT cache.
 */
export async function requireOrgRole(
  session: Session | null,
  requiredRoles: string | string[]
): Promise<{ membership: OrganizationMember; organizationId: string }> {
  // 1. Check authentication
  if (!session?.user?.id) {
    throw new AuthError(401, "Unauthorized");
  }

  // 2. Extract active org
  const organizationId = session.user.activeOrganizationId;
  if (!organizationId) {
    throw new AuthError(401, "No active organization");
  }

  // 3. Query membership from DB (always fresh)
  const membership = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: { userId: session.user.id, organizationId },
    },
  });

  if (!membership) {
    throw new AuthError(403, "Not a member of this organization");
  }

  // 4. Check role
  const roles = typeof requiredRoles === "string" ? [requiredRoles] : requiredRoles;
  if (!roles.includes(membership.role)) {
    console.warn(`[RBAC_DENY] userId=${session.user.id} orgId=${organizationId} requiredRole=${roles.join("|")} actualRole=${membership.role}`);
    throw new AuthError(403, `Requires ${roles.join(" or ")} role`);
  }

  return { membership, organizationId };
}

/**
 * Detect auth context: user session (priority), CRON_SECRET, or webhook.
 */
export async function getAuthContext(request: NextRequest): Promise<AuthContext> {
  // PRIORITY 1: user session always wins
  const session = await auth();
  if (session?.user?.id) {
    const orgId = session.user.activeOrganizationId!;
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: session.user.id, organizationId: orgId } },
    });
    if (!membership) throw new AuthError(403, "Not a member of this organization");
    return { type: "user", session: session as Session, orgId, role: membership.role, membership };
  }

  // PRIORITY 2: CRON_SECRET header
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    const url = new URL(request.url);
    return { type: "system", authMethod: "cron", orgId: url.searchParams.get("orgId") ?? undefined };
  }

  // PRIORITY 3: webhook path detection
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/webhooks/")) {
    return { type: "system", authMethod: "webhook" };
  }

  throw new AuthError(401, "Unauthorized");
}