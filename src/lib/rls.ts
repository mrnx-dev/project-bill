import { AsyncLocalStorage } from "async_hooks";
import type { Prisma } from "@prisma/client";

export type TenantStore = { organizationId: string; userId: string };

export const rlsContext = new AsyncLocalStorage<TenantStore>();

export function getOrgContext(): string | undefined {
  return rlsContext.getStore()?.organizationId;
}

export function getTenantCtx(): TenantStore | undefined {
  return rlsContext.getStore();
}

const NON_TENANT_MODELS = [
  "Organization",
  "OrganizationMember",
  "OrganizationInvite",
  "User",
  "Subscription",
  "ExportJob",
  "AgentConfig",
  "AgentMessage",
];

export function isTenantModel(model: string | undefined): boolean {
  return !!model && !NON_TENANT_MODELS.includes(model);
}

export type TenantScopeMode = "where" | "data" | "dataMany";

export function applyTenantScope(
  model: string | undefined,
  args: any,
  orgId: string | undefined,
  mode: TenantScopeMode,
): any {
  if (!orgId || !isTenantModel(model)) return args;

  if (mode === "where") {
    if (args?.where?.organizationId) return args;
    return { ...args, where: { ...(args?.where || {}), organizationId: orgId } };
  }

  if (mode === "data") {
    if (args?.data?.organizationId) return args;
    return { ...args, data: { ...(args?.data || {}), organizationId: orgId } };
  }

  // dataMany
  if (!Array.isArray(args?.data)) return args;
  return {
    ...args,
    data: args.data.map((d: any) =>
      d?.organizationId ? d : { ...d, organizationId: orgId },
    ),
  };
}

type RouteCtx = { params: Promise<Record<string, string | string[]>> };
type RouteHandler = (req: Request, ctx: RouteCtx) => Promise<Response>;

export function withTenant(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    // Lazy import to avoid a circular import at module load (auth.ts imports prisma).
    const { auth } = await import("@/auth");
    const session = await auth();
    const orgId = session?.user?.activeOrganizationId;
    if (!session?.user || !orgId) {
      return new Response("Unauthorized", { status: 401 });
    }
    return rlsContext.run(
      { organizationId: orgId, userId: session.user.id },
      () => handler(req, ctx),
    );
  };
}

/**
 * Like withTenant, but also enforces PostgreSQL Row-Level Security for the
 * request: runs the handler inside a Prisma transaction and sets the
 * `app.current_tenant_id` GUC (transaction-local via set_config), so the DB
 * itself rejects any tenant-table row whose organizationId ≠ the request tenant.
 * The handler receives the transactional `tx` client and MUST use it (not the
 * global prisma) for its tenant queries, so they run on the GUC-scoped connection.
 *
 * Use withTenantRls for tenant-data routes (normal request/response). Do NOT use
 * it for SSE/long-lived streams (withTenant) — a transaction cannot be held open
 * for the stream lifetime.
 */
export function withTenantRls(
  handler: (req: Request, ctx: RouteCtx, tx: Prisma.TransactionClient) => Promise<Response>,
): RouteHandler {
  return async (req, ctx) => {
    const { auth } = await import("@/auth");
    const session = await auth();
    const orgId = session?.user?.activeOrganizationId;
    if (!session?.user || !orgId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const { prisma } = await import("./prisma");
    return rlsContext.run(
      { organizationId: orgId, userId: session.user.id },
      async () =>
        prisma.$transaction(async (tx) => {
          // set_config(name, value, is_local=true) == SET LOCAL (transaction-scoped).
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', ${orgId}, true)`;
          return handler(req, ctx, tx);
        }),
    );
  };
}
