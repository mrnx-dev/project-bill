import { AsyncLocalStorage } from "async_hooks";

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
      // Plain Response (not NextResponse) keeps this lib free of next/server,
      // which breaks the jest jsdom env at module load. Response is valid in
      // route handlers (NextResponse is a subclass).
      return new Response("Unauthorized", { status: 401 });
    }
    return rlsContext.run(
      { organizationId: orgId, userId: session.user.id },
      () => handler(req, ctx),
    );
  };
}
