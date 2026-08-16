import { AsyncLocalStorage } from "async_hooks";

export const rlsContext = new AsyncLocalStorage<{ organizationId: string }>();

export function getOrgContext(): string | undefined {
  return rlsContext.getStore()?.organizationId;
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
